import { NextRequest, NextResponse } from 'next/server';
import {
  compressForTokenBudget,
  compressAnalysisContext,
  estimateTokens,
  chunkSegmentsForSummary,
  buildChunkSummaryPrompt,
  mergeChunkSummaries,
} from '@/lib/ai/tokenManager';

/**
 * POST /api/auto-edit
 *
 * Takes AI analysis results + transcript segments + video type,
 * and uses LLM to generate structured clip definitions for an
 * auto-edited final video. The frontend then uses FFmpeg WASM to
 * clip and merge the video.
 *
 * Token management: Uses progressive compression (4 levels) to handle
 * long videos. For very large transcripts, switches to two-pass
 * summarization before generating the edit plan.
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

/** Clip definition returned to frontend — now with narrative purpose */
interface AutoEditClip {
  index: number;
  start: number;
  end: number;
  duration: number;
  reason: string;
  type: 'keep' | 'highlight';      // backward compat
  purpose?: 'intro' | 'context' | 'key_moment' | 'transition' | 'conclusion' | 'highlight';
}

/** Rich LLM response following PM's edit_plan_schema */
interface CreativeEditPlan {
  video_summary: string;
  recommended_program_type: string;
  editing_recommendations: string[];
  edit_plan: Array<{
    start: number;
    end: number;
    purpose: string;
    reason: string;
  }>;
  platform_versions?: {
    youtube?: { suggested: boolean; notes: string };
    tiktok?: { suggested: boolean; notes: string };
    instagram_reels?: { suggested: boolean; notes: string };
  };
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
      previewOnly,          // If true, return built prompt without calling LLM
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

    // Compress analysis context with token budget awareness
    const { compressed: analysisContext, estimatedTokens: analysisTokens } =
      compressAnalysisContext(analysis, 6000);

    // Calculate estimated video duration from segments if not provided
    const estDuration = videoDuration ||
      (transcriptionSegments.length > 0
        ? transcriptionSegments[transcriptionSegments.length - 1].end
        : 0);

    // Estimate how many tokens the prompt template uses (without segments)
    const promptTemplateTokens = estimateTokens(typeGuidance)
      + analysisTokens
      + estimateTokens(recommendations?.slice(0, 1500) || '')
      + 1500; // base instructions + formatting overhead

    // ── Token-aware segment compression ──
    const segmentsWithText = transcriptionSegments.map((seg: TranscriptSegment, i: number) => ({
      index: i,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    }));

    const compressionResult = compressForTokenBudget(segmentsWithText, {
      model: 'gpt-4o-mini',
      systemPromptTokens: promptTemplateTokens + 200, // +200 for system message
      analysisContextTokens: analysisTokens,
    });

    console.log(`   📊 Token compression: Level ${compressionResult.compressionLevel} — ${compressionResult.note}`);

    // ── Handle two-pass mode for very large transcripts ──
    let segmentsForLLM: any[];
    let twoPassSummary: string | null = null;

    if (compressionResult.needsTwoPass) {
      console.log(`   🔄 Two-pass mode: Summarizing ${transcriptionSegments.length} segments in chunks...`);
      twoPassSummary = await runTwoPassSummarization(
        transcriptionSegments,
        videoType || 'edit',
        apiKey
      );
      // In two-pass mode, we don't send raw segments — just the summary
      segmentsForLLM = [];
    } else {
      segmentsForLLM = compressionResult.segments;
    }

    // ── Build LLM prompt ──
    const segmentsBlock = twoPassSummary
      ? `CONDENSED VIDEO ANALYSIS (two-pass summarization — original had ${transcriptionSegments.length} segments):\n${twoPassSummary}`
      : `TRANSCRIPTION SEGMENTS${compressionResult.compressionLevel > 0 ? ` (compressed — ${compressionResult.originalCount} total, showing ${compressionResult.segments.length}${compressionResult.droppedCount > 0 ? `, ${compressionResult.droppedCount} low-priority segments omitted` : ''})` : ''}:\n${JSON.stringify(segmentsForLLM, null, 2)}`;

