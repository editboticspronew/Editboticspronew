import { NextRequest, NextResponse } from 'next/server';
import {
  compressForTokenBudget,
  estimateTokens,
  chunkSegmentsForSummary,
  buildChunkSummaryPrompt,
  mergeChunkSummaries,
} from '@/lib/ai/tokenManager';

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

/** Enriched segment with visual analysis data (optional) */
interface LLMEnrichedSegment {
  index: number;
  start: number;
  end: number;
  text: string;
  labels: string;        // top visual labels, comma-separated
  scores: string;        // "transcript=0.6 visual=0.5 combined=0.55"
  visualContext: string;  // "talking_head, product_visible"
}

interface IdentifiedSegment {
  index: number;
  start: number;
  end: number;
  text: string;
  relevance: string;
  runningTotal?: number; // cumulative duration of all selected segments up to this one
  priority?: number;     // 1-10 hook priority (lower = better hook)
}

interface MergedClip {
  start: number;
  end: number;
  segments: IdentifiedSegment[];
}

interface SceneBoundary {
  start: number;
  end: number;
}

/**
 * Snap a timestamp to the nearest scene boundary edge.
 * Prefers snapping to a boundary within `maxSnapSeconds`.
 * For clip start → snap to nearest scene start.
 * For clip end → snap to nearest scene end.
 */
function snapToSceneBoundary(
  timestamp: number,
  scenes: SceneBoundary[],
  edgeType: 'start' | 'end',
  maxSnapSeconds: number = 2.0
): number {
  if (!scenes || scenes.length === 0) return timestamp;

  let bestEdge = timestamp;
  let bestDist = Infinity;

  for (const scene of scenes) {
    const edge = edgeType === 'start' ? scene.start : scene.end;
    const dist = Math.abs(edge - timestamp);
    if (dist < bestDist && dist <= maxSnapSeconds) {
      bestDist = dist;
      bestEdge = edge;
    }
  }
  return bestEdge;
}

/**
 * Parse a free-text duration constraint into seconds.
 * Handles: "30 seconds", "1 minute", "2 min", "1:30", "90s", "under 2 minutes", etc.
 * Returns null if it can't parse.
 */
function parseDurationConstraint(text: string): number | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // Try "X:XX" format (mm:ss)
  const mmss = lower.match(/(\d+):(\d{1,2})/);
  if (mmss) return parseInt(mmss[1]) * 60 + parseInt(mmss[2]);

  // Try to extract numbers with unit keywords
  const minuteMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:min(?:ute)?s?)/);
  const secondMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:sec(?:ond)?s?|s\b)/);

  let total = 0;
  if (minuteMatch) total += parseFloat(minuteMatch[1]) * 60;
  if (secondMatch) total += parseFloat(secondMatch[1]);
  if (total > 0) return total;

  // Bare number — guess: <=10 probably minutes, >10 probably seconds
  const bareNum = lower.match(/(\d+(?:\.\d+)?)/);
  if (bareNum) {
    const n = parseFloat(bareNum[1]);
    return n <= 10 ? n * 60 : n;
  }

  return null;
}

