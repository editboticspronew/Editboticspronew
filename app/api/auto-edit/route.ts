import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auto-edit
 *
 * Takes AI analysis results + transcript segments + video type,
 * and uses LLM to generate structured clip definitions for an
 * auto-edited final video. The frontend then uses FFmpeg WASM to
 * clip and merge the video.
 *
 * This turns AddVideoDialog's text recommendations into actionable
 * edit commands — producing a final video instead of just text.
 */

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

interface SceneInfo {
  start: number;
  end: number;
  description: string;
}

interface LabelInfo {
  label: string;
  confidence: number;
  timeRanges: { start: number; end: number }[];
}

interface KeyMoment {
  time: number;
  reason: string;
}

interface AnalysisData {
  scenes: SceneInfo[];
  labels: LabelInfo[];
  detectedText: { text: string; timeRanges: { start: number; end: number }[] }[];
  objects: { object: string; appearances: number }[];
  faces: number;
  explicitContent: boolean;
  keyMoments: KeyMoment[];
  summary?: {
    overview: string;
    mainTopic: string;
    speakers: string;
    keyPoints: string[];
  };
}

/** Clip definition returned to frontend */
interface AutoEditClip {
  index: number;
  start: number;
  end: number;
  duration: number;
  reason: string;
  type: 'keep' | 'highlight';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      analysis,             // AI analysis results with scenes, labels, keyMoments
      transcriptionSegments, // Transcript segments with timestamps
      videoType,            // Video type: news, long-short, edit, critique, training
      recommendations,      // AI text recommendations
      videoDuration,        // Total video duration in seconds
    } = body;

    if (!analysis || !transcriptionSegments || !Array.isArray(transcriptionSegments)) {
      return NextResponse.json(
        { error: 'Analysis results and transcription segments are required' },
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

    console.log(`🎬 Auto-Edit — Generating edit commands`);
    console.log(`   Video type: ${videoType || 'general'}`);
    console.log(`   Segments: ${transcriptionSegments.length}`);
    console.log(`   Scenes: ${analysis.scenes?.length || 0}`);
    console.log(`   Labels: ${analysis.labels?.length || 0}`);

    // Build video type-specific editing guidance
    const typeGuidance = getTypeGuidance(videoType || 'edit');

    // Build context from analysis
    const analysisContext = buildAnalysisContext(analysis);

    // Build segments list with timestamps
    const segmentsForLLM = transcriptionSegments.map((seg: TranscriptSegment, i: number) => ({
      index: i,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    }));

    // Calculate estimated video duration from segments if not provided
    const estDuration = videoDuration ||
      (transcriptionSegments.length > 0
        ? transcriptionSegments[transcriptionSegments.length - 1].end
        : 0);

    const llmPrompt = `You are an expert video editor. Your task is to analyze a video's transcript and AI analysis data, then produce structured edit commands that will create a polished final video.

VIDEO TYPE: ${videoType || 'general edit'}
${typeGuidance}

ESTIMATED VIDEO DURATION: ${estDuration.toFixed(1)}s

${analysisContext}

${recommendations ? `AI EDITING RECOMMENDATIONS (reference):\n${recommendations.slice(0, 1500)}\n` : ''}

TRANSCRIPTION SEGMENTS:
${JSON.stringify(segmentsForLLM, null, 2)}

INSTRUCTIONS:
You must decide which parts of the video to KEEP in the final edit. Think like a professional editor:

1. **Remove dead air / filler**: Skip long pauses, "um"s, "uh"s, repeated false starts
2. **Keep the best content**: Select segments with the most engaging, informative, or entertaining content
3. **Respect scene boundaries**: Prefer cutting at scene changes (listed in analysis) rather than mid-sentence
4. **Maintain narrative flow**: Ensure the selected clips tell a coherent story when played in sequence
5. **Optimize pacing**: Remove unnecessarily slow sections but keep important context
6. **Highlight key moments**: Include all key moments identified in the analysis
7. **Type-specific editing**: Apply the video type guidance above

Return a JSON array of clip objects. Each clip defines a section to KEEP:
- index: sequential number starting from 1
- start: start time in seconds
- end: end time in seconds  
- reason: brief explanation of why this section is kept
- type: "keep" (standard content) or "highlight" (key moment / important section)

IMPORTANT:
- Clips must be in chronological order
- Clips must NOT overlap
- Leave at least 0.5s gap between clips (for transitions)
- Aim to keep 60-80% of original content for "edit" type, 20-40% for "long-short"
- For "news" type, keep the most newsworthy segments (40-60%)
- For "critique" type, keep analysis/opinion segments (50-70%)
- For "training" type, keep instructional content (70-90%)
- Return ONLY valid JSON array, no markdown or explanation

RESPONSE (JSON array only):`;

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
            content: 'You are an expert video editor AI. You respond ONLY with valid JSON arrays of clip definitions. No markdown, no explanation, just the JSON array. Your edits are professional, maintaining narrative flow and pacing.',
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
        { error: 'Failed to generate edit commands with AI' },
        { status: 500 }
      );
    }

    const llmResult = await llmResponse.json();
    const llmContent = llmResult.choices?.[0]?.message?.content?.trim() || '[]';

    let editClips: AutoEditClip[];
    try {
      const cleaned = llmContent
        .replace(/```json?\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      editClips = JSON.parse(cleaned);
    } catch {
      console.error('❌ Failed to parse LLM response:', llmContent);
      return NextResponse.json(
        { error: 'AI returned invalid response. Please try again.' },
        { status: 500 }
      );
    }

    if (!Array.isArray(editClips) || editClips.length === 0) {
      return NextResponse.json({
        success: true,
        clips: [],
        message: 'AI could not determine edit points. The video may not need editing.',
      });
    }

    // Post-process: snap to scene boundaries if available
    const scenes = analysis.scenes || [];
    if (scenes.length > 0) {
      for (const clip of editClips) {
        clip.start = snapToScene(clip.start, scenes, 'start');
        clip.end = snapToScene(clip.end, scenes, 'end');
      }
    }

    // Ensure no overlaps and proper ordering
    editClips.sort((a, b) => a.start - b.start);
    for (let i = 1; i < editClips.length; i++) {
      if (editClips[i].start < editClips[i - 1].end + 0.1) {
        editClips[i].start = editClips[i - 1].end + 0.1;
      }
    }

    // Re-calculate durations and indices
    const finalClips = editClips
      .filter(c => c.end > c.start + 0.5) // Remove clips shorter than 0.5s
      .map((clip, i) => ({
        index: i + 1,
        start: Math.round(clip.start * 100) / 100,
        end: Math.round(clip.end * 100) / 100,
        duration: Math.round((clip.end - clip.start) * 100) / 100,
        reason: clip.reason || 'Selected by AI',
        type: clip.type || 'keep',
        // These fields are needed by clipVideo
        segmentCount: 1,
        transcript: '',
        reasons: [clip.reason || 'Selected by AI'],
      }));

    const totalKeptDuration = finalClips.reduce((sum, c) => sum + c.duration, 0);
    const keepPercent = estDuration > 0
      ? Math.round((totalKeptDuration / estDuration) * 100)
      : 0;

    console.log(`   ✅ Generated ${finalClips.length} edit clips`);
    console.log(`   ✅ Keeping ${totalKeptDuration.toFixed(1)}s / ${estDuration.toFixed(1)}s (${keepPercent}%)`);

    return NextResponse.json({
      success: true,
      clips: finalClips,
      stats: {
        originalDuration: estDuration,
        editedDuration: totalKeptDuration,
        keepPercent,
        clipsCount: finalClips.length,
        highlightCount: finalClips.filter(c => c.type === 'highlight').length,
      },
    });
  } catch (error: any) {
    console.error('❌ Auto-edit error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── Helper Functions ──────────────────────────────────────────

function getTypeGuidance(videoType: string): string {
  switch (videoType) {
    case 'news':
      return `EDITING STYLE: News/Report
- Focus on the most newsworthy and informative segments
- Keep a fast pace with tight cuts
- Remove filler, small talk, and off-topic tangents
- Prioritize facts, quotes, and key statements
- Target: 40-60% of original content`;

    case 'long-short':
      return `EDITING STYLE: Long-to-Short Form
- Create a highly condensed, engaging short-form video
- Keep ONLY the most impactful, viral-worthy moments
- Remove all filler, tangents, and slow sections
- Prioritize hooks, punchlines, key reveals, and emotional peaks
- Target: 20-40% of original content (aim for under 60 seconds if possible)`;

    case 'edit':
      return `EDITING STYLE: General Edit / Polish
- Clean up the video by removing mistakes, pauses, and filler
- Maintain the original narrative structure
- Improve pacing without losing important content
- Remove false starts, "um"s, long pauses, and repeated content
- Target: 60-80% of original content`;

    case 'critique':
      return `EDITING STYLE: Review/Critique
- Focus on analytical and opinion segments
- Keep product demonstrations and comparisons
- Remove tangential stories and unrelated asides
- Prioritize pros/cons, ratings, and final verdicts
- Target: 50-70% of original content`;

    case 'training':
      return `EDITING STYLE: Training/Tutorial
- Keep ALL instructional content — every step matters
- Remove only filler, mistakes, and repeated explanations
- Maintain logical flow of instructions
- Keep demonstrations and examples
- Target: 70-90% of original content`;

    default:
      return `EDITING STYLE: General
- Create a clean, well-paced edit
- Remove filler and improve flow
- Target: 60-80% of original content`;
  }
}

function buildAnalysisContext(analysis: AnalysisData): string {
  const parts: string[] = [];

  if (analysis.scenes?.length > 0) {
    parts.push(`SCENE BOUNDARIES (${analysis.scenes.length} scenes):`);
    analysis.scenes.forEach((s, i) => {
      parts.push(`  Scene ${i + 1}: ${s.start.toFixed(1)}s — ${s.end.toFixed(1)}s ${s.description || ''}`);
    });
  }

  if (analysis.labels?.length > 0) {
    parts.push(`\nCONTENT LABELS (top ${Math.min(15, analysis.labels.length)}):`);
    analysis.labels.slice(0, 15).forEach(l => {
      parts.push(`  - ${l.label} (${(l.confidence * 100).toFixed(0)}%)`);
    });
  }

  if (analysis.keyMoments?.length > 0) {
    parts.push(`\nKEY MOMENTS (${analysis.keyMoments.length}):`);
    analysis.keyMoments.forEach(m => {
      parts.push(`  - ${m.time.toFixed(1)}s: ${m.reason}`);
    });
  }

  if (analysis.summary) {
    parts.push(`\nVIDEO SUMMARY:`);
    if (analysis.summary.overview) parts.push(`  Overview: ${analysis.summary.overview}`);
    if (analysis.summary.mainTopic) parts.push(`  Main Topic: ${analysis.summary.mainTopic}`);
    if (analysis.summary.keyPoints?.length > 0) {
      parts.push(`  Key Points: ${analysis.summary.keyPoints.join('; ')}`);
    }
  }

  if (analysis.faces > 0) {
    parts.push(`\nFACES DETECTED: ${analysis.faces}`);
  }

  return parts.join('\n');
}

function snapToScene(
  timestamp: number,
  scenes: SceneInfo[],
  edgeType: 'start' | 'end',
  maxSnap: number = 2.0
): number {
  let best = timestamp;
  let bestDist = Infinity;

  for (const scene of scenes) {
    const edge = edgeType === 'start' ? scene.start : scene.end;
    const dist = Math.abs(edge - timestamp);
    if (dist < bestDist && dist <= maxSnap) {
      bestDist = dist;
      best = edge;
    }
  }
  return best;
}