    // Map old video types to PM's program types for backward compatibility
    const programType = mapToProgramType(videoType);

    const llmPrompt = `PROGRAM TYPE: ${programType}
VIDEO DURATION: ${estDuration.toFixed(1)}s

${analysisContext}

${recommendations ? `PREVIOUS AI RECOMMENDATIONS (reference):\n${recommendations.slice(0, 1500)}\n` : ''}

${segmentsBlock}

${typeGuidance}

ANALYSIS TASKS (perform these mentally before generating the edit plan):
1. Understand the overall subject and purpose of the footage
2. Identify the strongest spoken points in the transcript
3. Identify the most visually relevant or engaging scenes from the analysis data
4. Detect repetitive, weak, filler, or unnecessary sections
5. Determine what type of program the footage can best become

CREATIVE TASKS:
1. Build a logical structure: intro → context → key moments → conclusion
2. Select segments that contribute meaningfully to the final story — NOT just keyword matches
3. Recommend cuts, removals, pacing improvements
4. If the footage is weak, still extract the strongest possible structure from it
5. Do not rely only on chronological order if a better narrative can be created

SEGMENT SELECTION RULES:
- Select segments that contribute meaningfully to the final story or structure
- Avoid filler words, repeated points, dead air, weak introductions
- Do not select multiple segments that say the same thing unless each adds distinct value
- Use scene boundaries to prefer segments with stronger visual variety
- If a shorter version is needed, prioritize stronger moments first
- Narrative quality is more important than perfect arithmetic

RETURN a single JSON object with this exact structure:
{
  "video_summary": "1-2 sentence summary of what the footage is about",
  "recommended_program_type": "${programType}",
  "editing_recommendations": ["creative recommendation 1", "creative recommendation 2", ...],
  "edit_plan": [
    {
      "start": start_seconds,
      "end": end_seconds,
      "purpose": "intro | context | key_moment | transition | conclusion | highlight",
      "reason": "why this segment was selected"
    }
  ],
  "platform_versions": {
    "youtube": { "suggested": true/false, "notes": "how this should differ for YouTube" },
    "tiktok": { "suggested": true/false, "notes": "how this should differ for TikTok" },
    "instagram_reels": { "suggested": true/false, "notes": "how this should differ for Reels" }
  }
}

IMPORTANT:
- Clips in edit_plan must NOT overlap
- Leave at least 0.5s gap between clips (for transitions)
- Do not just return clips by topic matching — act like a skilled editor creating a better final video
- Return ONLY valid JSON, no markdown or explanation

RESPONSE (JSON only):`;

    // Final safety check — log total estimated tokens
    const totalEstimatedTokens = estimateTokens(llmPrompt) + 200; // +200 for system message
    console.log(`   📊 Final prompt: ~${totalEstimatedTokens.toLocaleString()} estimated tokens`);

