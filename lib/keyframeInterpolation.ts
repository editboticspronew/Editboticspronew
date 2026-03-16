/**
 * Keyframe interpolation engine.
 * Given a sorted array of keyframes and the current relative time,
 * returns the interpolated property values.
 */

import type { Keyframe, TextOverlay } from '@/store/editorSlice';

export interface InterpolatedValues {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  rotation: number;
  fontSize: number;
}

/**
 * Linear interpolation between two numbers.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Given sorted keyframes and a relative time (within the overlay's duration),
 * interpolate between the surrounding keyframes.
 * Falls back to the overlay's base values for any property not defined in keyframes.
 */
export function interpolateKeyframes(
  overlay: TextOverlay,
  relativeTime: number,
): InterpolatedValues {
  const base: InterpolatedValues = {
    x: overlay.x,
    y: overlay.y,
    scaleX: overlay.scaleX,
    scaleY: overlay.scaleY,
    opacity: overlay.opacity,
    rotation: overlay.rotation,
    fontSize: overlay.fontSize,
  };

  const keyframes = overlay.keyframes;
  if (!keyframes || keyframes.length === 0) return base;

  // Clamp time to overlay duration
  const t = Math.max(0, Math.min(overlay.duration, relativeTime));

  // Find the two surrounding keyframes
  let before: Keyframe | null = null;
  let after: Keyframe | null = null;

  for (const kf of keyframes) {
    if (kf.time <= t) before = kf;
    if (kf.time >= t && !after) after = kf;
  }

  // If no keyframes around, use base
  if (!before && !after) return base;
  if (!before) before = after;
  if (!after) after = before;

  // Calculate interpolation factor
  const beforeTime = before!.time;
  const afterTime = after!.time;
  const range = afterTime - beforeTime;
  const factor = range > 0 ? (t - beforeTime) / range : 0;

  // Interpolate each property
  const result = { ...base };
  const props: (keyof Omit<Keyframe, 'id' | 'time'>)[] = ['x', 'y', 'scaleX', 'scaleY', 'opacity', 'rotation', 'fontSize'];

  for (const prop of props) {
    const bVal = before![prop] ?? base[prop as keyof InterpolatedValues];
    const aVal = after![prop] ?? base[prop as keyof InterpolatedValues];
    if (bVal !== undefined && aVal !== undefined) {
      result[prop as keyof InterpolatedValues] = lerp(bVal, aVal, factor);
    }
  }

  return result;
}
