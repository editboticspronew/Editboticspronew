'use client';

import React, { useMemo, useCallback } from 'react';
import {
  Box,
  IconButton,
  Typography,
  useTheme,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  Lock,
  LockOpen,
  Visibility,
  VisibilityOff,
  VolumeOff,
  VolumeUp,
  Delete,
  VideoLibrary,
  AudioFile,
  Image as ImageIcon,
  TextFields,
  DragIndicator,
} from '@mui/icons-material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  toggleTrackLock,
  toggleTrackVisibility,
  toggleTrackMute,
  deleteTrack,
  addClip,
  selectText,
} from '@/store/editorSlice';
import type { Track, Clip } from '@/store/editorSlice';
import TimelineClip from './TimelineClip';
import TransitionIndicator from './TransitionIndicator';

const TRACK_ICONS: Record<string, React.ReactNode> = {
  video: <VideoLibrary fontSize="small" />,
  audio: <AudioFile fontSize="small" />,
  image: <ImageIcon fontSize="small" />,
  text: <TextFields fontSize="small" />,
};

interface TimelineTrackProps {
  track: Track;
  onSnapLine?: (time: number | null) => void;
}

export default function TimelineTrack({ track, onSnapLine }: TimelineTrackProps) {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { zoom, duration, currentTime, tracks } = useAppSelector((s) => s.editor);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : undefined,
  };

  const totalWidth = duration * zoom;

  // Compute adjacent clip pairs for transition indicators
  const adjacentPairs = useMemo(() => {
    if (track.type === 'text') return []; // No transitions for text tracks
    const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
    const pairs: { clipAId: string; clipBId: string; positionPx: number }[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const clipA = sorted[i];
      const clipB = sorted[i + 1];
      const endA = clipA.startTime + clipA.duration;
      const gap = clipB.startTime - endA;
      // Show transition indicator when clips are adjacent or slightly overlapping (within 2s gap)
      if (gap <= 2 && gap >= -2) {
        const midpoint = (endA + clipB.startTime) / 2;
        pairs.push({ clipAId: clipA.id, clipBId: clipB.id, positionPx: midpoint * zoom });
      }
    }
    return pairs;
  }, [track.clips, track.type, zoom]);

  // Drop handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (track.locked) return;

    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;

    try {
      const file = JSON.parse(raw);
      if (track.type === 'text') return; // Text is added via dialog

      const createAndAddClip = (dur: number) => {
        const newClip: Clip = {
          id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          fileId: file.id,
          fileName: file.name,
          fileUrl: file.url,
          fileType: file.type,
          storagePath: file.storagePath,
          startTime: currentTime,
          duration: dur,
          trimStart: 0,
          trimEnd: 0,
        };
        dispatch(addClip({ trackId: track.id, clip: newClip }));
      };

      // Use saved duration if available
      if (file.duration && file.duration > 0) {
        createAndAddClip(file.duration);
      } else if (file.type === 'image') {
        createAndAddClip(5);
      } else if (file.url && (file.type === 'video' || file.type === 'audio')) {
        // Probe actual media duration from the URL
        const el = file.type === 'video'
          ? document.createElement('video')
          : document.createElement('audio');
        el.preload = 'metadata';
        el.crossOrigin = 'anonymous';
        el.onloadedmetadata = () => {
          const d = isFinite(el.duration) && el.duration > 0 ? el.duration : 10;
          createAndAddClip(d);
          el.src = '';
          el.remove();
        };
        el.onerror = () => {
          createAndAddClip(10); // fallback
          el.remove();
        };
        el.src = file.url;
      } else {
        createAndAddClip(10);
      }
    } catch {
      // ignore malformed data
    }
  };

  const handleTextClipClick = (clipId: string) => {
    if (track.type === 'text') {
      dispatch(selectText(clipId));
    }
  };

  const handleDeleteTrack = useCallback(() => {
    const sameTypeTracks = tracks.filter(t => t.type === track.type);
    if (sameTypeTracks.length <= 1) {
      const ok = window.confirm(
        `This is the only ${track.type} track. Deleting it will remove all its clips.\n\nYou can add a new ${track.type} track from the toolbar.\n\nDelete anyway?`
      );
      if (!ok) return;
    }
    dispatch(deleteTrack(track.id));
  }, [tracks, track.type, track.id, dispatch]);

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        borderBottom: 1,
        borderColor: alpha(theme.palette.divider, 0.5),
        minHeight: 48,
      }}
    >
      {/* Track header */}
      <Box
        sx={{
          width: 180,
          flexShrink: 0,
          px: 1,
          py: 0.5,
          bgcolor: alpha(theme.palette.background.default, 0.7),
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        {/* Drag handle */}
        <Box
          {...attributes}
          {...listeners}
          sx={{
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' },
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIndicator sx={{ fontSize: 16 }} />
        </Box>
        {TRACK_ICONS[track.type]}
        <Typography
          variant="caption"
          fontWeight={600}
          noWrap
          sx={{ flexGrow: 1, minWidth: 0, fontSize: 11 }}
        >
          {track.name}
        </Typography>

        {track.type === 'audio' && (
          <Tooltip title={track.muted ? 'Unmute' : 'Mute'}>
            <IconButton size="small" onClick={() => dispatch(toggleTrackMute(track.id))} sx={{ p: 0.3 }}>
              {track.muted ? (
                <VolumeOff sx={{ fontSize: 14 }} />
              ) : (
                <VolumeUp sx={{ fontSize: 14 }} />
              )}
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title={track.locked ? 'Unlock' : 'Lock'}>
          <IconButton size="small" onClick={() => dispatch(toggleTrackLock(track.id))} sx={{ p: 0.3 }}>
            {track.locked ? <Lock sx={{ fontSize: 14 }} /> : <LockOpen sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>

        <Tooltip title={track.visible ? 'Hide' : 'Show'}>
          <IconButton size="small" onClick={() => dispatch(toggleTrackVisibility(track.id))} sx={{ p: 0.3 }}>
            {track.visible ? (
              <Visibility sx={{ fontSize: 14 }} />
            ) : (
              <VisibilityOff sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        </Tooltip>

        <Tooltip title="Delete Track">
          <IconButton size="small" color="error" onClick={handleDeleteTrack} sx={{ p: 0.3 }}>
            <Delete sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Track content (clips) */}
      <Box
        sx={{
          flexGrow: 1,
          position: 'relative',
          minHeight: 48,
          width: totalWidth,
          minWidth: '100%',
          bgcolor: track.visible
            ? 'transparent'
            : alpha(theme.palette.action.disabled, 0.05),
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {track.clips.map((clip) => (
          <Box
            key={clip.id}
            onClick={() => handleTextClipClick(clip.id)}
          >
            <TimelineClip
              clip={clip}
              trackId={track.id}
              trackType={track.type}
              locked={track.locked}
              onSnapLine={onSnapLine}
            />
          </Box>
        ))}

        {/* Transition indicators between adjacent clips */}
        {adjacentPairs.map((pair) => (
          <TransitionIndicator
            key={`${pair.clipAId}-${pair.clipBId}`}
            trackId={track.id}
            clipAId={pair.clipAId}
            clipBId={pair.clipBId}
            positionPx={pair.positionPx}
          />
        ))}

        {/* Empty drop hint */}
        {track.clips.length === 0 && track.type !== 'text' && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.5, fontSize: 10 }}>
              Drop {track.type} here
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
