/**
 * Simplified Video Analysis using ONLY OpenAI (no Google Cloud needed)
 * This is cheaper, simpler, and doesn't require service account setup
 */

import { storage } from '@/lib/firebase/init';
import { ref, getDownloadURL } from 'firebase/storage';
import { OPENAI_API_KEY } from '@/lib/config/constants';

interface SimpleAnalysisResult {
  summary: {
    overview: string;
    mainTopic: string;
    speakers: string;
    keyPoints: Array<string>;
  };
  scenes: Array<{ timestamp: string; description: string; recommendation: string }>;
  suggestions: {
    cuts: Array<{ time: string; reason: string }>;
    textOverlays: Array<{ time: string; text: string; reason: string }>;
    improvements: Array<{ category: string; suggestion: string }>;
    highlights: Array<{ time: string; reason: string }>;
  };
}

/**
 * Extract frames from video at intervals
 * This would need to be done client-side or with a video processing library
 */
async function extractVideoFrames(videoUrl: string, intervalSeconds: number = 2): Promise<string[]> {
  // For now, return empty array - this requires video processing
  // In production, you'd use canvas to extract frames or a server-side solution
  console.log('Frame extraction would happen here for:', videoUrl);
  return [];
}

/**
 * Analyze video using ONLY OpenAI GPT-4 Vision
 * Much simpler than Google Cloud approach
 */
export async function analyzeVideoSimple(
  videoUrl: string,
  videoName: string,
  transcript?: string,
  duration?: number
): Promise<SimpleAnalysisResult> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  // TEXT-ONLY MODEL: Require transcript to prevent hallucination
  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcript is required for text-based AI analysis. The AI cannot see video content and would generate fake/hallucinated responses without a transcript.');
  }

  // Build analysis prompt based on available data
  const prompt = buildSimpleAnalysisPrompt(videoName, transcript, duration);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Using gpt-4o-mini (cheaper and faster than gpt-4)
      messages: [
        {
          role: 'system',
          content: `You are a professional video editing AI assistant. Analyze video information and provide specific, actionable editing recommendations. Always include timestamps in MM:SS format.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('OpenAI API error:', errorData);
    throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);

  return result as SimpleAnalysisResult;
}

/**
 * Build analysis prompt
 */
function buildSimpleAnalysisPrompt(
  videoName: string,
  transcript?: string,
  duration?: number
): string {
  const durationMin = duration ? Math.floor(duration / 60) : 0;
  const durationSec = duration ? Math.floor(duration % 60) : 0;

  return `
# Video Editing Analysis Request

**Video:** ${videoName}
${duration ? `**Duration:** ${durationMin}:${String(durationSec).padStart(2, '0')}` : ''}

## Transcript
\`\`\`
${transcript}
\`\`\`

---

**IMPORTANT:** You are analyzing ONLY the transcript above. You cannot see the video itself. Base your analysis ONLY on what is said in the transcript. 

- If speakers are not identifiable from the transcript, say "Not specified in transcript"
- Do not make up fictional names or information
- Only suggest text overlays/cuts based on actual content in the transcript

Provide a detailed editing report in JSON format with this structure:

{
  "summary": {
    "overview": "What this video discusses based on the transcript",
    "mainTopic": "The primary subject discussed",
    "speakers": "Number of speakers or 'Not specified in transcript' if unknown",
    "keyPoints": ["Actual key points from the transcript"]
  },
  "scenes": [
    {
      "timestamp": "MM:SS",
      "description": "What happens in this section",
      "recommendation": "Specific editing suggestion"
    }
  ],
  "suggestions": {
    "cuts": [
      {
        "time": "MM:SS",
        "reason": "Why to cut/trim this part"
      }
    ],
    "textOverlays": [
      {
        "time": "MM:SS",
        "text": "Suggested overlay text",
        "reason": "Why add text here"
      }
    ],
    "improvements": [
      {
        "category": "audio|visual|pacing|structure",
        "suggestion": "Specific improvement"
      }
    ],
    "highlights": [
      {
        "time": "MM:SS",
        "reason": "Why this is a key moment"
      }
    ]
  }
}

Focus on:
1. **Content Summary** - What's the video about, who's in it, what are they discussing
2. **Pacing** - Identify slow/boring parts to cut
3. **Engagement** - Where to add text, graphics, emphasis
4. **Structure** - Scene order and flow
5. **Technical** - Audio, visual quality issues
6. **Key Moments** - Highlights to emphasize

Provide specific timestamps and actionable items. Be concise and practical.
`;
}

/**
 * Generate user-friendly report from analysis
 */
export function formatAnalysisReport(analysis: SimpleAnalysisResult): string {
  let report = `# Video Editing Report\n\n`;
  
  // Summary Section
  report += `## 📋 Video Summary\n\n`;
  report += `**Overview:** ${analysis.summary.overview}\n\n`;
  report += `**Main Topic:** ${analysis.summary.mainTopic}\n\n`;
  report += `**Speakers/Participants:** ${analysis.summary.speakers}\n\n`;
  
  if (analysis.summary.keyPoints.length > 0) {
    report += `**Key Points:**\n`;
    analysis.summary.keyPoints.forEach((point, i) => {
      report += `${i + 1}. ${point}\n`;
    });
    report += '\n';
  }

  if (analysis.suggestions.cuts.length > 0) {
    report += `## ✂️ Recommended Cuts (${analysis.suggestions.cuts.length})\n`;
    analysis.suggestions.cuts.forEach((cut, i) => {
      report += `${i + 1}. **${cut.time}** - ${cut.reason}\n`;
    });
    report += '\n';
  }

  if (analysis.suggestions.textOverlays.length > 0) {
    report += `## 📝 Text Overlay Suggestions (${analysis.suggestions.textOverlays.length})\n`;
    analysis.suggestions.textOverlays.forEach((text, i) => {
      report += `${i + 1}. **${text.time}** - "${text.text}"\n   ${text.reason}\n`;
    });
    report += '\n';
  }

  if (analysis.suggestions.highlights.length > 0) {
    report += `## ⭐ Key Moments (${analysis.suggestions.highlights.length})\n`;
    analysis.suggestions.highlights.forEach((highlight, i) => {
      report += `${i + 1}. **${highlight.time}** - ${highlight.reason}\n`;
    });
    report += '\n';
  }

  if (analysis.suggestions.improvements.length > 0) {
    report += `## 🎨 Improvements\n`;
    const grouped = analysis.suggestions.improvements.reduce((acc, imp) => {
      if (!acc[imp.category]) acc[imp.category] = [];
      acc[imp.category].push(imp.suggestion);
      return acc;
    }, {} as Record<string, string[]>);

    Object.entries(grouped).forEach(([category, suggestions]) => {
      report += `\n**${category.charAt(0).toUpperCase() + category.slice(1)}:**\n`;
      suggestions.forEach((s, i) => {
        report += `${i + 1}. ${s}\n`;
      });
    });
  }

  return report;
}
