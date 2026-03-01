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
  priority?: number;
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
      silenceTrimming,     // Optional: trim filler words and silence
      redundancyElimination = true, // Optional: eliminate redundant segments (default on)
      hookFirstReorder,    // Optional: reorder clips so most impactful comes first
      audioEnergyPeaks,    // Optional: high-energy audio moments for engagement
      clipFeedback,        // Optional: previous clips with user feedback for regeneration
      speakerFocusRanges,  // Optional: time ranges for the focused speaker
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
    console.log(`   Duration constraint: ${durationConstraint || 'none'}`);
    console.log(`   Segments: ${segments.length}`);
    console.log(`   Vision enrichment: ${enrichedSegments ? 'YES' : 'NO'}`);
    console.log(`   Scene-snap: ${scenes?.length ? `YES (${scenes.length} scenes)` : 'NO'}`);
    console.log(`   Must-include: ${mustIncludeKeywords || 'none'}`);
    console.log(`   Exclude: ${excludeKeywords || 'none'}`);
    console.log(`   Silence trimming: ${silenceTrimming ? 'YES' : 'NO'}`);
    console.log(`   Redundancy elimination: ${redundancyElimination ? 'YES' : 'NO'}`);
    console.log(`   Hook-first reorder: ${hookFirstReorder ? 'YES' : 'NO'}`);
    console.log(`   Audio energy: ${Array.isArray(audioEnergyPeaks) && audioEnergyPeaks.length > 0 ? `YES (${audioEnergyPeaks.length} peaks)` : 'NO'}`);
    console.log(`   Feedback loop: ${clipFeedback?.previousClips?.length > 0 ? `YES (${clipFeedback.previousClips.length} clips rated)` : 'NO'}`);
    console.log(`   Speaker focus: ${Array.isArray(speakerFocusRanges) && speakerFocusRanges.length > 0 ? `YES (${speakerFocusRanges.length} ranges)` : 'NO'}`);

    // Build duration instruction if provided
    const durationInstruction = durationConstraint
      ? `\n\nDURATION CONSTRAINT: ${durationConstraint}\nIMPORTANT: The user wants the total combined duration of ALL selected clips to fit within this time constraint. Calculate the total duration of your selected segments (sum of end-start for each) and ensure it approximately matches the requested duration. Be selective — pick only the most relevant and impactful segments that fit within the time budget. If you must choose between segments, prefer the ones with the highest relevance to the user's query.`
      : '';

    // Build keyword boost/exclude instructions
    let keywordInstruction = '';
    if (mustIncludeKeywords?.trim()) {
      keywordInstruction += `\n\nMUST-INCLUDE KEYWORDS: ${mustIncludeKeywords.trim()}\nIMPORTANT: You MUST include segments that contain or relate to these keywords/topics. These are hard requirements — if a segment mentions any of these keywords, it should be selected regardless of other scoring.`;
    }
    if (excludeKeywords?.trim()) {
      keywordInstruction += `\n\nEXCLUDE KEYWORDS: ${excludeKeywords.trim()}\nIMPORTANT: Do NOT include segments that are primarily about these topics or keywords. If a segment's main subject matches an excluded keyword, skip it even if it partially overlaps with the user's query.`;
    }

    // Redundancy elimination instruction (togglable)
    const redundancyInstruction = redundancyElimination
      ? `\n\nREDUNDANCY ELIMINATION: If multiple segments cover the exact same topic, point, or repeated content, pick only the MOST concise and clear version. Do not include near-duplicate segments that restate the same information.`
      : '';

    // Silence & filler trimming instruction
    const silenceInstruction = silenceTrimming
      ? `\n\nSILENCE & FILLER TRIMMING: Exclude segments that are primarily filler words ("um", "uh", "like", "you know", "so", "basically"), long pauses, or dead air. When a segment contains filler at the start or end, tighten the start/end timestamps to skip the filler portion. Prefer clean, concise segments without verbal hesitations.`
      : '';

    // Hook-first reordering instruction
    const hookInstruction = hookFirstReorder
      ? `\n\nHOOK-FIRST REORDERING: Also assign each selected segment a "priority" field (integer 1-10, where 1 = most engaging/impactful moment that would make a great hook to grab viewer attention). Consider surprise reveals, emotional peaks, key insights, and provocative statements when scoring.`
      : '';

    // Audio energy detection instruction
    const audioEnergyInstruction = Array.isArray(audioEnergyPeaks) && audioEnergyPeaks.length > 0
      ? `\n\nAUDIO ENERGY PEAKS: High-energy audio moments detected at: ${audioEnergyPeaks.map((p: any) => `${p.time.toFixed(1)}s (level: ${(p.level * 100).toFixed(0)}%, ${p.type})`).join(', ')}\nPREFER segments that overlap with or are near these high-energy moments. Audio energy peaks often correspond to applause, laughter, excitement, emphasis, or audience reactions — these are typically the most engaging parts of the video. Give a significant relevance boost to segments within 5 seconds of a detected peak.`
      : '';

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

    // Speaker focus filter instruction
    const speakerFocusInstruction = Array.isArray(speakerFocusRanges) && speakerFocusRanges.length > 0
      ? `\n\nSPEAKER FOCUS: The user wants to focus on a specific speaker who appears during these time ranges: ${speakerFocusRanges.map((r: any) => `${r.start.toFixed(1)}s–${r.end.toFixed(1)}s`).join(', ')}\nSTRONGLY PREFER segments that overlap with these time ranges — they contain the speaker the user is interested in. Deprioritise segments outside these ranges unless they provide critical context.`
      : '';

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

USER REQUEST: "${userQuery}"${durationInstruction}${keywordInstruction}${redundancyInstruction}${silenceInstruction}${hookInstruction}${audioEnergyInstruction}${feedbackInstruction}${speakerFocusInstruction}

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

USER REQUEST: "${userQuery}"${durationInstruction}${keywordInstruction}${redundancyInstruction}${silenceInstruction}${hookInstruction}${audioEnergyInstruction}${feedbackInstruction}${speakerFocusInstruction}

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

    console.log(`\n📝 ── Final LLM Prompt (${llmPrompt.length} chars) ──`);
    console.log(llmPrompt);
    console.log(`📝 ── End of Prompt ──\n`);

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
    // Step 2b: Snap clip boundaries to scene edges
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
    // Step 2c: Hook-first reordering
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
