import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/analyze-vision
 *
 * Runs Google Cloud Video Intelligence analysis on a video and returns
 * structured visual metadata optimized for transcript segment enrichment.
 *
 * Features requested:
 *   - SHOT_CHANGE_DETECTION → scene boundaries
 *   - LABEL_DETECTION       → content labels with time ranges
 *   - OBJECT_TRACKING       → product/object detection with time ranges
 *   - FACE_DETECTION        → talking head tracks
 *
 * Returns enrichment-friendly format preserving all temporal data.
 *
 * GET /api/analyze-vision
 *   Returns whether the Google Cloud service is configured.
 */

// ─── Auth ──────────────────────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  const serviceAccountJson = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT;

  if (!serviceAccountJson) {
    throw new Error(
      'GOOGLE_CLOUD_SERVICE_ACCOUNT not configured. ' +
        'Set this environment variable with your service account JSON to enable vision analysis.'
    );
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('Invalid JSON in GOOGLE_CLOUD_SERVICE_ACCOUNT');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleAuth } = require('google-auth-library');

  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  if (!accessToken.token) {
    throw new Error('Failed to obtain Google Cloud access token');
  }

  return accessToken.token;
}

// ─── Helpers ───────────────────────────────────────────────

function parseTimeOffset(timeOffset?: string): number {
  if (!timeOffset) return 0;
  return parseFloat(timeOffset.replace('s', ''));
}

/**
 * Process raw Video Intelligence results into an enrichment-friendly format.
 * Unlike the general /api/analyze-video route, this preserves full temporal
 * data for objects and face tracks so per-segment enrichment is possible.
 */
function processForEnrichment(annotationResults: any) {
  // ── Scene boundaries ──
  const scenes = (annotationResults.shotAnnotations || []).map(
    (shot: any, i: number) => ({
      id: i,
      start: parseTimeOffset(shot.startTimeOffset),
      end: parseTimeOffset(shot.endTimeOffset),
    })
  );

  // ── Labels with time ranges (segment + shot level, deduplicated) ──
  const labelMap = new Map<
    string,
    { confidence: number; timeRanges: { start: number; end: number }[] }
  >();

  const processLabels = (annotations: any[]) => {
    for (const label of annotations) {
      const name = label.entity?.description;
      if (!name) continue;

      const newRanges = (label.segments || []).map((seg: any) => ({
        start: parseTimeOffset(seg.segment?.startTimeOffset),
        end: parseTimeOffset(seg.segment?.endTimeOffset),
      }));
      const confidence =
        label.segments?.[0]?.confidence || label.confidence || 0;

      const existing = labelMap.get(name);
      if (existing) {
        existing.timeRanges.push(...newRanges);
        existing.confidence = Math.max(existing.confidence, confidence);
      } else {
        labelMap.set(name, { confidence, timeRanges: newRanges });
      }
    }
  };

  processLabels(annotationResults.segmentLabelAnnotations || []);
  processLabels(annotationResults.shotLabelAnnotations || []);
  processLabels(annotationResults.labelAnnotations || []);

  const labels = Array.from(labelMap.entries())
    .map(([label, data]) => ({
      label,
      confidence: data.confidence,
      timeRanges: data.timeRanges,
    }))
    .sort((a, b) => b.confidence - a.confidence);

  // ── Objects with time ranges ──
  const objects = (annotationResults.objectAnnotations || []).map(
    (obj: any) => {
      const frames = obj.frames || [];
      return {
        object: obj.entity?.description || 'unknown',
        confidence: obj.confidence || 0,
        timeRange:
          frames.length > 0
            ? {
                start: parseTimeOffset(frames[0].timeOffset),
                end: parseTimeOffset(
                  frames[frames.length - 1].timeOffset
                ),
              }
            : { start: 0, end: 0 },
      };
    }
  );

  // ── Face tracks with time ranges ──
  const faceTracks: { start: number; end: number }[] = [];
  // Speaker tracks: grouped by detected person (each faceDetectionAnnotation = 1 person)
  const speakerTracks: { id: number; ranges: { start: number; end: number }[] }[] = [];
  let speakerId = 0;

  for (const annotation of annotationResults.faceDetectionAnnotations ||
    []) {
    const personRanges: { start: number; end: number }[] = [];
    for (const track of annotation.tracks || []) {
      const range = {
        start: parseTimeOffset(track.segment?.startTimeOffset),
        end: parseTimeOffset(track.segment?.endTimeOffset),
      };
      faceTracks.push(range);
      personRanges.push(range);
    }
    if (personRanges.length > 0) {
      speakerTracks.push({ id: speakerId++, ranges: personRanges });
    }
  }

  return { scenes, labels, objects, faceTracks, speakerTracks };
}

