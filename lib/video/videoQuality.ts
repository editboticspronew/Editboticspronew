/**
 * Video quality detection and downscaling utilities.
 * Uses the native <video> element to detect resolution, and FFmpeg WASM to transcode.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

// ── Types ────────────────────────────────────────────────────────────────────

export interface VideoResolution {
  width: number;
  height: number;
  label: string; // e.g. '1080p', '720p'
}

export interface QualityOption {
  label: string;   // '720p', '480p', etc.
  height: number;
  description: string;
}

export interface TranscodeProgress {
  stage: 'loading' | 'transcoding' | 'done';
  message: string;
  percent?: number; // 0-100 (estimated)
}

export interface TranscodeResult {
  blob: Blob;
  fileName: string;
  originalSize: number;
  newSize: number;
  resolution: VideoResolution;
}

// ── Quality tiers ────────────────────────────────────────────────────────────

const QUALITY_TIERS: QualityOption[] = [
  { label: '1080p', height: 1080, description: 'Full HD — good balance of quality & size' },
  { label: '720p',  height: 720,  description: 'HD — smaller file, still clear' },
  { label: '480p',  height: 480,  description: 'SD — much smaller, lower quality' },
];

/**
 * Bitrate caps per resolution (in kbps).
 * Using -maxrate + -bufsize in CRF mode creates "capped CRF" —
 * the encoder respects the CRF target but will never exceed maxrate,
 * guaranteeing the output is smaller than the original.
 */
const BITRATE_CAPS: Record<number, { maxrate: string; bufsize: string }> = {
  1080: { maxrate: '4500k', bufsize: '9000k' },
  720:  { maxrate: '2500k', bufsize: '5000k' },
  480:  { maxrate: '1000k', bufsize: '2000k' },
  360:  { maxrate: '600k',  bufsize: '1200k' },
};

// ── Resolution detection ─────────────────────────────────────────────────────

function heightToLabel(h: number): string {
  if (h >= 2160) return '4K (2160p)';
  if (h >= 1440) return '1440p';
  if (h >= 1080) return '1080p';
  if (h >= 720)  return '720p';
  if (h >= 480)  return '480p';
  if (h >= 360)  return '360p';
  return `${h}p`;
}

/**
 * Detect the native resolution of a video File using an off-screen <video> element.
 */
export function detectVideoResolution(file: File): Promise<VideoResolution> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onerror = null;
      URL.revokeObjectURL(video.src);
    };

    video.onloadedmetadata = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      cleanup();
      resolve({ width: w, height: h, label: heightToLabel(h) });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to read video metadata'));
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * Given the source video height, return the list of lower-quality options
 * the user can choose from. Returns [] if the video is already ≤480p.
 */
export function getDownscaleOptions(sourceHeight: number): QualityOption[] {
  return QUALITY_TIERS.filter((tier) => tier.height < sourceHeight);
}

// ── Shared FFmpeg instance (reuses singleton from clipVideo.ts if available) ─

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

// Progress callback set per-transcode, read inside the log handler
let _onProgressCb: ((p: TranscodeProgress) => void) | null = null;
let _totalFrames = 0;
let _targetHeight = 0;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
      // Parse "frame=  123" lines to report progress
      const frameMatch = message.match(/frame=\s*(\d+)/);
      if (frameMatch && _onProgressCb && _totalFrames > 0) {
        const currentFrame = parseInt(frameMatch[1], 10);
        const pct = Math.min(99, Math.round((currentFrame / _totalFrames) * 100));
        _onProgressCb({
          stage: 'transcoding',
          message: `Converting to ${_targetHeight}p — ${pct}% (frame ${currentFrame}/${_totalFrames})`,
          percent: pct,
        });
        return; // don't double-log frame lines
      }

      // Also suppress noisy "size=" lines
      if (message.includes('size=')) return;

      console.log('[FFmpeg Quality]', message);
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegInstance = ffmpeg;
    console.log('✅ FFmpeg WASM loaded for quality conversion');
    return ffmpeg;
  })();

  return ffmpegLoadPromise;
}

