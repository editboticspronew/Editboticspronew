'use client';

import React, { useCallback, useRef } from 'react';
import { Box, useTheme, alpha, Typography } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { updateClip, commitClipUpdate, selectClip } from '@/store/editorSlice';
import type { Clip } from '@/store/editorSlice';
import { useSnapPoints } from '@/hooks/useSnapPoints';
import WaveformDisplay from './WaveformDisplay';

const TYPE_COLORS: Record<string, string> = {
  video: '#14b8a6',
  audio: '#8b5cf6',
  image: '#f59e0b',
  text: '#ec4899',
};

interface TimelineClipProps {
  clip: Clip;
  trackId: string;
  trackType: string;
  locked: boolean;
  onSnapLine?: (time: number | null) => void;
}

export default function TimelineClip({ clip, trackId, trackType, locked, onSnapLine }: TimelineClipProps) {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { zoom, selectedClipId } = useAppSelector((s) => s.editor);
  const isSelected = selectedClipId === clip.id;
  const snap = useSnapPoints(clip.id);

  const dragRef = useRef<{
    mode: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    origStart: number;
    origDuration: number;
  } | null>(null);

  const left = clip.startTime * zoom;
  const width = Math.max(clip.duration * zoom, 4);
  const color = TYPE_COLORS[trackType] || TYPE_COLORS.video;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, mode: 'move' | 'resize-left' | 'resize-right') => {
      if (locked) return;
      e.stopPropagation();
      e.preventDefault();

      dispatch(selectClip({ trackId, clipId: clip.id }));

      dragRef.current = {
        mode,
        startX: e.clientX,
        origStart: clip.startTime,
        origDuration: clip.duration,
      };

      const handleMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dt = dx / zoom;

        if (dragRef.current.mode === 'move') {
          const raw = Math.max(0, dragRef.current.origStart + dt);
          const startSnap = snap(raw);
          const endSnap = snap(raw + dragRef.current.origDuration);

          // Prefer whichever edge is closer to a snap point
          let snappedStart = raw;
          let activeLine: number | null = null;
          if (startSnap.snapped && (!endSnap.snapped || Math.abs(startSnap.value - raw) <= Math.abs(endSnap.value - (raw + dragRef.current.origDuration)))) {
            snappedStart = startSnap.value;
            activeLine = startSnap.snapLine;
          } else if (endSnap.snapped) {
            snappedStart = endSnap.value - dragRef.current.origDuration;
            activeLine = endSnap.snapLine;
          }

          onSnapLine?.(activeLine);
          dispatch(updateClip({ trackId, clipId: clip.id, updates: { startTime: Math.max(0, snappedStart) } }));
        } else if (dragRef.current.mode === 'resize-left') {
          const rawStart = Math.max(0, dragRef.current.origStart + dt);
          const s = snap(rawStart);
          const newStart = s.snapped ? s.value : rawStart;
          const newDur = Math.max(0.2, dragRef.current.origDuration - (newStart - dragRef.current.origStart));
          onSnapLine?.(s.snapLine);
          dispatch(updateClip({ trackId, clipId: clip.id, updates: { startTime: newStart, duration: newDur } }));
        } else if (dragRef.current.mode === 'resize-right') {
          const rawEnd = dragRef.current.origStart + Math.max(0.2, dragRef.current.origDuration + dt);
          const s = snap(rawEnd);
          const newDur = (s.snapped ? s.value : rawEnd) - dragRef.current.origStart;
          onSnapLine?.(s.snapLine);
          dispatch(updateClip({ trackId, clipId: clip.id, updates: { duration: Math.max(0.2, newDur) } }));
        }
      };

      const handleUp = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dt = dx / zoom;

        onSnapLine?.(null);

        // Commit final position to undo history
        if (Math.abs(dx) > 2) {
          if (dragRef.current.mode === 'move') {
            const raw = Math.max(0, dragRef.current.origStart + dt);
            const startSnap = snap(raw);
            const endSnap = snap(raw + dragRef.current.origDuration);
            let snappedStart = raw;
            if (startSnap.snapped && (!endSnap.snapped || Math.abs(startSnap.value - raw) <= Math.abs(endSnap.value - (raw + dragRef.current.origDuration)))) {
              snappedStart = startSnap.value;
            } else if (endSnap.snapped) {
              snappedStart = endSnap.value - dragRef.current.origDuration;
            }
            dispatch(commitClipUpdate({ trackId, clipId: clip.id, updates: { startTime: Math.max(0, snappedStart) } }));
          } else if (dragRef.current.mode === 'resize-left') {
            const rawStart = Math.max(0, dragRef.current.origStart + dt);
            const s = snap(rawStart);
            const newStart = s.snapped ? s.value : rawStart;
            const newDur = Math.max(0.2, dragRef.current.origDuration - (newStart - dragRef.current.origStart));
            dispatch(commitClipUpdate({ trackId, clipId: clip.id, updates: { startTime: newStart, duration: newDur } }));
          } else if (dragRef.current.mode === 'resize-right') {
            const rawEnd = dragRef.current.origStart + Math.max(0.2, dragRef.current.origDuration + dt);
            const s = snap(rawEnd);
            const newDur = (s.snapped ? s.value : rawEnd) - dragRef.current.origStart;
            dispatch(commitClipUpdate({ trackId, clipId: clip.id, updates: { duration: Math.max(0.2, newDur) } }));
          }
        }

        dragRef.current = null;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [clip, trackId, locked, zoom, dispatch, snap, onSnapLine]
  );

  return (
    <Box
      sx={{
        position: 'absolute',
        left,
        width,
        top: 4,
        bottom: 4,
        bgcolor: color,
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        cursor: locked ? 'not-allowed' : 'grab',
        opacity: locked ? 0.5 : 1,
        border: isSelected ? `2px solid ${theme.palette.warning.main}` : '1px solid rgba(255,255,255,0.15)',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s',
        '&:hover': {
          boxShadow: `0 0 0 1px ${alpha(color, 0.6)}, 0 2px 8px ${alpha(color, 0.3)}`,
        },
        '&:active': {
          cursor: 'grabbing',
        },
      }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      {/* Waveform for audio/video clips */}
      {(trackType === 'audio' || trackType === 'video') && clip.fileUrl && (
        <WaveformDisplay
          url={clip.fileUrl}
          width={width}
          height={40}
          color={trackType === 'audio' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.25)'}
        />
      )}

      {/* Left resize handle */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: locked ? 'not-allowed' : 'ew-resize',
          bgcolor: 'rgba(255,255,255,0.15)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' },
          zIndex: 2,
        }}
        onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
      />

      {/* Label */}
      <Typography
        variant="caption"
        noWrap
        sx={{
          pl: 1.2,
          pr: 1.2,
          color: '#fff',
          fontSize: 10,
          fontWeight: 600,
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          flex: 1,
          minWidth: 0,
        }}
      >
        {clip.fileName}
      </Typography>

      {/* Right resize handle */}
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: locked ? 'not-allowed' : 'ew-resize',
          bgcolor: 'rgba(255,255,255,0.15)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' },
          zIndex: 2,
        }}
        onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
      />
    </Box>
  );
}
