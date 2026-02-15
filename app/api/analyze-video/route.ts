import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side API Route for Google Cloud Video Intelligence
 * This keeps credentials secure and handles OAuth authentication server-side
 */

interface VideoAnnotationResults {
  inputUri?: string;
  shotAnnotations?: Array<{
    startTimeOffset: string;
    endTimeOffset: string;
  }>;
  segmentLabelAnnotations?: any[];
  shotLabelAnnotations?: any[];
  frameLabelAnnotations?: any[];
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
    confidence?: number;
    frames: Array<{ 
      timeOffset: string;
      normalizedBoundingBox?: any;
    }>;
  }>;
  faceDetectionAnnotations?: Array<{
    tracks: Array<{
      segment: { startTimeOffset: string; endTimeOffset: string };
    }>;
    thumbnail?: string;
  }>;
  explicitAnnotation?: {
    frames: Array<{
      timeOffset: string;
      pornographyLikelihood: string;
    }>;
  };
}

/**
 * Optimize Google Video Intelligence response by removing bloated frame-by-frame data
 * Keeps only useful summary information for video editing
 */
function optimizeVideoAnnotationResults(results: VideoAnnotationResults): any {
  const optimized: any = {
    inputUri: results.inputUri,
  };

  // Keep segment labels (high-level video labels) - USEFUL
  if (results.segmentLabelAnnotations) {
    optimized.segmentLabelAnnotations = results.segmentLabelAnnotations;
  }

  // Keep shot labels (labels per scene) - USEFUL  
  if (results.shotLabelAnnotations) {
    optimized.shotLabelAnnotations = results.shotLabelAnnotations;
  }

  // Keep shot annotations (scene changes) - CRITICAL
  if (results.shotAnnotations) {
    optimized.shotAnnotations = results.shotAnnotations;
  }

  // FILTER: Frame labels - Only keep summary, remove per-frame data
  // Changed from 130+ frames per label to just the label info
  if (results.frameLabelAnnotations) {
    optimized.frameLabelAnnotations = results.frameLabelAnnotations.map((annotation: any) => ({
      entity: annotation.entity,
      categoryEntities: annotation.categoryEntities,
      frameCount: annotation.frames?.length || 0,
      // Remove per-frame data, keep only first and last frame for time range
      timeRange: annotation.frames?.length > 0 ? {
        start: annotation.frames[0].timeOffset,
        end: annotation.frames[annotation.frames.length - 1].timeOffset,
        avgConfidence: annotation.frames.reduce((sum: number, f: any) => sum + f.confidence, 0) / annotation.frames.length,
      } : null,
    }));
  }

  // FILTER: Object annotations - Only keep summary, remove 130+ bounding boxes per object
  // This is the biggest bloat - each object has ~1300 bounding boxes for a 13s video!
  if (results.objectAnnotations) {
    optimized.objectAnnotations = results.objectAnnotations.map((annotation: any) => ({
      entity: annotation.entity,
      confidence: annotation.confidence,
      frameCount: annotation.frames?.length || 0,
      // Keep only appearance time range, remove all bounding boxes
      timeRange: annotation.frames?.length > 0 ? {
        start: annotation.frames[0].timeOffset,
        end: annotation.frames[annotation.frames.length - 1].timeOffset,
      } : null,
      // Optional: Sample a few frames for position (e.g., first, middle, last)
      samplePositions: annotation.frames?.length > 0 ? [
        {
          time: annotation.frames[0].timeOffset,
          box: annotation.frames[0].normalizedBoundingBox,
        },
        annotation.frames.length > 1 ? {
          time: annotation.frames[Math.floor(annotation.frames.length / 2)].timeOffset,
          box: annotation.frames[Math.floor(annotation.frames.length / 2)].normalizedBoundingBox,
        } : null,
        annotation.frames.length > 1 ? {
          time: annotation.frames[annotation.frames.length - 1].timeOffset,
          box: annotation.frames[annotation.frames.length - 1].normalizedBoundingBox,
        } : null,
      ].filter(Boolean) : [],
    }));
  }

  // Keep text annotations - USEFUL
  if (results.textAnnotations) {
    optimized.textAnnotations = results.textAnnotations;
  }

  // Keep face detection tracks but REMOVE thumbnail (large base64 image)
  if (results.faceDetectionAnnotations) {
    optimized.faceDetectionAnnotations = results.faceDetectionAnnotations.map((annotation: any) => ({
      tracks: annotation.tracks,
      // Remove thumbnail - it's a huge base64 encoded image we don't need
      thumbnailRemoved: true,
    }));
  }

  // FILTER: Explicit content - Sample every 1 second instead of every 0.1s
  // Reduces from 130 entries to ~13 entries
  if (results.explicitAnnotation) {
    const frames = results.explicitAnnotation.frames || [];
    optimized.explicitAnnotation = {
      // Sample every 10th frame (~1 second intervals instead of 0.1s)
      frames: frames.filter((_: any, index: number) => index % 10 === 0),
      totalFramesAnalyzed: frames.length,
    };
  }

  return optimized;
}

/**
 * Convert time offset string (e.g., "3.5s") to seconds
 */
function parseTimeOffset(timeOffset?: string): number {
  if (!timeOffset) return 0;
  return parseFloat(timeOffset.replace('s', ''));
}

