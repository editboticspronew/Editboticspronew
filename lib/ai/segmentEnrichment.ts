/**
 * Segment Enrichment & Scoring Library
 *
 * Aligns vision analysis data with transcript segments to create
 * enriched multimodal segments for improved clip selection.
 *
 * This library runs CLIENT-SIDE — no API calls needed.
 * Vision analysis is run once per video and cached in Firestore.
 * Enrichment + scoring runs per query (fast, pure computation).
 *
 * ───────────────────────────────────────────────────────────
 * Architecture:
 *   1. Vision analysis runs ONCE per video  →  cached in Firestore
 *   2. enrichSegments() aligns vision data with transcript timestamps
 *   3. scoreSegments() computes query-specific relevance scores
 *   4. prepareSegmentsForLLM() formats enriched data for LLM consumption
 * ───────────────────────────────────────────────────────────
 */

// ─── Types ────────────────────────────────────────────────────

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

export interface VisionAnalysisData {
  scenes: { start: number; end: number; id: number }[];
  labels: {
    label: string;
    confidence: number;
    timeRanges: { start: number; end: number }[];
  }[];
  objects: {
    object: string;
    confidence: number;
    timeRange: { start: number; end: number };
  }[];
  faceTracks: { start: number; end: number }[];
  speakerTracks?: { id: number; ranges: { start: number; end: number }[] }[];
  analyzedAt: string;
}

export interface EnrichedSegment {
  index: number;
  start: number;
  end: number;
  transcriptText: string;
  labels: string[];
  talkingHeadScore: number; // 0-1: fraction of segment with face visible
  productPresenceScore: number; // 0-1: product-related label coverage
  motionScore: number; // 0-1: scene change density within segment
  sceneId: number; // primary scene containing this segment
}

export interface ScoredSegment extends EnrichedSegment {
  transcriptRelevance: number; // 0-1
  visualRelevance: number; // 0-1
  combinedScore: number; // 0-1 weighted combination
}

export interface ScoringWeights {
  transcript: number;
  visual: number;
  productPresence: number;
  talkingHead: number;
}

export interface LLMSegment {
  index: number;
  start: number;
  end: number;
  text: string;
  labels: string;
  scores: string;
  visualContext: string;
}

// ─── Constants ────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: ScoringWeights = {
  transcript: 0.5,
  visual: 0.25,
  productPresence: 0.15,
  talkingHead: 0.1,
};

/** Labels commonly associated with tech products */
const PRODUCT_LABELS = new Set([
  'phone',
  'smartphone',
  'mobile phone',
  'cell phone',
  'mobile device',
  'camera',
  'digital camera',
  'lens',
  'photography',
  'photograph',
  'laptop',
  'computer',
  'tablet',
  'ipad',
  'notebook',
  'display',
  'screen',
  'monitor',
  'television',
  'tv',
  'device',
  'gadget',
  'electronic device',
  'electronics',
  'technology',
  'battery',
  'charger',
  'cable',
  'adapter',
  'connector',
  'box',
  'package',
  'packaging',
  'unboxing',
  'cardboard',
  'headphone',
  'earphone',
  'speaker',
  'microphone',
  'audio',
  'watch',
  'smartwatch',
  'wearable',
  'keyboard',
  'mouse',
  'controller',
  'remote',
  'chip',
  'processor',
  'circuit board',
]);

/** Common stop words filtered from query keywords */
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  'is',
  'was',
  'are',
  'were',
  'been',
  'be',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'can',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'my',
  'your',
  'his',
  'her',
  'our',
  'their',
  'what',
  'which',
  'who',
  'when',
  'where',
  'how',
  'not',
  'no',
  'yes',
  'all',
  'any',
  'some',
  'such',
  'only',
  'just',
  'also',
  'very',
  'much',
  'more',
  'most',
  'than',
  'then',
  'so',
  'get',
  'show',
  'find',
  'extract',
  'give',
  'me',
  'clips',
  'clip',
  'part',
  'parts',
  'section',
  'sections',
  'segment',
  'video',
  'about',
  'related',
]);

// ─── Utility Functions ────────────────────────────────────────

/** Check if two time ranges overlap */
function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Calculate what fraction of [segStart, segEnd] is covered by [trackStart, trackEnd] */
function overlapFraction(
  segStart: number,
  segEnd: number,
  trackStart: number,
  trackEnd: number
): number {
  const segDuration = segEnd - segStart;
  if (segDuration <= 0) return 0;
  const overlapStart = Math.max(segStart, trackStart);
  const overlapEnd = Math.min(segEnd, trackEnd);
  const overlap = Math.max(0, overlapEnd - overlapStart);
  return overlap / segDuration;
}

/** Extract meaningful keywords from a query string */
export function extractQueryKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

// ─── Core Functions ───────────────────────────────────────────

/**
 * Enrich transcript segments with vision analysis data.
 *
 * For each transcript segment, aligns visual metadata based on
 * timestamp overlap:
 *   - Labels: which content labels are visible during the segment
 *   - Talking head: fraction of segment with a face visible
 *   - Product presence: proportion of labels that are product-related
 *   - Motion: scene change density within the segment
 *   - Scene ID: which scene contains the segment midpoint
 *
 * Runs entirely client-side — no API calls needed.
 */
