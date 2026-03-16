'use client';

import { useEffect, useRef, useState } from 'react';

// Number of bars to sample from the audio
const DEFAULT_SAMPLES = 200;

/**
 * Decode audio from a URL and return normalized peak data.
 * Uses Web Audio API (no wavesurfer.js dependency for timeline waveforms).
 */
export function useWaveform(url: string | undefined, samples = DEFAULT_SAMPLES) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, number[]>>(new Map());

  useEffect(() => {
    if (!url) {
      setPeaks([]);
      return;
    }

    // Cache hit
    const cached = cacheRef.current.get(url);
    if (cached) {
      setPeaks(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const response = await fetch(url);
        if (cancelled) return;
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        if (cancelled) {
          audioCtx.close();
          return;
        }

        // Get raw PCM data (mix down to mono)
        const channelData = audioBuffer.getChannelData(0);
        const blockSize = Math.floor(channelData.length / samples);
        const result: number[] = [];

        for (let i = 0; i < samples; i++) {
          let sum = 0;
          const start = i * blockSize;
          const end = Math.min(start + blockSize, channelData.length);
          for (let j = start; j < end; j++) {
            sum += Math.abs(channelData[j]);
          }
          result.push(sum / blockSize);
        }

        // Normalize to 0–1
        const max = Math.max(...result, 0.001);
        const normalized = result.map((v) => v / max);

        if (!cancelled) {
          cacheRef.current.set(url, normalized);
          setPeaks(normalized);
        }

        audioCtx.close();
      } catch (err) {
        // Silently fail for non-audio or CORS-blocked files
        if (!cancelled) setPeaks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, samples]);

  return { peaks, loading };
}