    // ── Preview mode: return prompt without calling LLM ──
    if (previewOnly) {
      const systemMessage = `You are an expert AI video director, editor, and content producer.
Your goal is to understand footage, identify its strongest narrative and visual moments, and build a better final video.
Think like a real human editor and producer, not like a transcript search engine.
Prioritize: storytelling > clarity > viewer engagement > visual relevance > pace > program quality.
You respond ONLY with valid JSON objects. No markdown, no explanation, just the JSON.`;

      return NextResponse.json({
        success: true,
        preview: true,
        systemPrompt: systemMessage,
        userPrompt: llmPrompt,
        estimatedTokens: totalEstimatedTokens,
        compressionLevel: compressionResult.compressionLevel,
        compressionNote: compressionResult.note,
        programType,
        segmentCount: transcriptionSegments.length,
        twoPassUsed: compressionResult.needsTwoPass,
      });
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
            content: `You are an expert AI video director, editor, and content producer.
Your goal is to understand footage, identify its strongest narrative and visual moments, and build a better final video.
Think like a real human editor and producer, not like a transcript search engine.
Prioritize: storytelling > clarity > viewer engagement > visual relevance > pace > program quality.
You respond ONLY with valid JSON objects. No markdown, no explanation, just the JSON.`,
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

    // Parse the LLM response — handles both new schema (object) and legacy (array)
    let creativePlan: CreativeEditPlan | null = null;
    let editClips: AutoEditClip[];

    try {
      const cleaned = llmContent
        .replace(/```json?\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed)) {
        // Legacy format: LLM returned just an array of clips
        editClips = parsed;
      } else if (parsed.edit_plan && Array.isArray(parsed.edit_plan)) {
        // New PM schema: full creative edit plan
        creativePlan = parsed as CreativeEditPlan;
        editClips = creativePlan.edit_plan.map((clip, i) => ({
          index: i + 1,
          start: clip.start,
          end: clip.end,
          duration: clip.end - clip.start,
          reason: clip.reason || 'Selected by AI',
          type: (clip.purpose === 'highlight' || clip.purpose === 'key_moment') ? 'highlight' : 'keep',
          purpose: clip.purpose as AutoEditClip['purpose'],
        }));
        console.log(`   ✅ Received creative edit plan: ${creativePlan.edit_plan.length} clips, type: ${creativePlan.recommended_program_type}`);
        console.log(`   📝 Summary: ${creativePlan.video_summary}`);
        if (creativePlan.editing_recommendations?.length > 0) {
          console.log(`   💡 Recommendations: ${creativePlan.editing_recommendations.length} suggestions`);
        }
      } else {
        throw new Error('Unexpected response structure');
      }
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
        purpose: clip.purpose || (clip.type === 'highlight' ? 'key_moment' : 'context'),
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
      // New PM fields (if LLM returned creative plan)
      videoSummary: creativePlan?.video_summary || null,
      recommendedProgramType: creativePlan?.recommended_program_type || programType,
      editingRecommendations: creativePlan?.editing_recommendations || [],
      platformVersions: creativePlan?.platform_versions || null,
      // Clips with purpose field
      clips: finalClips,
      stats: {
        originalDuration: estDuration,
        editedDuration: totalKeptDuration,
        keepPercent,
        clipsCount: finalClips.length,
        highlightCount: finalClips.filter(c => c.type === 'highlight').length,
        purposeBreakdown: {
          intro: finalClips.filter(c => c.purpose === 'intro').length,
          context: finalClips.filter(c => c.purpose === 'context').length,
          key_moment: finalClips.filter(c => c.purpose === 'key_moment').length,
          transition: finalClips.filter(c => c.purpose === 'transition').length,
          conclusion: finalClips.filter(c => c.purpose === 'conclusion').length,
          highlight: finalClips.filter(c => c.purpose === 'highlight').length,
        },
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

// ─── PM Program Type Mapping ─────────────────────────────────────

/** Map legacy video types to PM's 9 program types */
function mapToProgramType(videoType: string): string {
  const mapping: Record<string, string> = {
    'news':     'news_package',
    'long-short': 'social_media_clip',
    'edit':     'youtube_video',
    'critique': 'review_video',
    'training': 'educational_video',
    // Direct PM types pass through
    'documentary': 'documentary',
    'news_package': 'news_package',
    'interview_highlight': 'interview_highlight',
    'review_video': 'review_video',
    'social_media_clip': 'social_media_clip',
    'youtube_video': 'youtube_video',
    'promo_video': 'promo_video',
    'story_video': 'story_video',
    'educational_video': 'educational_video',
  };
  return mapping[videoType] || 'youtube_video';
}

// ─── Helper Functions ──────────────────────────────────────────

function getTypeGuidance(videoType: string): string {
  const programType = mapToProgramType(videoType);

  switch (programType) {
    case 'documentary':
      return `PROGRAM TYPE: Documentary
STRUCTURE: hook → context → main development → important moments → conclusion
EDITING APPROACH:
- Open with the most compelling moment or statement to hook the viewer
- Provide context and background after the hook
- Develop the main narrative arc with supporting evidence and moments
- Build toward important revelations or emotional peaks
- Close with a strong conclusion or reflection
- Prefer visual variety — cut to different scenes when the visual stays static too long
- Target: 50-70% of original content`;

    case 'news_package':
      return `PROGRAM TYPE: News Package
STRUCTURE: intro → headline / key point → supporting details → strong visual or soundbite → closing
EDITING APPROACH:
- Lead with the most newsworthy fact or statement
- Follow with supporting details and context
- Include the strongest soundbite or visual moment
- Keep a fast pace — tight cuts, no dead air
- Remove all filler, small talk, and off-topic tangents
- Close with a summary or forward-looking statement
- Target: 40-60% of original content`;

    case 'interview_highlight':
      return `PROGRAM TYPE: Interview Highlight
STRUCTURE: best opening answer → strongest quote → supporting context → final key takeaway
EDITING APPROACH:
- Start with the most engaging question/answer exchange
- Feature the interviewee's strongest, most quotable statements
- Keep enough context so quotes don't feel out of context
- Remove interviewer's filler questions if answers stand alone
- Remove long pauses, "um"s, and false starts from the interviewee
- End with the most impactful takeaway or insight
- Target: 30-50% of original content`;

    case 'review_video':
      return `PROGRAM TYPE: Review / Critique Video
STRUCTURE: hook → product/subject overview → pros & cons → demonstration → final verdict
EDITING APPROACH:
- Open with a teaser of the final verdict or a surprising finding
- Provide a clear overview of what is being reviewed
- Organize around pros, cons, and comparisons
- Keep product demonstrations and visual evidence
- Cut tangential stories and unrelated asides
- End with a clear rating, recommendation, or final verdict
- Target: 50-70% of original content`;

    case 'social_media_clip':
      return `PROGRAM TYPE: Social Media Clip (Short Form)
STRUCTURE: strong hook → main point → visual highlight → fast ending
EDITING APPROACH:
- Open with the most attention-grabbing moment (first 3 seconds are critical)
- Get to the main point immediately — no slow build-up
- Keep ONLY the most impactful, viral-worthy moments
- Remove ALL filler, tangents, and slow sections
- Prioritize emotional peaks, reveals, punchlines, and visual surprises
- End abruptly or with a punchy conclusion — no drawn-out outros
- Target: 15-40% of original content (aim for under 60 seconds)`;

    case 'youtube_video':
      return `PROGRAM TYPE: YouTube Video
STRUCTURE: hook → context → main value → summary or call to action
EDITING APPROACH:
- Open with a hook that promises value (first 10 seconds matter most)
- Provide context so viewers understand what they'll learn or experience
- Deliver the main content with good pacing — remove dead spots
- Remove false starts, "um"s, long pauses, and repeated explanations
- Keep demonstrations, examples, and visual variety
- End with a clear summary or call to action
- Target: 60-80% of original content`;

    case 'promo_video':
      return `PROGRAM TYPE: Promotional Video
STRUCTURE: attention grab → value proposition → proof points → call to action
EDITING APPROACH:
- Open with the most visually striking or emotionally compelling moment
- Clearly communicate the value proposition early
- Use the strongest testimonials, demonstrations, or visual proof
- Keep energy and pace high throughout
- Remove anything that doesn't directly sell or persuade
- End with a clear, memorable call to action
- Target: 20-40% of original content`;

    case 'story_video':
      return `PROGRAM TYPE: Story / Narrative Video
STRUCTURE: opening → rising action → climax → resolution
EDITING APPROACH:
- Establish the setting and characters in the opening
- Build tension or interest through rising action
- Identify and emphasize the climactic moment
- Provide a satisfying resolution or conclusion
- Pacing should match the emotional arc — slower for tension, faster for excitement
- Prefer chronological order unless a non-linear structure creates more intrigue
- Target: 50-70% of original content`;

    case 'educational_video':
      return `PROGRAM TYPE: Educational / Tutorial Video
STRUCTURE: intro / preview → core concepts → examples → summary / recap
EDITING APPROACH:
- Preview what will be taught so viewers know the value
- Keep ALL instructional content — every step matters
- Remove only filler, mistakes, and repeated explanations
- Maintain logical flow of instruction — sequence matters
- Keep demonstrations, examples, and screen recordings
- End with a clear summary or recap of key points
- Target: 70-90% of original content`;

    default:
      return `PROGRAM TYPE: General Edit
EDITING APPROACH:
- Create a clean, well-paced edit from the available footage
- Remove filler, dead air, and repetitive content
- Maintain a logical narrative structure
- Identify and highlight the strongest moments
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

// ─── Two-Pass Summarization for Very Large Videos ────────────────

/**
 * When a video transcript is too large to fit in a single LLM call,
 * this function:
 *   Pass 1: Splits segments into chunks, summarizes each chunk with LLM
 *   Pass 2: Merges the summaries into a condensed representation
 *
 * The merged summary replaces the full transcript in the edit plan prompt,
 * fitting within the token budget while preserving the strongest moments.
 */
async function runTwoPassSummarization(
  segments: TranscriptSegment[],
  videoType: string,
  apiKey: string
): Promise<string> {
  const chunks = chunkSegmentsForSummary(
    segments.map((s, i) => ({ index: i, start: s.start, end: s.end, text: s.text })),
    50 // 50 segments per chunk
  );

  console.log(`   📦 Split into ${chunks.length} chunks for Pass 1 summarization`);

  // Process chunks sequentially to avoid rate limits
  // (could be parallelized with Promise.all for speed, but safer sequentially)
  const chunkResults: any[] = [];

  for (const chunk of chunks) {
    const summaryPrompt = buildChunkSummaryPrompt(chunk, videoType);

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
            {
              role: 'system',
              content: 'You are a video analysis assistant. Return ONLY valid JSON. No markdown.',
            },
            { role: 'user', content: summaryPrompt },
          ],
          temperature: 0.2,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        console.warn(`   ⚠️ Chunk ${chunk.chunkIndex} summarization failed: ${response.status}`);
        // Fallback: create a basic summary from the segment text
        chunkResults.push({
          section_summary: `Section ${chunk.startTime.toFixed(1)}s-${chunk.endTime.toFixed(1)}s (${chunk.segmentCount} segments)`,
          time_range: { start: chunk.startTime, end: chunk.endTime },
          strong_moments: [],
          overall_quality: 5,
        });
        continue;
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content?.trim() || '{}';

      try {
        const cleaned = content
          .replace(/```json?\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        const parsed = JSON.parse(cleaned);
        chunkResults.push(parsed);
        console.log(`   ✅ Chunk ${chunk.chunkIndex}: ${parsed.strong_moments?.length || 0} strong moments found`);
      } catch {
        console.warn(`   ⚠️ Chunk ${chunk.chunkIndex}: parse error, using fallback`);
        chunkResults.push({
          section_summary: `Section ${chunk.startTime.toFixed(1)}s-${chunk.endTime.toFixed(1)}s`,
          time_range: { start: chunk.startTime, end: chunk.endTime },
          strong_moments: [],
          overall_quality: 5,
        });
      }
    } catch (err: any) {
      console.warn(`   ⚠️ Chunk ${chunk.chunkIndex} network error: ${err.message}`);
      chunkResults.push({
        section_summary: `Section ${chunk.startTime.toFixed(1)}s-${chunk.endTime.toFixed(1)}s`,
        time_range: { start: chunk.startTime, end: chunk.endTime },
        strong_moments: [],
        overall_quality: 5,
      });
    }
  }

  // Merge all chunk summaries into a condensed representation
  const merged = mergeChunkSummaries(chunkResults);
  console.log(`   ✅ Pass 1 complete: merged ${chunkResults.length} chunk summaries (~${estimateTokens(merged).toLocaleString()} tokens)`);

  return merged;
}