/**
 * Get Google Cloud OAuth token using service account with Google Auth Library
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

  console.log('📧 Client email:', serviceAccount.client_email);
  console.log('🔑 Project ID:', serviceAccount.project_id);

  // Use Google Auth Library instead of manually creating JWT
  const { GoogleAuth } = require('google-auth-library');
  
  try {
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    
    if (!accessToken.token) {
      throw new Error('Failed to obtain access token');
    }

    console.log('✅ Successfully obtained OAuth token');
    return accessToken.token;
  } catch (error: any) {
    console.error('❌ Google Auth error:', error.message);
    throw new Error(`Google authentication failed: ${error.message}`);
  }
}

/**
 * POST /api/analyze-video
 * Analyze video using Google Cloud Video Intelligence API
 */
export async function POST(request: NextRequest) {
  try {
    const { videoUrl, storagePath, features } = await request.json();

    if (!videoUrl && !storagePath) {
      return NextResponse.json(
        { error: 'videoUrl or storagePath is required' },
        { status: 400 }
      );
    }

    // Use gs:// path if available (more reliable), otherwise fall back to HTTPS URL
    // Google Video Intelligence works best with GCS URIs
    const inputUri = storagePath || videoUrl;
    
    // Default features if none provided
    const selectedFeatures = features && features.length > 0 ? features : [
      'LABEL_DETECTION',
      'SHOT_CHANGE_DETECTION',
      'TEXT_DETECTION',
      'OBJECT_TRACKING',
      'FACE_DETECTION',
      'EXPLICIT_CONTENT_DETECTION',
    ];
    
    console.log('🎥 Server-side Google Cloud Video Analysis');
    console.log('📍 Input URI:', inputUri);
    console.log('📍 URI type:', inputUri.startsWith('gs://') ? 'GCS' : inputUri.startsWith('http') ? 'HTTPS' : 'Unknown');
    console.log('✨ Selected features:', selectedFeatures);

    // Get OAuth access token from service account
    const accessToken = await getGoogleAccessToken();

    const requestBody = {
      inputUri: inputUri,
      features: selectedFeatures,
      videoContext: {
        labelDetectionConfig: {
          labelDetectionMode: 'SHOT_AND_FRAME_MODE',
        },
      },
    };

    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    // Call Google Cloud Video Intelligence API
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
      console.error('❌ Google API error:', error);
      console.error('📤 Full error response:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: `Google API error: ${error.error?.message || response.statusText}` },
        { status: response.status }
      );
    }

    const operation = await response.json();
    console.log('🔄 Analysis operation started:', operation.name);
    console.log('📦 Operation response:', JSON.stringify(operation, null, 2));

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
        console.error('❌ Operation failed:', JSON.stringify(operation.error, null, 2));
        throw new Error(`Operation failed: ${operation.error.message}`);
      }
      console.log('✅ Analysis complete!');
      
      const rawResults = operation.response.annotationResults[0];
      
      // Optimize results to remove bloated frame-by-frame data
      const optimizedResults = optimizeVideoAnnotationResults(rawResults);
      
      console.log('📊 Optimized annotation results:', JSON.stringify(optimizedResults, null, 2));
      console.log('📊 Summary:');
      console.log('  - Scenes:', optimizedResults.shotAnnotations?.length || 0);
      console.log('  - Labels:', (optimizedResults.segmentLabelAnnotations?.length || 0) + (optimizedResults.shotLabelAnnotations?.length || 0));
      console.log('  - Objects:', optimizedResults.objectAnnotations?.length || 0);
      console.log('  - Faces:', optimizedResults.faceDetectionAnnotations?.length || 0);
      
      return optimizedResults;
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

  // Process labels from both segment and shot annotations
  const segmentLabels = (results.segmentLabelAnnotations || []).map((label: any) => ({
    label: label.entity.description,
    confidence: label.segments[0]?.confidence || 0,
    timeRanges: label.segments.map((seg: any) => ({
      start: parseTimeOffset(seg.segment.startTimeOffset),
      end: parseTimeOffset(seg.segment.endTimeOffset),
    })),
    category: label.categoryEntities?.[0]?.description || 'general',
  }));

  const shotLabels = (results.shotLabelAnnotations || []).map((label: any) => ({
    label: label.entity.description,
    confidence: label.segments[0]?.confidence || 0,
    timeRanges: label.segments.map((seg: any) => ({
      start: parseTimeOffset(seg.segment.startTimeOffset),
      end: parseTimeOffset(seg.segment.endTimeOffset),
    })),
    category: label.categoryEntities?.[0]?.description || 'general',
  }));

  // Combine and deduplicate labels
  const allLabels = [...segmentLabels, ...shotLabels];
  const uniqueLabels = allLabels.reduce((acc: any[], label) => {
    const existing = acc.find(l => l.label === label.label);
    if (!existing) {
      acc.push(label);
    } else if (label.confidence > existing.confidence) {
      // Keep the higher confidence version
      Object.assign(existing, label);
    }
    return acc;
  }, []);

  // Sort by confidence
  const labels = uniqueLabels.sort((a, b) => b.confidence - a.confidence);

  // Process detected text
  const detectedText = (results.textAnnotations || []).map((text) => ({
    text: text.text,
    timeRanges: text.segments.map((seg) => ({
      start: parseTimeOffset(seg.segment.startTimeOffset),
      end: parseTimeOffset(seg.segment.endTimeOffset),
    })),
  }));

  // Count objects (now using optimized structure)
  const objectCounts: Record<string, number> = {};
  (results.objectAnnotations || []).forEach((obj: any) => {
    objectCounts[obj.entity.description] =
      (objectCounts[obj.entity.description] || 0) + 1;
  });

  const objects = Object.entries(objectCounts).map(([object, appearances]) => ({
    object,
    appearances,
  }));

  // Count faces
  const faces = results.faceDetectionAnnotations?.[0]?.tracks?.length || 0;

  // Check explicit content (now using sampled frames)
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
