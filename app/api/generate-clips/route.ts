import { NextRequest, NextResponse } from 'next/server';

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
}

interface MergedClip {
  start: number;
  end: number;
  segments: IdentifiedSegment[];
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
      paddingSeconds = 1.5,
      mergeGapSeconds = 3,
      enrichedSegments,   // Optional: vision-enriched segments for multimodal selection
    } = body;

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
    console.log(`   Segments: ${segments.length}`);
    console.log(`   Vision enrichment: ${enrichedSegments ? 'YES' : 'NO'}`);

    // ──────────────────────────────────────────────
    // Step 1: Use LLM to identify relevant segments
    // ──────────────────────────────────────────────

    const useMultimodal = Array.isArray(enrichedSegments) && enrichedSegments.length > 0;

    let llmPrompt: string;

    if (useMultimodal) {
      // ── Enhanced multimodal prompt with vision data ──
      const enrichedForLLM = (enrichedSegments as LLMEnrichedSegment[]).map((seg) => ({
        index: seg.index,
        start: seg.start,
        end: seg.end,
        text: seg.text,
        visualLabels: seg.labels,
        scores: seg.scores,
        visualContext: seg.visualContext,
      }));

      llmPrompt = `You are a video editor assistant with access to BOTH transcript text AND visual analysis data for each segment. Use both signals to identify the most relevant segments.

USER REQUEST: "${userQuery}"

ENRICHED SEGMENTS (transcript + visual analysis):
${JSON.stringify(enrichedForLLM, null, 2)}

INSTRUCTIONS:
- Select segments that are relevant to the user's request
- Use BOTH the transcript text AND visual labels/context to determine relevance
- A segment is MORE relevant when:
  • The transcript text mentions the requested topic (high transcript score)
  • Visual labels match the topic (e.g., "camera" label for a camera review request)
  • Product is visible (product_visible in visualContext)
  • A talking head is present when someone is explaining/reviewing (talking_head in visualContext)
- Prefer segments with HIGH combined scores
- Include surrounding context segments (intro/outro to the topic)
- Be inclusive — better to include slightly extra content than cut important parts
- Return ONLY a JSON array of objects with: index, start, end, text, relevance (brief reason including both text and visual evidence)
- If no segments match, return an empty array []
- Return ONLY valid JSON, no markdown or explanation

RESPONSE (JSON array only):`;
    } else {
      // ── Standard transcript-only prompt ──
      const segmentsForLLM = segments.map((seg: TranscriptSegment, i: number) => ({
        index: i,
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      }));

      llmPrompt = `You are a video editor assistant. Given a list of transcription segments with timestamps, identify which segments are relevant to the user's request.

USER REQUEST: "${userQuery}"

TRANSCRIPTION SEGMENTS:
${JSON.stringify(segmentsForLLM, null, 2)}

INSTRUCTIONS:
- Select segments that are relevant to the user's request
- Include segments that provide context (intro/outro to the topic)
- Be inclusive rather than exclusive — it's better to include slightly extra content than to cut important parts
- Return ONLY a JSON array of objects with: index, start, end, text, relevance (brief reason why this segment is relevant)
- If no segments match, return an empty array []
- Return ONLY valid JSON, no markdown or explanation

RESPONSE (JSON array only):`;
    }

    const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: useMultimodal
              ? 'You are a precise video editing assistant with access to both transcript and visual analysis data. You respond ONLY with valid JSON arrays. No markdown, no explanation, just the JSON array. Use both text content and visual signals (labels, product visibility, talking head presence) to select the most relevant segments.'
              : 'You are a precise video editing assistant. You respond ONLY with valid JSON arrays. No markdown, no explanation, just the JSON array.',
          },
          { role: 'user', content: llmPrompt },
        ],
        temperature: 0.3,
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

    let identifiedSegments: IdentifiedSegment[];
    try {
      const cleaned = llmContent
        .replace(/```json?\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      identifiedSegments = JSON.parse(cleaned);
    } catch {
      console.error('❌ Failed to parse LLM response:', llmContent);
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

    console.log(`   ✅ Found ${identifiedSegments.length} relevant segments`);

    // ──────────────────────────────────────────────
    // Step 2: Merge adjacent/close segments into clips
    // ──────────────────────────────────────────────
    identifiedSegments.sort((a, b) => a.start - b.start);

    const mergedClips: MergedClip[] = [];
    let currentClip: MergedClip | null = null;

    for (const seg of identifiedSegments) {
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

    return NextResponse.json({
      success: true,
      query: userQuery,
      totalSegmentsAnalyzed: segments.length,
      relevantSegmentsFound: identifiedSegments.length,
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