/**
 * POST /api/generate-clips
 *
 * LLM-only: Analyzes transcription segments to find relevant ones,
 * merges adjacent segments, and returns clip timestamps.
 * Actual video clipping is done on the frontend with FFmpeg WASM.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      segments,           // Transcription segments with timestamps
      query: userQuery,   // What the user wants to extract
      durationConstraint, // Optional: time duration constraint (e.g., "30 seconds")
      paddingSeconds = 1.5,
      mergeGapSeconds = 3,
      enrichedSegments,   // Optional: vision-enriched segments for multimodal selection
      scenes,             // Optional: scene boundaries for snap-to-scene
      mustIncludeKeywords, // Optional: keywords that MUST appear in selected clips
      excludeKeywords,     // Optional: keywords/topics to EXCLUDE from clips
      clipFeedback,        // Optional: previous clips with user feedback for regeneration
    } = body;

    // All optimizations are always ON by default
    const silenceTrimming = true;
    const redundancyElimination = true;
    const hookFirstReorder = true;

    // Validate
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: 'Transcription segments with timestamps are required' },
        { status: 400 }
      );
    }
    if (!userQuery) {
      return NextResponse.json(
        { error: 'Query describing desired clips is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured on server' },
        { status: 500 }
      );
    }

    console.log(`🎬 Generate Clips — LLM Analysis`);
    console.log(`   Query: "${userQuery}"`);
    console.log(`   Duration constraint: ${durationConstraint || 'none'}`);
    console.log(`   Segments: ${segments.length}`);
    console.log(`   Vision enrichment: ${enrichedSegments ? 'YES' : 'NO'}`);
    console.log(`   Scene-snap: ${scenes?.length ? `YES (${scenes.length} scenes)` : 'NO'}`);
    console.log(`   Feedback loop: ${clipFeedback?.previousClips?.length > 0 ? `YES (${clipFeedback.previousClips.length} clips rated)` : 'NO'}`);
    console.log(`   Optimizations: silenceTrimming=ON, redundancyElimination=ON, hookFirstReorder=ON`);

    // Parse the user's duration constraint into a target seconds value (if possible)
    const targetDurationSeconds = durationConstraint ? parseDurationConstraint(durationConstraint) : null;

    // Compute total available content duration so we can tell the LLM
    const totalAvailableDuration = segments.reduce(
      (sum: number, s: TranscriptSegment) => sum + (s.end - s.start), 0
    );

    // Build duration instruction — LLM is fully responsible for fitting the budget
    let durationInstruction = '';
    if (durationConstraint && targetDurationSeconds) {
      durationInstruction = `\n\nDURATION CONSTRAINT: ${targetDurationSeconds} seconds (user said: "${durationConstraint}").`;
      durationInstruction += `\nTotal available content: ~${totalAvailableDuration.toFixed(0)}s. You must select a subset that totals ≤ ${targetDurationSeconds}s.`;
      durationInstruction += `\n\nCRITICAL RULES FOR DURATION:`;
      durationInstruction += `\n1. Each segment has a "dur" field showing its duration in seconds.`;
      durationInstruction += `\n2. As you pick segments, keep a RUNNING TOTAL of the "dur" values. STOP selecting once your running total approaches ${targetDurationSeconds}s.`;
      durationInstruction += `\n3. Additionally, consecutive segments will be merged into one continuous clip — any small gaps (1-3s) between them become part of the clip. So picking 3 consecutive segments of 10s each that are back-to-back means ~30s + gaps, not just 30s.`;
      durationInstruction += `\n4. Return a "runningTotal" field in EACH selected segment showing the cumulative duration sum up to and including that segment.`;
      durationInstruction += `\n5. The LAST segment's runningTotal MUST be ≤ ${targetDurationSeconds}. If it exceeds the budget, remove segments until it fits.`;
      durationInstruction += `\n6. Do NOT be greedy — a tight, impactful ${targetDurationSeconds}s selection is better than overshooting.`;
    } else if (durationConstraint) {
      durationInstruction = `\n\nDURATION CONSTRAINT: ${durationConstraint}. Select only the most relevant segments that fit this time frame.`;
    }

    // Build keyword boost/exclude instructions
    let keywordInstruction = '';
    if (mustIncludeKeywords?.trim()) {
      keywordInstruction += `\n\nMUST-INCLUDE KEYWORDS: ${mustIncludeKeywords.trim()}\nIMPORTANT: You MUST include segments that contain or relate to these keywords/topics. These are hard requirements — if a segment mentions any of these keywords, it should be selected regardless of other scoring.`;
    }
    if (excludeKeywords?.trim()) {
      keywordInstruction += `\n\nEXCLUDE KEYWORDS: ${excludeKeywords.trim()}\nIMPORTANT: Do NOT include segments that are primarily about these topics or keywords. If a segment's main subject matches an excluded keyword, skip it even if it partially overlaps with the user's query.`;
    }

    // Redundancy elimination instruction (always on)
    const redundancyInstruction = `\n\nREDUNDANCY ELIMINATION: If multiple segments cover the exact same topic, point, or repeated content, pick only the MOST concise and clear version. Do not include near-duplicate segments that restate the same information.`;

    // Silence & filler trimming instruction (always on)
    const silenceInstruction = `\n\nSILENCE & FILLER TRIMMING: Exclude segments that are primarily filler words ("um", "uh", "like", "you know", "so", "basically"), long pauses, or dead air. When a segment contains filler at the start or end, tighten the start/end timestamps to skip the filler portion. Prefer clean, concise segments without verbal hesitations.`;

    // Hook-first reordering instruction (always on)
    const hookInstruction = `\n\nHOOK-FIRST REORDERING: Also assign each selected segment a "priority" field (integer 1-10, where 1 = most engaging/impactful moment that would make a great hook to grab viewer attention). Consider surprise reveals, emotional peaks, key insights, and provocative statements when scoring.`;


    // Iterative feedback loop instruction
    let feedbackInstruction = '';
    if (clipFeedback?.previousClips && Array.isArray(clipFeedback.previousClips) && clipFeedback.previousClips.length > 0) {
      const liked = clipFeedback.previousClips.filter((c: any) => c.feedback === 'liked');
      const disliked = clipFeedback.previousClips.filter((c: any) => c.feedback === 'disliked');
      feedbackInstruction = `\n\nITERATIVE FEEDBACK — PREVIOUS ATTEMPT: The user already saw a set of clips and gave feedback. Improve your selection based on their preferences.`;
      if (liked.length > 0) {
        feedbackInstruction += `\n\nLIKED CLIPS (include similar content):\n${liked.map((c: any) => `- [${c.start.toFixed(1)}s – ${c.end.toFixed(1)}s]: "${(c.transcript || '').substring(0, 120)}"`).join('\n')}`;
      }
      if (disliked.length > 0) {
        feedbackInstruction += `\n\nDISLIKED CLIPS (avoid similar content, find better alternatives):\n${disliked.map((c: any) => `- [${c.start.toFixed(1)}s – ${c.end.toFixed(1)}s]: "${(c.transcript || '').substring(0, 120)}"`).join('\n')}`;
      }
      feedbackInstruction += `\n\nIMPORTANT: Keep content similar to liked clips. Replace disliked clips with better alternatives from different parts of the video. Do NOT reselect the same disliked segments.`;
    }

    // ──────────────────────────────────────────────
    // Step 1: Use LLM to identify relevant segments
    // ──────────────────────────────────────────────

    const useMultimodal = Array.isArray(enrichedSegments) && enrichedSegments.length > 0;

    // ── Estimate instruction overhead tokens (everything except segments data) ──
    const instructionOverhead = estimateTokens(
      [durationInstruction, keywordInstruction, redundancyInstruction,
       silenceInstruction, hookInstruction, feedbackInstruction, userQuery].join('')
    ) + 800; // base prompt template + formatting

    let llmPrompt: string;

    if (useMultimodal) {
      // ── Enhanced multimodal prompt with vision data ──
      const rawEnriched = (enrichedSegments as LLMEnrichedSegment[]).map((seg) => ({
        index: seg.index,
        start: seg.start,
        end: seg.end,
        dur: +(seg.end - seg.start).toFixed(1),
        text: seg.text,
        visualLabels: seg.labels,
        scores: seg.scores,
        visualContext: seg.visualContext,
      }));

      // Compress enriched segments if needed
      const compressed = compressForTokenBudget(rawEnriched, {
        model: 'gpt-4o-mini',
        systemPromptTokens: instructionOverhead + 300,
        scoreField: 'scores',
      });

      if (compressed.compressionLevel > 0) {
        console.log(`   📊 Token compression (multimodal): Level ${compressed.compressionLevel} — ${compressed.note}`);
      }

      const enrichedForLLM = compressed.segments;

      llmPrompt = `You are a video editor assistant and creative director with access to BOTH transcript text AND visual analysis data. Use both signals to identify the most relevant segments. Think like a skilled editor building a mini-story, not a search engine matching keywords.

USER REQUEST: "${userQuery}"${durationInstruction}${keywordInstruction}${redundancyInstruction}${silenceInstruction}${hookInstruction}${feedbackInstruction}

ENRICHED SEGMENTS (transcript + visual analysis)${compressed.compressionLevel > 0 ? ` [compressed: ${compressed.originalCount} total, showing ${compressed.segments.length}]` : ''}:
${JSON.stringify(enrichedForLLM, null, 2)}

INSTRUCTIONS:
- Select segments that are most relevant to the user's request
- Use BOTH the transcript text AND visual labels/context to determine relevance
- A segment is MORE relevant when:
  • The transcript text mentions the requested topic (high transcript score)
  • Visual labels match the topic (e.g., "camera" label for a camera review request)
  • Product is visible (product_visible in visualContext)
  • A talking head is present when someone is explaining/reviewing (talking_head in visualContext)
- Prefer segments with HIGH combined scores
- Think about narrative coherence: do the selected segments tell a mini-story when played together?
- Prefer segments that contribute to a structure (hook → context → key point → conclusion) rather than random keyword matches
- If multiple segments score equally, prefer the one with stronger visual or emotional impact
- Be selective — only include segments that are clearly relevant and fit within the duration budget
- Return ONLY a JSON array of objects with: index, start, end, text, relevance (brief reason)${targetDurationSeconds ? ', runningTotal (cumulative sum of dur values of all selected segments up to and including this one)' : ''}
- If no segments match, return an empty array []
- Return ONLY valid JSON, no markdown or explanation

RESPONSE (JSON array only):`;
    } else {
      // ── Standard transcript-only prompt ──
      const rawSegments = segments.map((seg: TranscriptSegment, i: number) => ({
        index: i,
        start: seg.start,
        end: seg.end,
        dur: +(seg.end - seg.start).toFixed(1),
        text: seg.text.trim(),
      }));

      // Compress segments if needed for very long videos
      const compressed = compressForTokenBudget(rawSegments, {
        model: 'gpt-4o-mini',
        systemPromptTokens: instructionOverhead + 200,
      });

      if (compressed.compressionLevel > 0) {
        console.log(`   📊 Token compression (standard): Level ${compressed.compressionLevel} — ${compressed.note}`);
      }

      // Two-pass fallback for extremely large transcripts
      let segmentsBlock: string;
      if (compressed.needsTwoPass) {
        console.log(`   🔄 Two-pass mode: Summarizing ${segments.length} segments before clip selection...`);
        const twoPassSummary = await runClipsTwoPass(segments, userQuery, apiKey);
        segmentsBlock = `CONDENSED VIDEO SUMMARY (original had ${segments.length} segments — summarized via two-pass):\n${twoPassSummary}`;
      } else {
        const segmentsForLLM = compressed.segments;
        segmentsBlock = `TRANSCRIPTION SEGMENTS${compressed.compressionLevel > 0 ? ` [compressed: ${compressed.originalCount} total, showing ${compressed.segments.length}]` : ''}:\n${JSON.stringify(segmentsForLLM, null, 2)}`;
      }

      llmPrompt = `You are a video editor assistant and creative director. Given a list of transcription segments with timestamps, identify which segments are relevant to the user's request. Think like a skilled editor selecting the best moments for a compelling clip, not a search engine matching keywords.

USER REQUEST: "${userQuery}"${durationInstruction}${keywordInstruction}${redundancyInstruction}${silenceInstruction}${hookInstruction}${feedbackInstruction}

${segmentsBlock}

INSTRUCTIONS:
- Select segments that are most relevant to the user's request
- Include segments that provide narrative context (intro/outro to the topic)
- Prioritize segments that tell a coherent story when played in sequence
- Prefer segments with stronger narrative moments, emotional impact, or viewer engagement over bland keyword matches
- If the selected segments would feel disjointed when played together, add bridging context segments
- Be selective — only include segments that are clearly relevant and fit within the duration budget
- Return ONLY a JSON array of objects with: index, start, end, text, relevance (brief reason)${targetDurationSeconds ? ', runningTotal (cumulative sum of dur values of all selected segments up to and including this one)' : ''}
- If no segments match, return an empty array []
- Return ONLY valid JSON, no markdown or explanation

RESPONSE (JSON array only):`;
    }

    console.log(`\n📝 ── Final LLM Prompt (${llmPrompt.length} chars, ~${estimateTokens(llmPrompt).toLocaleString()} tokens) ──`);
    console.log(llmPrompt);
    console.log(`📝 ── End of Prompt ──\n`);

    // ──────────────────────────────────────────────
    // LLM call with duration retry logic
    // If LLM overshoots the duration budget, we send
    // its response back and ask it to trim down.
    // Max 2 retries (3 total attempts).
    // ──────────────────────────────────────────────

    const systemMessage = useMultimodal
      ? 'You are a precise video editing assistant and creative director with access to both transcript and visual analysis data. Select segments that create a compelling narrative — think like an editor, not a search engine. You MUST stay within the duration budget. You respond ONLY with valid JSON arrays. No markdown, no explanation.'
      : 'You are a precise video editing assistant and creative director. Select segments that create a compelling narrative — think like an editor, not a search engine. You MUST stay within the duration budget. You respond ONLY with valid JSON arrays. No markdown, no explanation.';

    const MAX_DURATION_RETRIES = 2;
    let identifiedSegments: IdentifiedSegment[] = [];
    let conversationMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: llmPrompt },
    ];

    for (let attempt = 0; attempt <= MAX_DURATION_RETRIES; attempt++) {
      const isRetry = attempt > 0;
      console.log(isRetry
        ? `\n🔄 Duration retry ${attempt}/${MAX_DURATION_RETRIES}...`
        : `\n🤖 Calling LLM (attempt 1)...`
      );

      const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: conversationMessages,
          temperature: isRetry ? 0.2 : 0.3, // Lower temperature on retry for stricter compliance
          max_tokens: 4000,
        }),
      });

      if (!llmResponse.ok) {
        const errText = await llmResponse.text();
        console.error('❌ LLM API error:', errText);
        return NextResponse.json(
          { error: 'Failed to analyze segments with AI' },
          { status: 500 }
        );
      }

      const llmResult = await llmResponse.json();
      const llmContent = llmResult.choices?.[0]?.message?.content?.trim() || '[]';

      try {
        const cleaned = llmContent
          .replace(/```json?\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        identifiedSegments = JSON.parse(cleaned);
      } catch {
        console.error('❌ Failed to parse LLM response:', llmContent);
        if (isRetry) break; // Don't fail on retry parse errors, use previous result
        return NextResponse.json(
          { error: 'AI returned invalid response. Please try again.' },
          { status: 500 }
        );
      }

      if (!Array.isArray(identifiedSegments) || identifiedSegments.length === 0) {
        return NextResponse.json({
          success: true,
          clips: [],
          message: 'No segments matched your query. Try a broader description.',
        });
      }

      // Log the LLM selection
      const llmTotalDuration = identifiedSegments.reduce((sum, s) => sum + (s.end - s.start), 0);
      console.log(`\n📋 ── LLM Selected Segments — Attempt ${attempt + 1} (${identifiedSegments.length} segments, ${llmTotalDuration.toFixed(1)}s raw content${targetDurationSeconds ? ` / ${targetDurationSeconds}s target` : ''}) ──`);
      for (const seg of identifiedSegments) {
        const dur = (seg.end - seg.start).toFixed(1);
        const rt = seg.runningTotal ? ` | runningTotal: ${seg.runningTotal}s` : '';
        console.log(`   [${seg.index}] ${seg.start}s – ${seg.end}s (${dur}s)${rt} | ${seg.relevance}`);
        console.log(`        "${seg.text.substring(0, 120)}${seg.text.length > 120 ? '...' : ''}"`);
      }
      if (targetDurationSeconds) {
        const overUnder = llmTotalDuration - targetDurationSeconds;
        console.log(`   📊 LLM total: ${llmTotalDuration.toFixed(1)}s vs target ${targetDurationSeconds}s (${overUnder > 0 ? '+' : ''}${overUnder.toFixed(1)}s)`);
      }
      console.log(`📋 ── End of LLM Selection (Attempt ${attempt + 1}) ──\n`);

      // Check if duration is within budget (20% tolerance)
      if (!targetDurationSeconds || llmTotalDuration <= targetDurationSeconds * 1.20) {
        if (isRetry) console.log(`   ✅ Retry successful — duration now within budget`);
        break; // Good enough, move on
      }

      // Over budget — need retry
      if (attempt < MAX_DURATION_RETRIES) {
        const retryMessage = `Your selection totals ${llmTotalDuration.toFixed(1)} seconds of content, but the HARD LIMIT is ${targetDurationSeconds} seconds. That is ${((llmTotalDuration / targetDurationSeconds) * 100).toFixed(0)}% of the budget — too much.

Here is what you selected (with durations):
${identifiedSegments.map(s => `- [${s.index}] ${s.start}s–${s.end}s (${(s.end - s.start).toFixed(1)}s): "${s.text.substring(0, 80)}..."`).join('\n')}

You MUST cut this down to fit within ${targetDurationSeconds} seconds total. This is a hard constraint that cannot be exceeded.
- Remove the least essential segments
- Keep only the absolute best highlights for the user's query
- The final runningTotal of the last segment MUST be ≤ ${targetDurationSeconds}

Return the reduced JSON array:`;

        // Add assistant response + correction to conversation
        conversationMessages.push({ role: 'assistant', content: llmContent });
        conversationMessages.push({ role: 'user', content: retryMessage });

        console.log(`   ⚠️ Over budget (${llmTotalDuration.toFixed(1)}s / ${targetDurationSeconds}s) — sending correction to LLM...`);
      } else {
        console.log(`   ⚠️ Still over budget after ${MAX_DURATION_RETRIES} retries (${llmTotalDuration.toFixed(1)}s / ${targetDurationSeconds}s) — proceeding with current selection`);
      }
    }

    console.log(`   ✅ Found ${identifiedSegments.length} relevant segments`);

    // Sort by timestamp and proceed to merge.
    const selectedSegments = [...identifiedSegments].sort((a, b) => a.start - b.start);

    // ──────────────────────────────────────────────
    // Step 3: Merge adjacent/close segments into clips
    // ──────────────────────────────────────────────

    const mergedClips: MergedClip[] = [];
    let currentClip: MergedClip | null = null;

    for (const seg of selectedSegments) {
      if (!currentClip) {
        currentClip = {
          start: Math.max(0, seg.start - paddingSeconds),
          end: seg.end + paddingSeconds,
          segments: [seg],
        };
      } else if (seg.start - currentClip.end <= mergeGapSeconds) {
        currentClip.end = seg.end + paddingSeconds;
        currentClip.segments.push(seg);
      } else {
        mergedClips.push(currentClip);
        currentClip = {
          start: Math.max(0, seg.start - paddingSeconds),
          end: seg.end + paddingSeconds,
          segments: [seg],
        };
      }
    }
    if (currentClip) {
      mergedClips.push(currentClip);
    }

    console.log(`   ✅ Merged into ${mergedClips.length} clip(s)`);

    // ──────────────────────────────────────────────
    // Step 3b: Snap clip boundaries to scene edges
    // ──────────────────────────────────────────────
    const sceneData: SceneBoundary[] = Array.isArray(scenes) && scenes.length > 0
      ? scenes.map((s: any) => ({ start: Number(s.start), end: Number(s.end) }))
      : [];

    if (sceneData.length > 0) {
      for (const clip of mergedClips) {
        clip.start = snapToSceneBoundary(clip.start, sceneData, 'start');
        clip.end = snapToSceneBoundary(clip.end, sceneData, 'end');
      }
      console.log(`   ✅ Scene-snapped ${mergedClips.length} clip(s) to ${sceneData.length} scene boundaries`);
    }

    // ──────────────────────────────────────────────
    // Step 3c: Hook-first reordering
    // ──────────────────────────────────────────────
    if (hookFirstReorder && mergedClips.length > 1) {
      let bestIdx = 0;
      let bestPriority = Infinity;
      for (let i = 0; i < mergedClips.length; i++) {
        const clipPriority = Math.min(
          ...mergedClips[i].segments.map((s) => s.priority ?? 10)
        );
        if (clipPriority < bestPriority) {
          bestPriority = clipPriority;
          bestIdx = i;
        }
      }
      if (bestIdx > 0) {
        const hook = mergedClips.splice(bestIdx, 1)[0];
        mergedClips.unshift(hook);
        console.log(`   ✅ Hook-first: moved clip from position ${bestIdx + 1} to front (priority=${bestPriority})`);
      }
    }

    // ──────────────────────────────────────────────
    // Step 4: Proportional trim fallback
    // If the total clip duration STILL exceeds the
    // target after LLM retries, we proportionally
    // trim each clip from both edges.
    // Bigger clips absorb more of the cut.
    // ──────────────────────────────────────────────
    if (targetDurationSeconds && mergedClips.length > 0) {
      const preTrimTotal = mergedClips.reduce((sum, c) => sum + (c.end - c.start), 0);

      if (preTrimTotal > targetDurationSeconds * 1.10) {
        const MIN_CLIP_DURATION = 3.0; // Never trim a clip below 3 seconds

        // Calculate how much of each clip we can keep
        const keepRatio = targetDurationSeconds / preTrimTotal;

        console.log(`\n✂️ ── Proportional Trim Service ──`);
        console.log(`   Pre-trim total: ${preTrimTotal.toFixed(1)}s | Target: ${targetDurationSeconds}s | Keep ratio: ${(keepRatio * 100).toFixed(1)}%`);

        for (const clip of mergedClips) {
          const originalDuration = clip.end - clip.start;
          const targetClipDuration = Math.max(originalDuration * keepRatio, MIN_CLIP_DURATION);

          if (targetClipDuration < originalDuration) {
            // Trim equally from both edges, keeping the center content
            const trimPerSide = (originalDuration - targetClipDuration) / 2;
            const oldStart = clip.start;
            const oldEnd = clip.end;
            clip.start = +(clip.start + trimPerSide).toFixed(2);
            clip.end = +(clip.end - trimPerSide).toFixed(2);
            console.log(`   Clip [${oldStart.toFixed(1)}s–${oldEnd.toFixed(1)}s] ${originalDuration.toFixed(1)}s → [${clip.start}s–${clip.end}s] ${(clip.end - clip.start).toFixed(1)}s (trimmed ${(trimPerSide * 2).toFixed(1)}s)`);
          } else {
            console.log(`   Clip [${clip.start.toFixed(1)}s–${clip.end.toFixed(1)}s] ${originalDuration.toFixed(1)}s → kept (at minimum)`);
          }
        }

        const postTrimTotal = mergedClips.reduce((sum, c) => sum + (c.end - c.start), 0);
        console.log(`   Post-trim total: ${postTrimTotal.toFixed(1)}s (target: ${targetDurationSeconds}s)`);
        console.log(`✂️ ── End Proportional Trim ──\n`);
      }
    }

    // ──────────────────────────────────────────────
    // Return clip definitions (frontend does the actual clipping)
    // ──────────────────────────────────────────────
    const clips = mergedClips.map((clip, i) => ({
      index: i + 1,
      start: clip.start,
      end: clip.end,
      duration: clip.end - clip.start,
      segmentCount: clip.segments.length,
      transcript: clip.segments.map((s) => s.text).join(' '),
      reasons: clip.segments.map((s) => s.relevance).filter(Boolean),
    }));

    const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);
    console.log(`   📊 Final output: ${clips.length} clip(s), total ${totalDuration.toFixed(1)}s${targetDurationSeconds ? ` (target: ${targetDurationSeconds}s)` : ''}`);

    return NextResponse.json({
      success: true,
      query: userQuery,
      totalSegmentsAnalyzed: segments.length,
      relevantSegmentsFound: identifiedSegments.length,
      totalDuration: +totalDuration.toFixed(1),
      targetDuration: targetDurationSeconds,
      clips,
    });
  } catch (error: any) {
    console.error('❌ Generate clips error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── Two-Pass Summarization for Very Large Transcripts ───────────

/**
 * When segments are too large for a single generate-clips call,
 * split into chunks, summarize each chunk's strongest moments,
 * then return a condensed representation for the main LLM call.
 */
