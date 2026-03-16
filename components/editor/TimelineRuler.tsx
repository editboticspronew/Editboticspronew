'use client';

import React, { useRef, useCallback } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setCurrentTime, setPlaying } from '@/store/editorSlice';

export default function TimelineRuler() {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { currentTime, duration, zoom, isPlaying } = useAppSelector((s) => s.editor);
  const rulerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const totalWidth = duration * zoom;

  // Generate tick marks
  const ticks: { time: number; major: boolean }[] = [];
  const step = zoom >= 80 ? 1 : zoom >= 40 ? 2 : 5;
  for (let t = 0; t <= duration; t += step) {
    ticks.push({ time: t, major: true });
    // Minor ticks
    if (step === 1 && zoom >= 100) {
      for (let m = 0.25; m < 1; m += 0.25) {
        if (t + m <= duration) ticks.push({ time: t + m, major: false });
      }
    }
  }

  const timeFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      const rect = rulerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const x = e.clientX - rect.left + (rulerRef.current?.parentElement?.scrollLeft || 0);
      return Math.max(0, Math.min(duration, x / zoom));
    },
    [duration, zoom]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      if (isPlaying) dispatch(setPlaying(false));
      const time = timeFromEvent(e);
      dispatch(setCurrentTime(time));

      const handleMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const t = timeFromEvent(ev);
        dispatch(setCurrentTime(t));
      };
      const handleUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [dispatch, isPlaying, timeFromEvent]
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    if (mins > 0) return `${mins}:${String(secs).padStart(2, '0')}`;
    return `${secs}s`;
  };

  return (
    <Box
      ref={rulerRef}
      onMouseDown={handleMouseDown}
      sx={{
        height: 28,
        position: 'relative',
        width: totalWidth,
        minWidth: '100%',
        bgcolor: alpha(theme.palette.background.default, 0.6),
        borderBottom: 1,
        borderColor: 'divider',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Tick marks */}
      {ticks.map((tick) => (
        <Box
          key={tick.time}
          sx={{
            position: 'absolute',
            left: tick.time * zoom,
            top: tick.major ? 0 : 14,
            bottom: 0,
            width: 1,
            bgcolor: tick.major ? alpha(theme.palette.text.secondary, 0.4) : alpha(theme.palette.text.secondary, 0.15),
          }}
        >
          {tick.major && (
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                left: 3,
                top: 1,
                fontSize: 9,
                color: 'text.secondary',
                whiteSpace: 'nowrap',
                lineHeight: 1,
              }}
            >
              {formatTime(tick.time)}
            </Typography>
          )}
        </Box>
      ))}

      {/* Playhead triangle */}
      <Box
        sx={{
          position: 'absolute',
          left: currentTime * zoom - 6,
          top: 0,
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: `10px solid ${theme.palette.error.main}`,
          zIndex: 20,
          pointerEvents: 'none',
        }}
      />
    </Box>
  );
}
