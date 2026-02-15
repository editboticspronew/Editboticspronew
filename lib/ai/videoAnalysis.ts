import { storage } from '@/lib/firebase/init';
import { ref, getDownloadURL } from 'firebase/storage';

// Google Cloud Video Intelligence API interfaces
interface VideoAnnotationResults {
  shotAnnotations?: ShotAnnotation[];
  labelAnnotations?: LabelAnnotation[];
  textAnnotations?: TextAnnotation[];
  objectAnnotations?: ObjectAnnotation[];
  faceDetectionAnnotations?: FaceDetectionAnnotation[];
  explicitAnnotation?: ExplicitContentAnnotation;
}

interface ShotAnnotation {
  startTimeOffset: string;
  endTimeOffset: string;
}

interface LabelAnnotation {
  entity: { description: string };
  segments: Array<{ segment: { startTimeOffset: string; endTimeOffset: string }; confidence: number }>;
}

interface TextAnnotation {
  text: string;
  segments: Array<{ segment: { startTimeOffset: string; endTimeOffset: string }; confidence: number }>;
}

interface ObjectAnnotation {
  entity: { description: string };
  frames: Array<{ timeOffset: string; normalizedBoundingBox: any }>;
}

interface FaceDetectionAnnotation {
  tracks: Array<{ segment: { startTimeOffset: string; endTimeOffset: string } }>;
}

interface ExplicitContentAnnotation {
  frames: Array<{
    timeOffset: string;
    pornographyLikelihood: string;
  }>;
}

interface AnalysisResult {
  scenes: Array<{ start: number; end: number; description: string }>;
  labels: Array<{ label: string; confidence: number; timeRanges: Array<{ start: number; end: number }> }>;
  detectedText: Array<{ text: string; timeRanges: Array<{ start: number; end: number }> }>;
  objects: Array<{ object: string; appearances: number }>;
  faces: number;
  explicitContent: boolean;
  keyMoments: Array<{ time: number; reason: string }>;
}

/**
 * Analyze video using Google Cloud Video Intelligence API
 * This calls our Next.js API route which handles server-side authentication
 */
export async function analyzeVideoWithGoogle(
  videoUrl: string,
  storagePath: string,
  features?: string[]
): Promise<AnalysisResult> {
  try {
    console.log('📹 Calling server-side Google Cloud Video Intelligence API...');
    console.log('✨ Selected features:', features);
    
    // Call our Next.js API route instead of trying to authenticate in browser
    const response = await fetch('/api/analyze-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoUrl,
        storagePath,
        features, // Pass selected features to API
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Analysis failed');
    }

    console.log('✅ Google Cloud analysis complete:', data.analysis);
    return data.analysis;
  } catch (error) {
    console.error('Google Video Analysis error:', error);
    throw error;
  }
}

/**
 * Get Google Cloud access token using service account
 * Simpler approach without google-auth-library
 */
async function getGoogleCloudCredentials(): Promise<{ token: string } | null> {
  try {
    const serviceAccountKey = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_KEY;
    
    if (!serviceAccountKey) {
      console.warn('Google Cloud credentials not found. Set NEXT_PUBLIC_GOOGLE_CLOUD_KEY');
      return null;
    }

    const credentials = JSON.parse(serviceAccountKey);

    // Create JWT for Google OAuth
    const now = Math.floor(Date.now() / 1000);
    const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const jwtClaimSet = btoa(JSON.stringify({
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }));

    // Note: This requires importing your private key from the service account JSON
    // For production, you should do this server-side (API route)
    // For now, we'll use a simpler approach...

    console.warn('Google Cloud API token generation requires server-side implementation');
    console.info('For now, use only OpenAI analysis (cheaper and simpler)');
    
    return null;
  } catch (error) {
    console.error('Failed to get Google Cloud credentials:', error);
    return null;
  }
}

/**
 * Poll operation until it's done
 */
