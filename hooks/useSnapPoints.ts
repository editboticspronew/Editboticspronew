'use client';

import { useMemo } from 'react';
import { useAppSelector } from '@/store/hooks';

/** Tolerance in seconds — how close a value needs to be to "snap" */
const SNAP_THRESHOLD_SEC = 0.15;

export interface SnapResult {
  value: number;
  snapped: boolean;
  snapLine: number | null; // the time position of the snap target (for visual indicator)
}

/**
 * Collect every "interesting" time point across all tracks
 * (clip starts, clip ends, playhead, grid ticks).
 *
 * Returns a function `snap(time)` that returns the nearest snapped value.
 */
export function useSnapPoints(excludeClipId?: string) {
  const { tracks, currentTime, snapEnabled, zoom } = useAppSelector((s) => s.editor);

  const points = useMemo(() => {
    if (!snapEnabled) return [];

    const pts = new Set<number>();

    // Playhead position
    pts.add(currentTime);

    // Every clip start & end
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.id === excludeClipId) continue;
        pts.add(clip.startTime);
        pts.add(clip.startTime + clip.duration);
      }
    }

    // Grid ticks (every 1s)
    const maxTime = Math.max(30, ...Array.from(pts));
    for (let t = 0; t <= maxTime + 5; t += 1) {
      pts.add(t);
    }

    return Array.from(pts).sort((a, b) => a - b);
  }, [tracks, currentTime, snapEnabled, excludeClipId]);

  /** Snap a single time value. */
  const snap = useMemo(() => {
    if (!snapEnabled) {
      return (value: number): SnapResult => ({ value, snapped: false, snapLine: null });
    }

    // Dynamic threshold: wider at low zoom, tighter at high zoom
    const threshold = Math.max(SNAP_THRESHOLD_SEC, 5 / zoom);

    return (value: number): SnapResult => {
      let closest = value;
      let minDist = Infinity;
      let snapTarget: number | null = null;

      for (const pt of points) {
        const dist = Math.abs(value - pt);
        if (dist < minDist && dist <= threshold) {
          minDist = dist;
          closest = pt;
          snapTarget = pt;
        }
      }

      return {
        value: closest,
        snapped: snapTarget !== null,
        snapLine: snapTarget,
      };
    };
  }, [snapEnabled, points, zoom]);

  return snap;
}
