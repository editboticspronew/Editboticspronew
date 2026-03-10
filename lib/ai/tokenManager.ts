/**
 * Token Budget Manager for LLM API Calls
 *
 * Handles progressive compression of video data (transcript segments,
 * analysis data) to fit within model token limits.
 *
 * Strategy (4 compression levels):
 *   Level 0 — Full data, no compression (fits comfortably)
 *   Level 1 — Truncate segment text to 150 chars
 *   Level 2 — Truncate to 80 chars + drop low-score segments to fit budget
 *   Level 3 — Two-pass: summarize transcript in chunks, then plan from summaries
 *
 * Usage:
 *   const payload = compressForTokenBudget(segments, { systemPromptTokens: 3000 });
 *   if (payload.needsTwoPass) {
 *     // run chunk summarization first, then feed summaries to the planner
 *   } else {
 *     // use payload.segments directly in the LLM call
 *   }
 */

// ─── Token Estimation ────────────────────────────────────────────

/**
 * Fast heuristic token estimate: ~1 token per 3.5 characters for English text.
 * Conservative — slightly overestimates to avoid hitting the hard limit.
 * For exact counts, use tiktoken (adds ~2MB to bundle).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

/** Estimate tokens for an object that will be JSON-serialized */
export function estimateJsonTokens(obj: unknown): number {
  return estimateTokens(JSON.stringify(obj));
}

// ─── Model Limits ────────────────────────────────────────────────

export const MODEL_TOKEN_LIMITS: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini':  { input: 128_000, output: 16_384 },
  'gpt-4o':       { input: 128_000, output: 16_384 },
  'gpt-4-turbo':  { input: 128_000, output: 4_096 },
  'gpt-3.5-turbo': { input: 16_385, output: 4_096 },
};

// Reserve tokens for model output + JSON overhead + safety margin
const OUTPUT_RESERVE = 4_096;
const SAFETY_MARGIN  = 1_500;

// ─── Types ───────────────────────────────────────────────────────

export interface CompressedPayload {
  /** Compressed segments ready to send to LLM */
  segments: any[];
  /** Which compression level was applied (0-3) */
  compressionLevel: number;
  /** How many segments were in the original input */
  originalCount: number;
  /** How many segments were dropped to fit budget */
  droppedCount: number;
  /** Estimated token count for the compressed segments JSON */
  estimatedTokens: number;
  /** If true, the data is too large even after Level 2 — use two-pass summarization */
  needsTwoPass: boolean;
  /** Human-readable note about what compression was applied */
  note: string;
}

export interface CompressOptions {
  /** OpenAI model name (default: 'gpt-4o-mini') */
  model?: string;
  /** Estimated tokens for system prompt + user prompt template (WITHOUT segments data).
   *  This is subtracted from the total budget to calculate how many tokens 
   *  are available for segment data. Default: 4000 */
  systemPromptTokens?: number;
  /** Estimated tokens for analysis context (scenes, labels, etc.). Default: 0 */
  analysisContextTokens?: number;
  /** Text truncation limits per compression level [L0, L1, L2]. Default: [Infinity, 150, 80] */
  maxTextLength?: [number, number, number];
  /** Never drop below this many segments. Default: 15 */
  minSegments?: number;
  /** Field name used for scoring/ranking segments (higher = better). Segments without this
   *  field get a default mid-range score. Default: undefined (uses position-based weighting) */
  scoreField?: string;
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  model: 'gpt-4o-mini',
  systemPromptTokens: 4_000,
  analysisContextTokens: 0,
  maxTextLength: [Infinity, 150, 80],
  minSegments: 15,
  scoreField: '',
};

// ─── Core Compression Function ───────────────────────────────────

