import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side API Route for Google Cloud Video Intelligence
 * This keeps credentials secure and handles OAuth authentication server-side
 */

interface VideoAnnotationResults {
  shotAnnotations?: Array<{
    startTimeOffset: string;
    endTimeOffset: string;
  }>;
  labelAnnotations?: Array<{
    entity: { description: string };
    segments: Array<{
      segment: { startTimeOffset: string; endTimeOffset: string };
      confidence: number;
    }>;
  }>;
  textAnnotations?: Array<{
    text: string;
    segments: Array<{
      segment: { startTimeOffset: string; endTimeOffset: string };
      confidence: number;
    }>;
  }>;
  objectAnnotations?: Array<{
    entity: { description: string };
    frames: Array<{ timeOffset: string }>;
  }>;
  faceDetectionAnnotations?: Array<{
    tracks: Array<{
      segment: { startTimeOffset: string; endTimeOffset: string };
    }>;
  }>;
  explicitAnnotation?: {
    frames: Array<{
      timeOffset: string;
      pornographyLikelihood: string;
    }>;
  };
}

/**
 * Convert time offset string (e.g., "3.5s") to seconds
 */
function parseTimeOffset(timeOffset?: string): number {
  if (!timeOffset) return 0;
  return parseFloat(timeOffset.replace('s', ''));
}

/**
 * Get Google Cloud OAuth token using service account
 */
async function getGoogleAccessToken(): Promise<string> {
  const serviceAccountJson = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT;
  
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_CLOUD_SERVICE_ACCOUNT not configured in environment variables');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (error) {
    throw new Error('Invalid JSON in GOOGLE_CLOUD_SERVICE_ACCOUNT');
  }

  // Import jwt library for signing (you may need to install: npm install jsonwebtoken)
  const jwt = require('jsonwebtoken');

  const now = Math.floor(Date.now() / 1000);
  const jwtClaim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const token = jwt.sign(jwtClaim, serviceAccount.private_key, {
    algorithm: 'RS256',
  });

  // Exchange JWT for access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OAuth token request failed: ${error.error_description || error.error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * POST /api/analyze-video
 * Analyze video using Google Cloud Video Intelligence API
 */
export async function POST(request: NextRequest) {
  try {
    const { videoUrl, storagePath } = await request.json();

    if (!storagePath) {
      return NextResponse.json(
        { error: 'storagePath is required' },
        { status: 400 }
      );
    }

    console.log('🎥 Server-side Google Cloud Video Analysis:', storagePath);

    // Get OAuth access token
    const accessToken = await getGoogleAccessToken();

    // Call Google Cloud Video Intelligence API
    const response = await fetch(
      'https://videointelligence.googleapis.com/v1/videos:annotate',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputUri: storagePath,
          features: [
            'LABEL_DETECTION',
            'SHOT_CHANGE_DETECTION',
            'TEXT_DETECTION',
            'OBJECT_TRACKING',
            'FACE_DETECTION',
            'EXPLICIT_CONTENT_DETECTION',
          ],
          videoContext: {
            labelDetectionConfig: {
              labelDetectionMode: 'SHOT_AND_FRAME_MODE',
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Google API error:', error);
      return NextResponse.json(
        { error: `Google API error: ${error.error?.message || response.statusText}` },
        { status: response.status }
      );
    }

    const operation = await response.json();
    console.log('🔄 Analysis operation started:', operation.name);

    // Poll for operation completion
    const results = await pollOperationUntilDone(operation.name, accessToken);

    // Process and return results
    const analysis = processAnalysisResults(results);

    return NextResponse.json({
      success: true,
      analysis,
      provider: 'google',
    });
  } catch (error: any) {
    console.error('❌ Video analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Video analysis failed' },
      { status: 500 }
    );
  }
}

/**
 * Poll operation until it's done (max 10 minutes)
 */
async function pollOperationUntilDone(
  operationName: string,
  token: string,
  maxAttempts = 120
): Promise<VideoAnnotationResults> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await fetch(
      `https://videointelligence.googleapis.com/v1/${operationName}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const operation = await response.json();

    if (operation.done) {
      if (operation.error) {
        throw new Error(`Operation failed: ${operation.error.message}`);
      }
      console.log('✅ Analysis complete!');
      return operation.response.annotationResults[0];
    }

    console.log(`⏳ Polling... attempt ${attempts + 1}/${maxAttempts}`);
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
    attempts++;
  }

  throw new Error('Operation timed out (10 minutes)');
}

/**
 * Process raw Google Cloud results into structured format
 */
function processAnalysisResults(results: VideoAnnotationResults) {
  // Process scenes
  const scenes = (results.shotAnnotations || []).map((shot, index) => ({
    start: parseTimeOffset(shot.startTimeOffset),
    end: parseTimeOffset(shot.endTimeOffset),
    description: `Scene ${index + 1}`,
  }));

  // Process labels
  const labels = (results.labelAnnotations || []).map((label) => ({
    label: label.entity.description,
    confidence: label.segments[0]?.confidence || 0,
    timeRanges: label.segments.map((seg) => ({
      start: parseTimeOffset(seg.segment.startTimeOffset),
      end: parseTimeOffset(seg.segment.endTimeOffset),
    })),
  }));

  // Process detected text
  const detectedText = (results.textAnnotations || []).map((text) => ({
    text: text.text,
    timeRanges: text.segments.map((seg) => ({
      start: parseTimeOffset(seg.segment.startTimeOffset),
      end: parseTimeOffset(seg.segment.endTimeOffset),
    })),
  }));

  // Count objects
  const objectCounts: Record<string, number> = {};
  (results.objectAnnotations || []).forEach((obj) => {
    objectCounts[obj.entity.description] =
      (objectCounts[obj.entity.description] || 0) + 1;
  });

  const objects = Object.entries(objectCounts).map(([object, appearances]) => ({
    object,
    appearances,
  }));

  // Count faces
  const faces = results.faceDetectionAnnotations?.[0]?.tracks?.length || 0;

  // Check explicit content
  const explicitContent = (results.explicitAnnotation?.frames || []).some(
    (frame) =>
      frame.pornographyLikelihood === 'VERY_LIKELY' ||
      frame.pornographyLikelihood === 'LIKELY'
  );

  // Identify key moments
  const keyMoments = scenes.slice(1).map((scene) => ({
    time: scene.start,
    reason: 'Scene change detected',
  }));

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