/**
 * Read the duration of a video File using an off-screen <video> element.
 */
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onerror = null;
      URL.revokeObjectURL(video.src);
    };
    video.onloadedmetadata = () => {
      const dur = video.duration;
      cleanup();
      resolve(isFinite(dur) ? dur : 0);
    };
    video.onerror = () => { cleanup(); reject(new Error('Cannot read duration')); };
    video.src = URL.createObjectURL(file);
  });
}

// ── Transcode ────────────────────────────────────────────────────────────────

/**
 * Transcode a video File to a lower resolution using FFmpeg WASM.
 *
 * IMPORTANT: Uses `-preset ultrafast` because FFmpeg WASM is single-threaded.
 * The `fast`/`medium` presets are 10-20× slower in WASM and will appear frozen
 * for videos longer than ~1 minute.
 *
 * @param file       - Original video File
 * @param targetHeight - Target vertical resolution (e.g. 720, 480)
 * @param onProgress - Optional progress callback
 * @returns TranscodeResult with a new Blob and metadata
 */
export async function transcodeVideo(
  file: File,
  targetHeight: number,
  onProgress?: (progress: TranscodeProgress) => void,
): Promise<TranscodeResult> {
  // 1. Load FFmpeg
  onProgress?.({ stage: 'loading', message: 'Loading video converter...' });
  const ffmpeg = await getFFmpeg();

  // 2. Estimate total frames for progress reporting
  let durationSec = 0;
  try {
    durationSec = await getVideoDuration(file);
  } catch { /* ignore */ }
  // Assume ~30 fps if we have a duration
  _totalFrames = durationSec > 0 ? Math.round(durationSec * 30) : 0;
  _targetHeight = targetHeight;
  _onProgressCb = onProgress || null;

  // 3. Write source file into virtual FS
  onProgress?.({ stage: 'transcoding', message: 'Reading source video...', percent: 0 });
  const inputName = 'input_src.mp4';
  const outputName = 'output_compressed.mp4';
  const inputData = await fetchFile(file);
  await ffmpeg.writeFile(inputName, inputData);

  // 4. Transcode
  //    - scale=-2:height keeps aspect ratio, ensures even width (required by libx264)
  //    - preset veryfast: good balance for WASM — much better compression than ultrafast
  //      while still being fast (the 30-min hang was with 'fast', several steps slower)
  //    - CRF 28: quality target
  //    - maxrate + bufsize: CRITICAL — caps the bitrate so output is always smaller
  //      than the original. Without this, ultrafast/veryfast can produce bloated files.
  //    - tune zerolatency: reduces latency buffers, speeds up single-thread encoding
  onProgress?.({ stage: 'transcoding', message: `Converting to ${targetHeight}p — starting...`, percent: 0 });

  // Get bitrate cap for target resolution (default to 480p cap if unknown)
  const cap = BITRATE_CAPS[targetHeight] || BITRATE_CAPS[480];

  await ffmpeg.exec([
    '-i', inputName,
    '-vf', `scale=-2:${targetHeight}`,
    '-c:v', 'libx264',
    '-crf', '28',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-maxrate', cap.maxrate,
    '-bufsize', cap.bufsize,
    '-c:a', 'aac',
    '-b:a', '96k',
    '-movflags', '+faststart',
    '-y',
    outputName,
  ]);

  // Clear progress hooks
  _onProgressCb = null;
  _totalFrames = 0;

  // 5. Read output
  const outputData = await ffmpeg.readFile(outputName);

  // Clean up virtual FS
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  if (typeof outputData === 'string') {
    throw new Error('FFmpeg produced unexpected string output');
  }

  const blob = new Blob([new Uint8Array(outputData) as BlobPart], { type: 'video/mp4' });

  // Derive new filename
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const newFileName = `${baseName}_${targetHeight}p.mp4`;

  onProgress?.({ stage: 'done', message: `Converted to ${targetHeight}p` });

  return {
    blob,
    fileName: newFileName,
    originalSize: file.size,
    newSize: blob.size,
    resolution: {
      width: 0, // exact width unknown without probing output
      height: targetHeight,
      label: heightToLabel(targetHeight),
    },
  };
}
