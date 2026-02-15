/**
 * Unified Video Analysis API with Provider Selection
 * Supports multiple AI providers via feature flags
 */

import { VIDEO_ANALYSIS_PROVIDER } from '@/lib/config/constants';
import { analyzeVideoWithGoogle, generateEditingRecommendations as googleRecommendations } from './videoAnalysis';
import { analyzeVideoSimple, formatAnalysisReport } from './videoAnalysisSimple';
import { OPENAI_API_KEY } from '@/lib/config/constants';

// Unified analysis result interface
export interface UnifiedAnalysisResult {
  scenes: Array<{ start: number; end: number; description: string }>;
  labels: Array<{ label: string; confidence: number; timeRanges: Array<{ start: number; end: number }> }>;
  detectedText: Array<{ text: string; timeRanges: Array<{ start: number; end: number }> }>;
  objects: Array<{ object: string; appearances: number }>;
  faces: number;
  explicitContent: boolean;
  keyMoments: Array<{ time: number; reason: string }>;
  transcription?: string; // Track if transcript was available
  summary?: {
    overview: string;
    mainTopic: string;
    speakers: string;
    keyPoints: Array<string>;
  };
}

export type AnalysisProvider = 'google' | 'openai' | 'openai-vision';

/**
 * Analyze video using configured provider
 */
export async function analyzeVideo(
  videoUrl: string,
  videoName: string,
  storagePath?: string,
  transcript?: string,
  duration?: number,
  features?: string[]
): Promise<{ analysis: UnifiedAnalysisResult; recommendations: string; provider: AnalysisProvider }> {
  
  const provider = VIDEO_ANALYSIS_PROVIDER as AnalysisProvider;
  
  console.log(`📹 Video Analysis using: ${provider.toUpperCase()}`);
  console.log(`✨ Selected features:`, features);

  switch (provider) {
    case 'google':
      return await analyzeWithGoogle(videoUrl, storagePath!, transcript, features);
    
    case 'openai-vision':
      return await analyzeWithOpenAIVision(videoUrl, videoName, transcript, duration);
    
    case 'openai':
    default:
      return await analyzeWithOpenAI(videoUrl, videoName, transcript, duration);
  }
}

/**
 * Google Cloud Video Intelligence Provider
 */
async function analyzeWithGoogle(
  videoUrl: string,
  storagePath: string,
  transcript?: string,
  features?: string[]
): Promise<{ analysis: UnifiedAnalysisResult; recommendations: string; provider: AnalysisProvider }> {
  try {
    // Google Cloud analysis
    const googleAnalysis = await analyzeVideoWithGoogle(videoUrl, storagePath, features);
    
    // Generate recommendations with OpenAI
    const recommendations = await googleRecommendations(googleAnalysis, transcript);

    return {
      analysis: googleAnalysis,
      recommendations,
      provider: 'google',
    };
  } catch (error) {
    console.error('Google Cloud analysis failed:', error);
    throw new Error('Google Cloud Video Intelligence API error. Check credentials and billing.');
  }
}

/**
 * OpenAI GPT-4 Text-Only Provider
 */
async function analyzeWithOpenAI(
  videoUrl: string,
  videoName: string,
  transcript?: string,
  duration?: number
): Promise<{ analysis: UnifiedAnalysisResult; recommendations: string; provider: AnalysisProvider }> {
  try {
    // OpenAI text-based analysis
    const simpleAnalysis = await analyzeVideoSimple(videoName, videoName, transcript, duration);
    
    // Convert to unified format
    const analysis: UnifiedAnalysisResult = {
      scenes: simpleAnalysis.scenes.map(s => ({
        start: parseTimestamp(s.timestamp),
        end: parseTimestamp(s.timestamp) + 5,
        description: s.description,
      })),
      labels: [], // Text-only doesn't detect visual labels
      detectedText: [], // Text-only doesn't detect on-screen text
      objects: [], // Text-only doesn't detect objects
      faces: 0, // Text-only doesn't detect faces
      explicitContent: false,
      keyMoments: simpleAnalysis.suggestions.highlights.map(h => ({
        time: parseTimestamp(h.time),
        reason: h.reason,
      })),
      transcription: transcript, // Track that transcript was used
      summary: simpleAnalysis.summary, // Pass through the summary object
    };

    const recommendations = formatAnalysisReport(simpleAnalysis);

    return {
      analysis,
      recommendations,
      provider: 'openai',
    };
  } catch (error) {
    console.error('OpenAI analysis failed:', error);
    throw new Error('OpenAI API error. Check API key and quota.');
  }
}

/**
 * OpenAI GPT-4 Vision Provider (Future Implementation)
 */
async function analyzeWithOpenAIVision(
  videoUrl: string,
  videoName: string,
  transcript?: string,
  duration?: number
): Promise<{ analysis: UnifiedAnalysisResult; recommendations: string; provider: AnalysisProvider }> {
  // TODO: Implement frame extraction and GPT-4V analysis
  console.warn('GPT-4 Vision provider not yet implemented. Falling back to text-only.');
  return await analyzeWithOpenAI(videoUrl, videoName, transcript, duration);
}

/**
 * Helper to parse MM:SS timestamp to seconds
 */
function parseTimestamp(ts: string): number {
  const parts = ts.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0');
}

/**
 * Get current provider name for display
 */
export function getProviderDisplayName(): string {
  const provider = VIDEO_ANALYSIS_PROVIDER as AnalysisProvider;
  
  switch (provider) {
    case 'google':
      return 'Google Cloud Video Intelligence';
    case 'openai-vision':
      return 'OpenAI GPT-4 Vision';
    case 'openai':
    default:
      return 'OpenAI GPT-4';
  }
}

/**
 * Get provider cost estimate
 */
export function getProviderCost(): string {
  const provider = VIDEO_ANALYSIS_PROVIDER as AnalysisProvider;
  
  switch (provider) {
    case 'google':
      return '🎁 FREE (1,000 min/month) then ~$1.25/video';
    case 'openai-vision':
      return '~$0.80/video';
    case 'openai':
    default:
      return '~$0.40/video';
  }
}

/**
 * Get free tier information
 */
export function getProviderFreeTier(): string {
  const provider = VIDEO_ANALYSIS_PROVIDER as AnalysisProvider;
  
  switch (provider) {
    case 'google':
      return '1,000 minutes per month FREE (renews monthly)';
    case 'openai-vision':
    case 'openai':
    default:
      return '$5 free credits for new accounts (expires after 3 months)';
  }
}

/**
 * Check if provider is properly configured
 */
export function isProviderConfigured(): { configured: boolean; message: string } {
  const provider = VIDEO_ANALYSIS_PROVIDER as AnalysisProvider;
  
  switch (provider) {
    case 'google':
      // Google Cloud uses server-side API route, so always return configured
      // The actual credentials check happens server-side in /api/analyze-video
      return { 
        configured: true, 
        message: 'Google Cloud configured (server-side)' 
      };
    
    case 'openai-vision':
    case 'openai':
    default:
      if (!OPENAI_API_KEY) {
        return {
          configured: false,
          message: 'OpenAI API key not configured. Set NEXT_PUBLIC_OPENAI_API_KEY',
        };
      }
      return { configured: true, message: 'OpenAI configured' };
  }
}
