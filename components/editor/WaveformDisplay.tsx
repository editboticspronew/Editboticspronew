'use client';

import React, { useRef, useEffect } from 'react';
import { useWaveform } from '@/hooks/useWaveform';

interface WaveformDisplayProps {
  url: string | undefined;
  width: number;
  height: number;
  color?: string;
}

/**
 * Renders a waveform visualization inside a small canvas.
 * Used inside TimelineClip for audio & video tracks.
 */
export default function WaveformDisplay({ url, width, height, color = 'rgba(255,255,255,0.5)' }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samples = Math.max(50, Math.round(width / 2));
  const { peaks } = useWaveform(url, samples);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / peaks.length;
    const centerY = height / 2;

    ctx.fillStyle = color;

    for (let i = 0; i < peaks.length; i++) {
      const barHeight = peaks[i] * (height * 0.8);
      const x = i * barWidth;
      // Draw symmetric from center
      ctx.fillRect(x, centerY - barHeight / 2, Math.max(barWidth - 0.5, 0.5), barHeight || 1);
    }
  }, [peaks, width, height, color]);

  if (!url || peaks.length === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    />
  );
}