/**
 * Progressively compress transcript segments to fit within the LLM's token budget.
 *
 * @param segments - Array of transcript segment objects (must have at least `start`, `end`, `text`)
 * @param options  - Compression options (model, budgets, thresholds)
 * @returns CompressedPayload with compressed segments and metadata
 *
 * @example
 * ```ts
 * const payload = compressForTokenBudget(transcriptSegments, {
 *   systemPromptTokens: 5000,   // your prompt template size
 *   analysisContextTokens: 3000, // analysis data size
 *   scoreField: 'combinedScore', // if you have enriched/scored segments
 * });
 *
 * if (payload.needsTwoPass) {
 *   // Chunk → summarize → plan
 *   const chunks = chunkSegmentsForSummary(transcriptSegments);
 *   // ... call LLM for each chunk to get summaries ...
 *   // ... then call LLM with summaries to get edit plan ...
 * } else {
 *   // Direct: use payload.segments in the LLM call
 * }
 * ```
 */
export function compressForTokenBudget(
  segments: any[],
  options?: CompressOptions
): CompressedPayload {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const limits = MODEL_TOKEN_LIMITS[opts.model] || MODEL_TOKEN_LIMITS['gpt-4o-mini'];
  const tokenBudget = limits.input - OUTPUT_RESERVE - SAFETY_MARGIN
    - opts.systemPromptTokens - opts.analysisContextTokens;

  if (tokenBudget <= 0) {
    console.warn('⚠️ tokenManager: negative budget — prompt alone may exceed model limit');
  }

  console.log(`📊 Token budget: ${tokenBudget.toLocaleString()} tokens available for segments`);
  console.log(`   (Model ${opts.model}: ${limits.input.toLocaleString()} input - ${OUTPUT_RESERVE} output reserve - ${SAFETY_MARGIN} safety - ${opts.systemPromptTokens} prompt - ${opts.analysisContextTokens} analysis)`);

  // ── Level 0: Full data ──
  const fullTokens = estimateJsonTokens(segments);
  console.log(`   Level 0 (full data): ~${fullTokens.toLocaleString()} tokens for ${segments.length} segments`);

  if (fullTokens <= tokenBudget) {
    return {
      segments,
      compressionLevel: 0,
      originalCount: segments.length,
      droppedCount: 0,
      estimatedTokens: fullTokens,
      needsTwoPass: false,
      note: `No compression needed. ${segments.length} segments fit within budget.`,
    };
  }

  // ── Level 1: Truncate text ──
  const l1Segments = segments.map((s, i) => ({
    index: s.index ?? i,
    start: s.start,
    end: s.end,
    dur: +((s.end - s.start).toFixed(1)),
    text: truncateText(s.text, opts.maxTextLength[1]),
    // Preserve score fields if present
    ...(s.combinedScore !== undefined ? { score: s.combinedScore } : {}),
    ...(s.scores ? { scores: s.scores } : {}),
  }));

  const l1Tokens = estimateJsonTokens(l1Segments);
  console.log(`   Level 1 (truncate text to ${opts.maxTextLength[1]} chars): ~${l1Tokens.toLocaleString()} tokens`);

  if (l1Tokens <= tokenBudget) {
    return {
      segments: l1Segments,
      compressionLevel: 1,
      originalCount: segments.length,
      droppedCount: 0,
      estimatedTokens: l1Tokens,
      needsTwoPass: false,
      note: `Text truncated to ${opts.maxTextLength[1]} chars per segment. All ${segments.length} segments included.`,
    };
  }

  // ── Level 2: Aggressive truncation + drop low-value segments ──
  // Score and rank segments
  const ranked = rankSegments(segments, opts.scoreField);

  // Binary search for the maximum number of top segments that fit
  const minSeg = Math.min(opts.minSegments, ranked.length);
  let lo = minSeg;
  let hi = ranked.length;
  let bestFit: any[] = [];
  let bestTokens = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = ranked.slice(0, mid).map(s => ({
      index: s._originalIndex,
      start: s.start,
      end: s.end,
      dur: +((s.end - s.start).toFixed(1)),
      text: truncateText(s.text, opts.maxTextLength[2]),
    }));

    const candidateTokens = estimateJsonTokens(candidate);
    if (candidateTokens <= tokenBudget) {
      bestFit = candidate;
      bestTokens = candidateTokens;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // Re-sort by timeline order (critical for narrative coherence)
  bestFit.sort((a, b) => a.start - b.start);

  if (bestTokens > 0 && bestTokens <= tokenBudget) {
    const dropped = segments.length - bestFit.length;
    console.log(`   Level 2 (truncate to ${opts.maxTextLength[2]} chars + keep top ${bestFit.length}/${segments.length}): ~${bestTokens.toLocaleString()} tokens`);
    return {
      segments: bestFit,
      compressionLevel: 2,
      originalCount: segments.length,
      droppedCount: dropped,
      estimatedTokens: bestTokens,
      needsTwoPass: false,
      note: `Text truncated to ${opts.maxTextLength[2]} chars. Kept ${bestFit.length} of ${segments.length} segments (dropped ${dropped} lowest-scoring). Segments re-sorted by timeline.`,
    };
  }

  // ── Level 3: Even Level 2 didn't fit — needs two-pass summarization ──
  console.log(`   Level 3: Data too large even after aggressive compression. Flagging for two-pass summarization.`);

  // Return the minimum viable set + flag
  const minimalSet = ranked.slice(0, minSeg).map(s => ({
    index: s._originalIndex,
    start: s.start,
    end: s.end,
    dur: +((s.end - s.start).toFixed(1)),
    text: truncateText(s.text, 50),
  }));
  minimalSet.sort((a, b) => a.start - b.start);

  return {
    segments: minimalSet,
    compressionLevel: 3,
    originalCount: segments.length,
    droppedCount: segments.length - minimalSet.length,
    estimatedTokens: estimateJsonTokens(minimalSet),
    needsTwoPass: true,
    note: `Data exceeds token budget even after aggressive compression. Use two-pass summarization: summarize chunks first, then generate edit plan from summaries.`,
  };
}

// ─── Two-Pass Summarization Helpers ──────────────────────────────

export interface SegmentChunk {
  chunkIndex: number;
  startTime: number;
  endTime: number;
  segmentCount: number;
  segments: Array<{ index: number; start: number; end: number; text: string }>;
}

/**
 * Split segments into chunks for two-pass summarization.
 * Each chunk is small enough to process independently.
 *
 * @param segments  - Full transcript segments
 * @param chunkSize - Number of segments per chunk (default: 50)
 */
export function chunkSegmentsForSummary(
  segments: any[],
  chunkSize: number = 50
): SegmentChunk[] {
  const chunks: SegmentChunk[] = [];

  for (let i = 0; i < segments.length; i += chunkSize) {
    const batch = segments.slice(i, i + chunkSize);
    chunks.push({
      chunkIndex: Math.floor(i / chunkSize),
      startTime: batch[0]?.start ?? 0,
      endTime: batch[batch.length - 1]?.end ?? 0,
      segmentCount: batch.length,
      segments: batch.map((s, j) => ({
        index: s.index ?? (i + j),
        start: s.start,
        end: s.end,
        text: truncateText(s.text, 120),
      })),
    });
  }

  return chunks;
}

/**
 * Build the LLM prompt for summarizing one chunk (Pass 1 of two-pass mode).
 *
 * The LLM returns the strongest moments in each chunk, which are then
 * fed into Pass 2 (the edit plan generator) instead of the full transcript.
 */
export function buildChunkSummaryPrompt(
  chunk: SegmentChunk,
  userRequest: string,
  programType?: string
): string {
  return `You are a video analysis assistant. Summarize this section of a video transcript and identify its strongest moments.

VIDEO SECTION: ${chunk.startTime.toFixed(1)}s — ${chunk.endTime.toFixed(1)}s (${chunk.segmentCount} segments)
USER REQUEST: "${userRequest}"
${programType ? `PROGRAM TYPE: ${programType}` : ''}

TRANSCRIPT SEGMENTS:
${JSON.stringify(chunk.segments, null, 1)}

TASKS:
1. Write a 1-2 sentence summary of what happens in this section
2. Identify the 3-5 STRONGEST moments (most relevant to the user's request, most engaging, most visually interesting)
3. Rate each moment's strength (1-10)

Return ONLY a JSON object:
{
  "section_summary": "brief summary",
  "time_range": { "start": ${chunk.startTime.toFixed(1)}, "end": ${chunk.endTime.toFixed(1)} },
  "strong_moments": [
    { "start": seconds, "end": seconds, "strength": 1-10, "summary": "why this moment is strong", "type": "hook|key_moment|context|highlight" }
  ],
  "has_filler": true/false,
  "overall_quality": 1-10
}

Return ONLY valid JSON. No markdown.`;
}

/**
 * Merge chunk summaries into a condensed transcript representation
 * for Pass 2 (edit plan generation).
 *
 * @param chunkSummaries - Array of parsed LLM responses from Pass 1
 * @returns A condensed string suitable for the edit plan prompt
 */
export function mergeChunkSummaries(
  chunkSummaries: Array<{
    section_summary: string;
    time_range: { start: number; end: number };
    strong_moments: Array<{ start: number; end: number; strength: number; summary: string; type: string }>;
    overall_quality: number;
  }>
): string {
  const parts: string[] = [];

  parts.push(`VIDEO CONTENT SUMMARY (${chunkSummaries.length} sections analyzed):\n`);

  for (const chunk of chunkSummaries) {
    parts.push(`[${chunk.time_range.start.toFixed(1)}s — ${chunk.time_range.end.toFixed(1)}s] (quality: ${chunk.overall_quality}/10)`);
    parts.push(`  Summary: ${chunk.section_summary}`);
    if (chunk.strong_moments?.length > 0) {
      parts.push(`  Strong moments:`);
      for (const m of chunk.strong_moments) {
        parts.push(`    • ${m.start.toFixed(1)}s–${m.end.toFixed(1)}s (${m.strength}/10, ${m.type}): ${m.summary}`);
      }
    }
    parts.push('');
  }

  // Collect all strong moments into a flat list for the edit planner
  const allMoments = chunkSummaries
    .flatMap(c => c.strong_moments || [])
    .sort((a, b) => b.strength - a.strength);

  parts.push(`\nTOP MOMENTS RANKED BY STRENGTH:`);
  for (const m of allMoments.slice(0, 20)) {
    parts.push(`  ${m.strength}/10 — ${m.start.toFixed(1)}s–${m.end.toFixed(1)}s (${m.type}): ${m.summary}`);
  }

  return parts.join('\n');
}

// ─── Analysis Data Compression ───────────────────────────────────

/**
 * Compress analysis context (scenes, labels, key moments) to fit a token budget.
 * Keeps the most valuable information and trims the rest.
 */
export function compressAnalysisContext(
  analysis: {
    scenes?: any[];
    labels?: any[];
    keyMoments?: any[];
    summary?: any;
    faces?: number;
    objects?: any[];
    detectedText?: any[];
  },
  maxTokens: number = 6000
): { compressed: string; estimatedTokens: number } {
  const parts: string[] = [];
  let currentTokens = 0;

  // Priority 1: Summary (always include, ~200 tokens)
  if (analysis.summary) {
    const summaryText = [
      analysis.summary.overview && `Overview: ${analysis.summary.overview}`,
      analysis.summary.mainTopic && `Topic: ${analysis.summary.mainTopic}`,
      analysis.summary.keyPoints?.length > 0 && `Key Points: ${analysis.summary.keyPoints.join('; ')}`,
    ].filter(Boolean).join('\n  ');
    parts.push(`VIDEO SUMMARY:\n  ${summaryText}`);
    currentTokens = estimateTokens(parts.join('\n'));
  }

  // Priority 2: Key moments (critical for edit planning, ~300 tokens)
  if (analysis.keyMoments && analysis.keyMoments.length > 0 && currentTokens < maxTokens * 0.8) {
    const moments = analysis.keyMoments.slice(0, 10);
    parts.push(`\nKEY MOMENTS (${moments.length}):`);
    for (const m of moments) {
      parts.push(`  - ${m.time?.toFixed?.(1) ?? m.time}s: ${m.reason}`);
    }
    currentTokens = estimateTokens(parts.join('\n'));
  }

  // Priority 3: Scene boundaries (~500 tokens for 20 scenes)
  if (analysis.scenes && analysis.scenes.length > 0 && currentTokens < maxTokens * 0.7) {
    const maxScenes = Math.min(analysis.scenes.length, 30);
    const scenes = analysis.scenes.slice(0, maxScenes);
    parts.push(`\nSCENE BOUNDARIES (${scenes.length}${analysis.scenes.length > maxScenes ? ` of ${analysis.scenes.length}` : ''}):`);
    for (const [i, s] of scenes.entries()) {
      parts.push(`  Scene ${i + 1}: ${s.start?.toFixed?.(1) ?? s.start}s — ${s.end?.toFixed?.(1) ?? s.end}s${s.description ? ` — ${s.description}` : ''}`);
    }
    currentTokens = estimateTokens(parts.join('\n'));
  }

  // Priority 4: Content labels (~200 tokens for top 10)
  if (analysis.labels && analysis.labels.length > 0 && currentTokens < maxTokens * 0.85) {
    const maxLabels = Math.min(analysis.labels.length, 10);
    const labels = analysis.labels.slice(0, maxLabels);
    parts.push(`\nCONTENT LABELS (top ${maxLabels}):`);
    for (const l of labels) {
      parts.push(`  - ${l.label} (${(l.confidence * 100).toFixed(0)}%)`);
    }
    currentTokens = estimateTokens(parts.join('\n'));
  }

  // Priority 5: Faces (tiny, ~10 tokens)
  if (analysis.faces && analysis.faces > 0) {
    parts.push(`\nFACES DETECTED: ${analysis.faces}`);
  }

  // Skip objects and detectedText if budget is tight — they're lower priority
  if (analysis.objects && analysis.objects.length > 0 && currentTokens < maxTokens * 0.7) {
    const top = analysis.objects.slice(0, 8);
    parts.push(`\nOBJECTS: ${top.map(o => `${o.object} (${o.appearances}x)`).join(', ')}`);
  }

  const result = parts.join('\n');
  return {
    compressed: result,
    estimatedTokens: estimateTokens(result),
  };
}

// ─── Internal Helpers ────────────────────────────────────────────

/** Truncate text to a max length, adding ellipsis if needed */
function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  if (maxLength === Infinity || text.length <= maxLength) return text.trim();
  return text.substring(0, maxLength).trim() + '...';
}

