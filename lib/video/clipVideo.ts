/**
 * Browser-based video clipping using FFmpeg WASM
 * Reuses the shared FFmpeg instance from extractAudio.ts
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading = false;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

/**
 * Get or initialize shared FFmpeg WASM instance (singleton)
 */
async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  if (ffmpegLoading && ffmpegLoadPromise) {
    return ffmpegLoadPromise;
  }

  ffmpegLoading = true;
  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
      if (!message.includes('frame=') && !message.includes('size=')) {
        console.log('[FFmpeg Clip]', message);
      }
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegInstance = ffmpeg;
    ffmpegLoading = false;
    console.log('✅ FFmpeg WASM loaded for video clipping');
    return ffmpeg;
  })();

  return ffmpegLoadPromise;
}

export interface ClipDefinition {
  index: number;
  start: number;
  end: number;
  duration: number;
  segmentCount: number;
  transcript: string;
  reasons: string[];
}

export interface ClipResult extends ClipDefinition {
  blob: Blob;
  objectUrl: string;
  fileSize: number;
}

export interface ClipProgress {
  stage: 'loading' | 'downloading' | 'clipping' | 'done';
  message: string;
  currentClip?: number;
  totalClips?: number;
}

export type TransitionType =
  | 'none'
  | 'fade'
  | 'fadeblack'
  | 'fadewhite'
  | 'dissolve'
  | 'wipeleft'
  | 'wiperight'
  | 'slideleft'
  | 'slideright'
  | 'circleclose'
  | 'circleopen'
  | 'smoothleft'
  | 'smoothright'
  | 'radial'
  | 'pixelize';

/**
 * Download a video from a URL and clip it in the browser using FFmpeg WASM.
 *
 * @param videoUrl - URL of the video file (e.g. Firebase Storage URL)
 * @param clips - Array of clip definitions with start/end times from the LLM
 * @param onProgress - Optional progress callback
 * @returns Array of ClipResult with blob URLs for preview/download
 */