// ─── POST handler ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { storagePath, videoUrl } = await request.json();

    if (!storagePath && !videoUrl) {
      return NextResponse.json(
        { error: 'storagePath or videoUrl is required' },
        { status: 400 }
      );
    }

    // Construct GCS URI from Firebase Storage path
    let inputUri = videoUrl;
    if (storagePath) {
      if (storagePath.startsWith('gs://')) {
        inputUri = storagePath;
      } else {
        const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        if (bucket) {
          inputUri = `gs://${bucket}/${storagePath}`;
        } else {
          inputUri = storagePath;
        }
      }
    }

    console.log('🔍 Vision Analysis for Clip Enrichment');
    console.log('📍 Input URI:', inputUri);

    const accessToken = await getGoogleAccessToken();

    // Only request the 4 features needed for segment enrichment
    const requestBody = {
      inputUri,
      features: [
        'SHOT_CHANGE_DETECTION',
        'LABEL_DETECTION',
        'OBJECT_TRACKING',
        'FACE_DETECTION',
      ],
      videoContext: {
        labelDetectionConfig: {
          labelDetectionMode: 'SHOT_AND_FRAME_MODE',
        },
      },
    };

    const response = await fetch(
      'https://videointelligence.googleapis.com/v1/videos:annotate',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Google Vision API error:', error);
      return NextResponse.json(
        {
          error: `Google Vision API error: ${
            error.error?.message || response.statusText
          }`,
        },
        { status: response.status }
      );
    }

    const operation = await response.json();
    console.log('🔄 Vision analysis started:', operation.name);

    // Poll for completion (max ~10 minutes)
    let attempts = 0;
    const maxAttempts = 120;

    while (attempts < maxAttempts) {
      const pollResponse = await fetch(
        `https://videointelligence.googleapis.com/v1/${operation.name}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const pollResult = await pollResponse.json();

      if (pollResult.done) {
        if (pollResult.error) {
          console.error('❌ Vision operation failed:', pollResult.error);
          throw new Error(
            `Vision analysis failed: ${pollResult.error.message}`
          );
        }

        console.log('✅ Vision analysis complete');
        const annotationResults =
          pollResult.response.annotationResults[0];
        const enrichmentData = processForEnrichment(annotationResults);

        console.log('📊 Vision summary:');
        console.log('  - Scenes:', enrichmentData.scenes.length);
        console.log('  - Labels:', enrichmentData.labels.length);
        console.log('  - Objects:', enrichmentData.objects.length);
        console.log(
          '  - Face tracks:',
          enrichmentData.faceTracks.length
        );

        return NextResponse.json({
          success: true,
          ...enrichmentData,
          analyzedAt: new Date().toISOString(),
        });
      }

      console.log(
        `⏳ Vision polling... attempt ${attempts + 1}/${maxAttempts}`
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    return NextResponse.json(
      {
        error: 'Vision analysis timed out (10 minutes). Try a shorter video.',
      },
      { status: 504 }
    );
  } catch (error: any) {
    console.error('❌ Vision analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Vision analysis failed' },
      { status: 500 }
    );
  }
}

// ─── GET handler (service status check) ────────────────────

export async function GET() {
  const hasCredentials = !!process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT;
  return NextResponse.json({
    configured: hasCredentials,
    provider: 'google-cloud-video-intelligence',
  });
}