async function runClipsTwoPass(
  segments: TranscriptSegment[],
  userQuery: string,
  apiKey: string
): Promise<string> {
  const chunks = chunkSegmentsForSummary(
    segments.map((s, i) => ({ index: i, start: s.start, end: s.end, text: s.text })),
    50
  );

  console.log(`   📦 Split into ${chunks.length} chunks for two-pass summarization`);

  const chunkResults: any[] = [];

  for (const chunk of chunks) {
    const summaryPrompt = buildChunkSummaryPrompt(chunk, userQuery);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a video analysis assistant. Return ONLY valid JSON. No markdown.' },
            { role: 'user', content: summaryPrompt },
          ],
          temperature: 0.2,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        console.warn(`   ⚠️ Chunk ${chunk.chunkIndex} failed: ${response.status}`);
        chunkResults.push({
          section_summary: `Section ${chunk.startTime.toFixed(1)}s-${chunk.endTime.toFixed(1)}s`,
          time_range: { start: chunk.startTime, end: chunk.endTime },
          strong_moments: [],
          overall_quality: 5,
        });
        continue;
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content?.trim() || '{}';

      try {
        const cleaned = content.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        chunkResults.push(parsed);
        console.log(`   ✅ Chunk ${chunk.chunkIndex}: ${parsed.strong_moments?.length || 0} strong moments`);
      } catch {
        chunkResults.push({
          section_summary: `Section ${chunk.startTime.toFixed(1)}s-${chunk.endTime.toFixed(1)}s`,
          time_range: { start: chunk.startTime, end: chunk.endTime },
          strong_moments: [],
          overall_quality: 5,
        });
      }
    } catch (err: any) {
      console.warn(`   ⚠️ Chunk ${chunk.chunkIndex} error: ${err.message}`);
      chunkResults.push({
        section_summary: `Section ${chunk.startTime.toFixed(1)}s-${chunk.endTime.toFixed(1)}s`,
        time_range: { start: chunk.startTime, end: chunk.endTime },
        strong_moments: [],
        overall_quality: 5,
      });
    }
  }

  const merged = mergeChunkSummaries(chunkResults);
  console.log(`   ✅ Two-pass complete: ~${estimateTokens(merged).toLocaleString()} tokens`);
  return merged;
}