export async function clipVideo(
  videoUrl: string,
  clips: ClipDefinition[],
  onProgress?: (progress: ClipProgress) => void
): Promise<ClipResult[]> {
  if (clips.length === 0) return [];

  // Step 1: Load FFmpeg
  onProgress?.({ stage: 'loading', message: 'Loading FFmpeg...' });
  const ffmpeg = await getFFmpeg();

  // Step 2: Download video
  onProgress?.({ stage: 'downloading', message: 'Downloading video...' });
  console.log('📥 Downloading video for clipping...');

  const videoData = await fetchFile(videoUrl);
  const inputName = 'input_video.mp4';
  await ffmpeg.writeFile(inputName, videoData);
  console.log(`✅ Video loaded into FFmpeg (${(videoData.byteLength / 1024 / 1024).toFixed(2)} MB)`);

  // Step 3: Clip each segment
  const results: ClipResult[] = [];

  for (const clip of clips) {
    const outputName = `clip_${clip.index}.mp4`;
    const duration = clip.end - clip.start;

    onProgress?.({
      stage: 'clipping',
      message: `Cutting clip ${clip.index}/${clips.length} (${formatTime(clip.start)} → ${formatTime(clip.end)})...`,
      currentClip: clip.index,
      totalClips: clips.length,
    });

    console.log(`✂️ Clip ${clip.index}: ${formatTime(clip.start)} → ${formatTime(clip.end)} (${duration.toFixed(1)}s)`);

    try {
      // Use stream copy for speed. FFmpeg WASM doesn't support all codecs for re-encoding,
      // so stream copy (-c copy) is the safest and fastest option.
      await ffmpeg.exec([
        '-ss', String(clip.start),
        '-i', inputName,
        '-t', String(duration),
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-y',
        outputName,
      ]);

      const outputData = await ffmpeg.readFile(outputName);
      await ffmpeg.deleteFile(outputName).catch(() => {});

      if (typeof outputData === 'string') {
        console.error(`❌ Clip ${clip.index}: unexpected string output`);
        continue;
      }

      const blob = new Blob([new Uint8Array(outputData) as BlobPart], { type: 'video/mp4' });

      // If stream copy produced a tiny/empty file, try re-encoding
      if (blob.size < 1000) {
        console.log(`⚠️ Clip ${clip.index}: stream copy too small (${blob.size}B), re-encoding...`);
        await ffmpeg.exec([
          '-ss', String(clip.start),
          '-i', inputName,
          '-t', String(duration),
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-avoid_negative_ts', 'make_zero',
          '-y',
          outputName,
        ]);

        const reEncodedData = await ffmpeg.readFile(outputName);
        await ffmpeg.deleteFile(outputName).catch(() => {});

        if (typeof reEncodedData === 'string') continue;

        const reEncodedBlob = new Blob([new Uint8Array(reEncodedData) as BlobPart], { type: 'video/mp4' });
        const objectUrl = URL.createObjectURL(reEncodedBlob);

        results.push({
          ...clip,
          blob: reEncodedBlob,
          objectUrl,
          fileSize: reEncodedBlob.size,
        });
        console.log(`✅ Clip ${clip.index} (re-encoded): ${(reEncodedBlob.size / 1024 / 1024).toFixed(2)} MB`);
      } else {
        const objectUrl = URL.createObjectURL(blob);
        results.push({
          ...clip,
          blob,
          objectUrl,
          fileSize: blob.size,
        });
        console.log(`✅ Clip ${clip.index}: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      }
    } catch (err: any) {
      console.error(`❌ Clip ${clip.index} failed:`, err.message);
      // Continue with remaining clips
    }
  }

  // Clean up input file
  await ffmpeg.deleteFile(inputName).catch(() => {});

  onProgress?.({
    stage: 'done',
    message: `Generated ${results.length} clip(s)`,
    currentClip: clips.length,
    totalClips: clips.length,
  });

  return results;
}

/**
 * Merge multiple clip blobs into a single video using FFmpeg WASM.
 * Supports transition effects between clips using the xfade/acrossfade filters.
 * Falls back to simple concat (stream copy, no transitions) on failure.
 *
 * @param clips - Array of clip blobs to concatenate (in order), with optional duration
 * @param onProgress - Optional progress callback
 * @param options - Optional transition settings
 * @returns Merged video blob with object URL
 */
export async function mergeClips(
  clips: { blob: Blob; index: number; duration?: number }[],
  onProgress?: (progress: ClipProgress) => void,
  options?: {
    transition?: TransitionType;
    transitionDuration?: number;
  }
): Promise<{ blob: Blob; objectUrl: string; fileSize: number }> {
  if (clips.length === 0) throw new Error('No clips to merge');

  if (clips.length === 1) {
    const objectUrl = URL.createObjectURL(clips[0].blob);
    return { blob: clips[0].blob, objectUrl, fileSize: clips[0].blob.size };
  }

  onProgress?.({ stage: 'loading', message: 'Loading FFmpeg for merge...' });
  const ffmpeg = await getFFmpeg();

  // Write each clip to virtual FS
  for (let i = 0; i < clips.length; i++) {
    const name = `merge_clip_${i}.mp4`;
    const data = new Uint8Array(await clips[i].blob.arrayBuffer());
    await ffmpeg.writeFile(name, data);
    onProgress?.({
      stage: 'clipping',
      message: `Preparing clip ${i + 1}/${clips.length}...`,
      currentClip: i + 1,
      totalClips: clips.length,
    });
  }

  const transition = options?.transition ?? 'none';
  const rawTDur = Math.min(options?.transitionDuration ?? 0.5, 2.0);
  // Clamp transition duration to half the shortest clip to prevent overflows
  const minDuration = Math.min(...clips.map((c) => c.duration || 5));
  const tDur = Math.min(rawTDur, minDuration / 2);

  let outputData: Uint8Array | string | null = null;

  // --- Attempt merge WITH transitions (requires re-encoding) ---
  if (transition !== 'none') {
    onProgress?.({ stage: 'clipping', message: `Merging with ${transition} transition...` });
    try {
      const inputArgs: string[] = [];
      for (let i = 0; i < clips.length; i++) {
        inputArgs.push('-i', `merge_clip_${i}.mp4`);
      }

      // Build filter_complex: chain xfade for video, acrossfade for audio
      const vParts: string[] = [];
      const aParts: string[] = [];
      let lastV = '0:v';
      let lastA = '0:a';

      for (let i = 1; i < clips.length; i++) {
        // offset = sum(durations[0..i-1]) - i * transitionDuration
        const durationSum = clips
          .slice(0, i)
          .reduce((sum, c) => sum + (c.duration || 5), 0);
        const offset = Math.max(0.1, durationSum - i * tDur);

        const isLast = i === clips.length - 1;
        const vOut = isLast ? 'outv' : `v${i}`;
        const aOut = isLast ? 'outa' : `a${i}`;

        vParts.push(
          `[${lastV}][${i}:v]xfade=transition=${transition}:duration=${tDur.toFixed(3)}:offset=${offset.toFixed(3)}[${vOut}]`
        );
        aParts.push(
          `[${lastA}][${i}:a]acrossfade=d=${tDur.toFixed(3)}:c1=tri:c2=tri[${aOut}]`
        );

        lastV = vOut;
        lastA = aOut;
      }

      const filterComplex = [...vParts, ...aParts].join(';');
      console.log('[FFmpeg Merge] filter_complex:', filterComplex);

      await ffmpeg.exec([
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map', '[outv]',
        '-map', '[outa]',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        'merged_output.mp4',
      ]);

      const data = await ffmpeg.readFile('merged_output.mp4');
      if (typeof data !== 'string' && data.byteLength > 1000) {
        outputData = data;
        console.log('✅ Merged with transitions successfully');
      } else {
        console.warn('⚠️ Transition merge produced small/invalid output, falling back');
        await ffmpeg.deleteFile('merged_output.mp4').catch(() => {});
      }
    } catch (err: any) {
      console.warn('⚠️ Transition merge failed, falling back to simple concat:', err.message);
      await ffmpeg.deleteFile('merged_output.mp4').catch(() => {});
    }
  }

  // --- Fallback: simple concat without transitions (fast, stream copy) ---
  if (!outputData) {
    onProgress?.({ stage: 'clipping', message: 'Merging clips...' });
    const fileListLines: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      fileListLines.push(`file 'merge_clip_${i}.mp4'`);
    }
    await ffmpeg.writeFile('merge_list.txt', fileListLines.join('\n'));

    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'merge_list.txt',
      '-c', 'copy',
      '-y',
      'merged_output.mp4',
    ]);

    outputData = await ffmpeg.readFile('merged_output.mp4');
    await ffmpeg.deleteFile('merge_list.txt').catch(() => {});
  }

  // Clean up input files
  for (let i = 0; i < clips.length; i++) {
    await ffmpeg.deleteFile(`merge_clip_${i}.mp4`).catch(() => {});
  }
  await ffmpeg.deleteFile('merged_output.mp4').catch(() => {});

  if (typeof outputData === 'string') {
    throw new Error('Merge produced unexpected string output');
  }

  const blob = new Blob([new Uint8Array(outputData) as BlobPart], { type: 'video/mp4' });
  const objectUrl = URL.createObjectURL(blob);

  onProgress?.({ stage: 'done', message: 'Merge complete!' });

  return { blob, objectUrl, fileSize: blob.size };
}

/**
 * Revoke all object URLs from clip results to free memory.
 * Call this when clips are no longer needed.
 */
export function revokeClipUrls(clips: ClipResult[]): void {
  clips.forEach((clip) => {
    try {
      URL.revokeObjectURL(clip.objectUrl);
    } catch { /* ignore */ }
  });
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