/** Rank segments by score (if available) or by positional heuristic */
function rankSegments(
  segments: any[],
  scoreField: string
): Array<any & { _originalIndex: number; _rankScore: number }> {
  const hasScores = scoreField && segments.some(s => s[scoreField] !== undefined);

  return segments
    .map((s, i) => {
      let score: number;

      if (hasScores && s[scoreField] !== undefined) {
        // Use the provided score field
        score = Number(s[scoreField]) || 0;
      } else {
        // Positional heuristic: favor segments in the first 20% (intro)
        // and around key moments (middle + end)
        const position = i / segments.length;
        if (position < 0.15) score = 0.8;        // Opening — likely important
        else if (position < 0.3) score = 0.6;     // Early context
        else if (position > 0.85) score = 0.75;   // Closing — often has conclusions
        else if (position > 0.4 && position < 0.6) score = 0.7; // Middle — often has key points
        else score = 0.5;                          // Default

        // Boost segments with more substantial text
        const textLen = s.text?.length || 0;
        if (textLen > 100) score += 0.1;
        if (textLen < 20) score -= 0.2;  // Very short = likely filler
      }

      return { ...s, _originalIndex: s.index ?? i, _rankScore: score };
    })
    .sort((a, b) => b._rankScore - a._rankScore);
}
