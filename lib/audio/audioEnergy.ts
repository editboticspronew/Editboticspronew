/**
 * Audio Energy Detection
 *
 * Analyzes audio levels in a video to detect high-energy moments
 * (applause, laughter, pitch spikes, volume peaks) as engagement signals
 * for improved clip selection.
 *
 * Uses FFmpeg WASM to extract raw PCM audio, then computes RMS energy
 * per time window and identifies peaks above the statistical threshold.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

// ─── FFmpeg Singleton ─────────────────────────────────────────

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading = false;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoading && ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoading = true;
  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
      if (!message.includes('frame=') && !message.includes('size=')) {
        console.log('[FFmpeg AudioEnergy]', message);
      }
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegInstance = ffmpeg;
    ffmpegLoading = false;
    console.log('✅ FFmpeg WASM loaded for audio energy analysis');
    return ffmpeg;
  })();

  return ffmpegLoadPromise;
}

// ─── Types ────────────────────────────────────────────────────

export interface AudioEnergyPeak {
  time: number;  // seconds into the video
  level: number; // 0-1 normalized RMS level
  type: 'spike' | 'sustained'; // spike = sudden jump, sustained = prolonged high energy
}

export interface AudioEnergyProfile {
  peaks: AudioEnergyPeak[];
  averageLevel: number;
  maxLevel: number;
  windowSize: number; // seconds per analysis window
  analyzedAt: string;
}

// ─── Analysis ─────────────────────────────────────────────────

const SAMPLE_RATE = 16000;
const WINDOW_SIZE = 0.5; // seconds per RMS window
const SAMPLES_PER_WINDOW = Math.floor(SAMPLE_RATE * WINDOW_SIZE);
const PEAK_THRESHOLD_SIGMA = 1.5; // peaks must be above mean + 1.5×σ
const MERGE_DISTANCE = 2.0; // merge peaks closer than 2s

/**
 * Analyze audio energy in a video to detect high-energy moments.
 *
 * Pipeline:
 *   1. FFmpeg WASM extracts raw 16-bit PCM mono audio at 16 kHz
 *   2. Compute RMS level per 0.5 s window
 *   3. Detect peaks above (mean + 1.5 × std-dev)
 *   4. Classify peaks as "spike" (sudden jump) or "sustained"
 *   5. Merge nearby peaks within 2 s
 *
 * @param videoUrl URL to the video (Firebase Storage or blob)
 * @param onProgress Optional progress callback
 * @returns AudioEnergyProfile with detected peaks
 */
export async function analyzeAudioEnergy(
  videoUrl: string,
  onProgress?: (message: string) => void,
): Promise<AudioEnergyProfile> {
  onProgress?.('Loading FFmpeg for audio analysis...');
  const ffmpeg = await getFFmpeg();

  onProgress?.('Extracting raw audio from video...');

  // Extract audio as raw 16-bit signed PCM, mono, 16 kHz
  await ffmpeg.writeFile('energy_input.mp4', await fetchFile(videoUrl));

  await ffmpeg.exec([
    '-i', 'energy_input.mp4',
    '-vn',                // no video
    '-acodec', 'pcm_s16le',
    '-ar', String(SAMPLE_RATE),
    '-ac', '1',           // mono
    '-f', 's16le',        // raw PCM, no header
    '-y',
    'energy_output.pcm',
  ]);

  const pcmData = await ffmpeg.readFile('energy_output.pcm');

  // Clean up virtual filesystem
  await ffmpeg.deleteFile('energy_input.mp4').catch(() => {});
  await ffmpeg.deleteFile('energy_output.pcm').catch(() => {});

  if (typeof pcmData === 'string') {
    throw new Error('Unexpected string output from FFmpeg audio extraction');
  }

  onProgress?.('Computing audio energy levels...');

  // Parse PCM → 16-bit signed integers
  const buffer = (pcmData as Uint8Array).buffer;
  const samples = new Int16Array(buffer);
  const totalWindows = Math.floor(samples.length / SAMPLES_PER_WINDOW);

  if (totalWindows === 0) {
    return {
      peaks: [],
      averageLevel: 0,
      maxLevel: 0,
      windowSize: WINDOW_SIZE,
      analyzedAt: new Date().toISOString(),
    };
  }

  // Compute RMS per window
  const rmsLevels: number[] = new Array(totalWindows);
  for (let w = 0; w < totalWindows; w++) {
    const offset = w * SAMPLES_PER_WINDOW;
    let sumSquares = 0;
    for (let i = 0; i < SAMPLES_PER_WINDOW; i++) {
      const normalized = samples[offset + i] / 32768; // normalise to −1…+1
      sumSquares += normalized * normalized;
    }
    rmsLevels[w] = Math.sqrt(sumSquares / SAMPLES_PER_WINDOW);
  }

  // Statistics
  const avgLevel = rmsLevels.reduce((a, b) => a + b, 0) / rmsLevels.length;
  const maxLevel = Math.max(...rmsLevels);
  const stdDev = Math.sqrt(
    rmsLevels.reduce((sum, v) => sum + (v - avgLevel) ** 2, 0) / rmsLevels.length,
  );

  // Find peaks above threshold
  const peakThreshold = avgLevel + PEAK_THRESHOLD_SIGMA * stdDev;
  const rawPeaks: AudioEnergyPeak[] = [];

  for (let w = 0; w < rmsLevels.length; w++) {
    if (rmsLevels[w] >= peakThreshold) {
      const time = (w + 0.5) * WINDOW_SIZE; // centre of window
      const normalizedLevel = maxLevel > 0 ? rmsLevels[w] / maxLevel : 0;

      // Classify: spike = sudden increase vs. sustained
      const prevLevel = w > 0 ? rmsLevels[w - 1] : 0;
      const isSuddenSpike = rmsLevels[w] - prevLevel > stdDev;

      rawPeaks.push({
        time,
        level: normalizedLevel,
        type: isSuddenSpike ? 'spike' : 'sustained',
      });
    }
  }

  // Merge nearby peaks (keep the strongest within MERGE_DISTANCE)
  const mergedPeaks: AudioEnergyPeak[] = [];
  for (const peak of rawPeaks) {
    const last = mergedPeaks[mergedPeaks.length - 1];
    if (last && peak.time - last.time < MERGE_DISTANCE) {
      // Keep the stronger peak
      if (peak.level > last.level) {
        mergedPeaks[mergedPeaks.length - 1] = peak;
      }
    } else {
      mergedPeaks.push({ ...peak });
    }
  }

  onProgress?.(`Found ${mergedPeaks.length} audio energy peak${mergedPeaks.length !== 1 ? 's' : ''}`);

  return {
    peaks: mergedPeaks,
    averageLevel: avgLevel,
    maxLevel,
    windowSize: WINDOW_SIZE,
    analyzedAt: new Date().toISOString(),
  };
}
