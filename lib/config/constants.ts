export const APP_NAME = 'EditBotics Pro';
export const APP_VERSION = '2.0.0';

// OpenAI API Configuration
export const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

// Video Analysis Configuration
export const VIDEO_ANALYSIS_PROVIDER = process.env.NEXT_PUBLIC_VIDEO_ANALYSIS_PROVIDER || 'openai'; // 'google' | 'openai' | 'openai-vision'
// Note: Google Cloud credentials are stored server-side only (GOOGLE_CLOUD_SERVICE_ACCOUNT)
// They are accessed via /api/analyze-video route, not exposed to client

// Analysis Provider Options:
// - 'openai': Text-only analysis using GPT-4 (~$0.40/video)
// - 'openai-vision': Visual + text analysis using GPT-4V (~$0.80/video)  
// - 'google': Comprehensive analysis using Google Cloud Video Intelligence (~$1.25/video)

// File upload constraints
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
export const ALLOWED_VIDEO_FORMATS = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
export const ALLOWED_AUDIO_FORMATS = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'];
export const ALLOWED_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Timeline settings
export const TIMELINE_ZOOM_MIN = 0.1;
export const TIMELINE_ZOOM_MAX = 10;
export const TIMELINE_ZOOM_STEP = 0.1;

// Video export settings
export const EXPORT_QUALITY_OPTIONS = [
  { label: '1080p (Full HD)', value: '1080p', width: 1920, height: 1080 },
  { label: '720p (HD)', value: '720p', width: 1280, height: 720 },
  { label: '480p (SD)', value: '480p', width: 854, height: 480 },
];

// Transcription settings
export const TRANSCRIPTION_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
];