export function enrichSegments(
  transcriptSegments: TranscriptSegment[],
  vision: VisionAnalysisData
): EnrichedSegment[] {
  return transcriptSegments.map((seg, i) => {
    const segStart = seg.start;
    const segEnd = seg.end;
    const segDuration = segEnd - segStart;

    // ── 1. Find labels present during this segment ──
    const segLabels = new Set<string>();

    for (const label of vision.labels) {
      for (const tr of label.timeRanges) {
        if (rangesOverlap(segStart, segEnd, tr.start, tr.end)) {
          segLabels.add(label.label.toLowerCase());
          break;
        }
      }
    }

    // Also add object labels
    for (const obj of vision.objects) {
      if (
        rangesOverlap(
          segStart,
          segEnd,
          obj.timeRange.start,
          obj.timeRange.end
        )
      ) {
        segLabels.add(obj.object.toLowerCase());
      }
    }

    // ── 2. Talking head score ──
    // Max face track overlap with this segment (0-1)
    let maxFaceOverlap = 0;
    for (const track of vision.faceTracks) {
      const frac = overlapFraction(
        segStart,
        segEnd,
        track.start,
        track.end
      );
      maxFaceOverlap = Math.max(maxFaceOverlap, frac);
    }

    // ── 3. Product presence score ──
    const labelArr = Array.from(segLabels);
    let productMatchCount = 0;
    for (const l of labelArr) {
      for (const pl of PRODUCT_LABELS) {
        if (l.includes(pl) || pl.includes(l)) {
          productMatchCount++;
          break;
        }
      }
    }
    // Score: base proportion + bonus if any product label found
    const productPresenceScore =
      labelArr.length > 0
        ? Math.min(
            1,
            productMatchCount / Math.max(1, labelArr.length) +
              (productMatchCount > 0 ? 0.3 : 0)
          )
        : 0;

    // ── 4. Motion score: scene change density ──
    let sceneChanges = 0;
    for (const scene of vision.scenes) {
      if (scene.start > segStart && scene.start < segEnd) {
        sceneChanges++;
      }
    }
    // Normalize: more scene changes per second = higher motion
    const motionScore =
      segDuration > 0
        ? Math.min(1, sceneChanges / Math.max(1, segDuration / 3))
        : 0;

    // ── 5. Primary scene ID ──
    const segMid = (segStart + segEnd) / 2;
    let sceneId = 0;
    for (const scene of vision.scenes) {
      if (segMid >= scene.start && segMid <= scene.end) {
        sceneId = scene.id;
        break;
      }
    }

    return {
      index: i,
      start: segStart,
      end: segEnd,
      transcriptText: seg.text.trim(),
      labels: labelArr,
      talkingHeadScore: Math.round(maxFaceOverlap * 100) / 100,
      productPresenceScore:
        Math.round(productPresenceScore * 100) / 100,
      motionScore: Math.round(motionScore * 100) / 100,
      sceneId,
    };
  });
}

/**
 * Score enriched segments for relevance to a user query.
 *
 * Combines:
 *   - Transcript keyword matching (primary signal)
 *   - Visual label keyword matching (supporting signal)
 *   - Product presence score
 *   - Talking head score
 *
 * Formula:
 *   combined = w_t × transcriptRelevance
 *            + w_v × visualRelevance
 *            + w_p × productPresenceScore
 *            + w_h × talkingHeadScore
 *
 * Weights are configurable for iterative tuning.
 */
export function scoreSegments(
  enrichedSegments: EnrichedSegment[],
  query: string,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ScoredSegment[] {
  const keywords = extractQueryKeywords(query);

  if (keywords.length === 0) {
    // No meaningful keywords — return segments with neutral scores
    return enrichedSegments.map((seg) => ({
      ...seg,
      transcriptRelevance: 0,
      visualRelevance: 0,
      combinedScore: 0,
    }));
  }

  return enrichedSegments.map((seg) => {
    // Transcript relevance: what fraction of query keywords appear in text
    const lowerText = seg.transcriptText.toLowerCase();
    const textMatches = keywords.filter((kw) => lowerText.includes(kw));
    const transcriptRelevance = textMatches.length / keywords.length;

    // Visual relevance: what fraction of query keywords appear in labels
    const labelStr = seg.labels.join(' ').toLowerCase();
    const labelMatches = keywords.filter((kw) => labelStr.includes(kw));
    const visualRelevance = labelMatches.length / keywords.length;

    // Combined weighted score
    const rawCombined =
      weights.transcript * transcriptRelevance +
      weights.visual * visualRelevance +
      weights.productPresence * seg.productPresenceScore +
      weights.talkingHead * seg.talkingHeadScore;
    const combinedScore = Math.min(1, rawCombined);

    return {
      ...seg,
      transcriptRelevance: Math.round(transcriptRelevance * 100) / 100,
      visualRelevance: Math.round(visualRelevance * 100) / 100,
      combinedScore: Math.round(combinedScore * 100) / 100,
    };
  });
}

/**
 * Format scored segments into a concise summary for LLM consumption.
 *
 * Each segment is reduced to:
 *   - text, timestamps
 *   - top 5 visual labels
 *   - relevance scores
 *   - visual context flags (talking_head, product_visible, high_motion)
 *
 * This keeps the LLM token count manageable while providing
 * multimodal context for better clip selection.
 */
export function prepareSegmentsForLLM(
  scoredSegments: ScoredSegment[]
): LLMSegment[] {
  return scoredSegments.map((seg) => ({
    index: seg.index,
    start: seg.start,
    end: seg.end,
    text: seg.transcriptText,
    labels: seg.labels.slice(0, 5).join(', ') || 'none',
    scores: `transcript=${seg.transcriptRelevance} visual=${seg.visualRelevance} combined=${seg.combinedScore}`,
    visualContext:
      [
        seg.talkingHeadScore > 0.5 ? 'talking_head' : null,
        seg.productPresenceScore > 0.3 ? 'product_visible' : null,
        seg.motionScore > 0.5 ? 'high_motion' : null,
      ]
        .filter(Boolean)
        .join(', ') || 'none',
  }));
}