async function pollOperationUntilDone(operationName: string, token: string, maxAttempts = 60): Promise<any> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await fetch(`https://videointelligence.googleapis.com/v1/${operationName}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const operation = await response.json();

    if (operation.done) {
      if (operation.error) {
        throw new Error(`Operation failed: ${operation.error.message}`);
      }
      return operation.response;
    }

    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error('Operation timed out');
}

/**
 * Process the raw Google Cloud Video Intelligence API results
 */
function processAnalysisResults(results: any): AnalysisResult {
  const annotationResults = results.annotationResults?.[0] || results;

  // Process scenes from shot annotations
  const scenes = (annotationResults.shotAnnotations || []).map((shot: any, index: number) => ({
    start: parseTimeOffset(shot.startTimeOffset),
    end: parseTimeOffset(shot.endTimeOffset),
    description: `Scene ${index + 1}`,
  }));

  // Process labels
  const labels = (annotationResults.labelAnnotations || []).map((label: any) => ({
    label: label.entity.description,
    confidence: label.segments[0]?.confidence || 0,
    timeRanges: label.segments.map((seg: any) => ({
      start: parseTimeOffset(seg.segment.startTimeOffset),
      end: parseTimeOffset(seg.segment.endTimeOffset),
    })),
  }));

  // Process detected text
  const detectedText = (annotationResults.textAnnotations || []).map((text: any) => ({
    text: text.text,
    timeRanges: text.segments.map((seg: any) => ({
      start: parseTimeOffset(seg.segment.startTimeOffset),
      end: parseTimeOffset(seg.segment.endTimeOffset),
    })),
  }));

  // Process objects
  const objectCounts: Record<string, number> = {};
  (annotationResults.objectAnnotations || []).forEach((obj: any) => {
    objectCounts[obj.entity.description] = (objectCounts[obj.entity.description] || 0) + 1;
  });

  const objects = Object.entries(objectCounts).map(([object, appearances]) => ({
    object,
    appearances,
  }));

  // Count faces
  const faces = annotationResults.faceDetectionAnnotations?.[0]?.tracks?.length || 0;

  // Check explicit content
  const explicitContent = (annotationResults.explicitAnnotation?.frames || []).some(
    (frame: any) => frame.pornographyLikelihood === 'VERY_LIKELY' || frame.pornographyLikelihood === 'LIKELY'
  );

  // Identify key moments (scene changes, label changes)
  const keyMoments: Array<{ time: number; reason: string }> = [];
  
  scenes.forEach((scene: { start: number; end: number; description: string }, index: number) => {
    if (index > 0) {
      keyMoments.push({
        time: scene.start,
        reason: 'Scene change detected',
      });
    }
  });

  return {
    scenes,
    labels,
    detectedText,
    objects,
    faces,
    explicitContent,
    keyMoments,
  };
}

/**
 * Parse time offset string to seconds
 */
function parseTimeOffset(timeOffset: string): number {
  if (!timeOffset) return 0;
  
  // Format: "123.456s"
  const seconds = parseFloat(timeOffset.replace('s', ''));
  return isNaN(seconds) ? 0 : seconds;
}

/**
 * Generate AI editing recommendations using OpenAI
 */
export async function generateEditingRecommendations(
  analysisResult: AnalysisResult,
  transcript?: string
): Promise<string> {
  const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = buildRecommendationsPrompt(analysisResult, transcript);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a professional video editor AI assistant. Analyze video data and provide actionable editing recommendations to improve the video quality, pacing, and engagement.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Build prompt for OpenAI recommendations
 */
function buildRecommendationsPrompt(analysis: AnalysisResult, transcript?: string): string {
  return `
# Video Analysis Report

## Scene Information
- Total scenes detected: ${analysis.scenes.length}
- Scene durations: ${analysis.scenes.map(s => `${(s.end - s.start).toFixed(1)}s`).join(', ')}

## Content Labels
${analysis.labels.slice(0, 10).map(l => `- ${l.label} (${(l.confidence * 100).toFixed(0)}% confidence)`).join('\n')}

## Detected Objects
${analysis.objects.slice(0, 10).map(o => `- ${o.object}: ${o.appearances} appearances`).join('\n')}

## Text in Video
${analysis.detectedText.length > 0 ? analysis.detectedText.map(t => `- "${t.text}"`).join('\n') : 'No text detected'}

## People
- Faces detected: ${analysis.faces}

## Key Moments
${analysis.keyMoments.slice(0, 5).map(m => `- ${m.time.toFixed(1)}s: ${m.reason}`).join('\n')}

${transcript ? `## Transcript\n${transcript.slice(0, 1000)}${transcript.length > 1000 ? '...' : ''}` : ''}

---

Based on this video analysis, provide:

1. **Pacing Recommendations**: Identify slow sections that could be cut or sped up
2. **Visual Enhancements**: Suggest where to add text overlays, graphics, or effects
3. **Structure Improvements**: Recommend reordering or trimming scenes
4. **Engagement Boosters**: Identify key moments to emphasize or highlight
5. **Technical Improvements**: Suggest color correction, brightness, or audio adjustments
6. **Content Suggestions**: Recommend adding B-roll, transitions, or music

Format your response as a structured report with specific timestamps and actionable items.
`;
}
