/**
 * Browser-based audio extraction from video files using FFmpeg WASM
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading = false;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

/**
 * Get or initialize a shared FFmpeg WASM instance (singleton)
 */
async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  // Prevent multiple simultaneous loads
  if (ffmpegLoading && ffmpegLoadPromise) {
    return ffmpegLoadPromise;
  }

  ffmpegLoading = true;
  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
      // Only log important messages, skip verbose frame output
      if (!message.includes('frame=') && !message.includes('size=')) {
        console.log('[FFmpeg]', message);
      }
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegInstance = ffmpeg;
    ffmpegLoading = false;
    console.log('✅ FFmpeg WASM loaded for audio extraction');
    return ffmpeg;
  })();

  return ffmpegLoadPromise;
}

export interface AudioExtractionProgress {
  stage: 'loading' | 'extracting' | 'done';
  message: string;
}

/**
 * Extract audio from a video File using browser-based FFmpeg WASM.
 * Returns a small MP3 Blob optimized for speech recognition (mono, 16kHz, 64kbps).
 *
 * @param videoFile - The video File object
 * @param onProgress - Optional callback for progress updates
 * @returns Audio Blob (MP3)
 */
export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (progress: AudioExtractionProgress) => void
): Promise<Blob> {
  onProgress?.({ stage: 'loading', message: 'Loading FFmpeg...' });

  const ffmpeg = await getFFmpeg();

  onProgress?.({ stage: 'extracting', message: 'Extracting audio from video...' });

  // Write video file to FFmpeg virtual filesystem
  const inputName = 'input_video' + getExtension(videoFile.name);
  const outputName = 'output_audio.mp3';

  await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

  // Extract audio: mono, 16kHz sample rate, 64kbps MP3 (optimal for speech recognition)
  await ffmpeg.exec([
    '-i', inputName,
    '-vn',              // No video
    '-acodec', 'libmp3lame',
    '-ar', '16000',     // 16kHz sample rate (Whisper optimal)
    '-ac', '1',         // Mono
    '-b:a', '64k',      // 64kbps bitrate
    '-y',               // Overwrite
    outputName,
  ]);

  // Read the output audio
  const outputData = await ffmpeg.readFile(outputName);

  // Clean up virtual filesystem
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  if (typeof outputData === 'string') {
    throw new Error('Unexpected string output from FFmpeg');
  }

  const audioBlob = new Blob([new Uint8Array(outputData) as BlobPart], { type: 'audio/mpeg' });

  onProgress?.({ stage: 'done', message: 'Audio extracted successfully' });

  console.log(
    `✅ Audio extracted: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB ` +
    `(from ${(videoFile.size / 1024 / 1024).toFixed(2)} MB video)`
  );

  return audioBlob;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot !== -1 ? filename.substring(dot) : '.mp4';
}
