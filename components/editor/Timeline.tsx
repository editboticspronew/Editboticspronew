'use client';

import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  useTheme,
  alpha,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import {
  VideoLibrary,
  AudioFile,
  Image as ImageIcon,
  Add,
  ZoomIn,
  ZoomOut,
  FitScreen,
  Undo,
  Redo,
  PlayArrow,
  Pause,
  Stop,
  SkipNext,
  SkipPrevious,
  ContentCut,
  Straighten,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  addTrack,
  setZoom,
  undo,
  redo,
  togglePlaying,
  stop,
  setCurrentTime,
  splitClip,
  toggleSnap,
  reorderTracks,
} from '@/store/editorSlice';
import TimelineRuler from './TimelineRuler';
import TimelineTrack from './TimelineTrack';

interface TimelineProps {
  onAddText: () => void;
}

export default function Timeline({ onAddText }: TimelineProps) {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const {
    tracks,
    zoom,
    currentTime,
    isPlaying,
    duration,
    past,
    future,
    selectedClipId,
    selectedTrackId,
    snapEnabled,
  } = useAppSelector((s) => s.editor);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSnapLine, setActiveSnapLine] = useState<number | null>(null);

  const handleSnapLine = useCallback((time: number | null) => {
    setActiveSnapLine(time);
  }, []);

  // Drag-and-drop reorder
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const trackIds = useMemo(() => tracks.map((t) => t.id), [tracks]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIdx = tracks.findIndex((t) => t.id === active.id);
        const newIdx = tracks.findIndex((t) => t.id === over.id);
        if (oldIdx !== -1 && newIdx !== -1) {
          const newOrder = arrayMove(trackIds, oldIdx, newIdx);
          dispatch(reorderTracks(newOrder));
        }
      }
    },
    [tracks, trackIds, dispatch],
  );

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * 30);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };

  const handleSplit = () => {
    if (selectedClipId && selectedTrackId) {
      dispatch(splitClip({ trackId: selectedTrackId, clipId: selectedClipId, splitTime: currentTime }));
    }
  };

  return (
    <Box
      sx={{
        height: 300,
        bgcolor: alpha(theme.palette.background.paper, 0.95),
        borderTop: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          py: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
          gap: 0.5,
          minHeight: 40,
        }}
      >
        {/* Transport controls */}
        <Tooltip title="Stop">
          <IconButton size="small" onClick={() => dispatch(stop())}>
            <Stop fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
          <IconButton
            size="small"
            onClick={() => dispatch(togglePlaying())}
            sx={{
              bgcolor: isPlaying ? alpha(theme.palette.primary.main, 0.2) : undefined,
            }}
          >
            {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* Timecode */}
        <Typography
          variant="caption"
          sx={{
            fontFamily: 'monospace',
            fontSize: 12,
            fontWeight: 700,
            px: 1,
            py: 0.3,
            bgcolor: alpha(theme.palette.common.black, 0.3),
            borderRadius: 1,
            minWidth: 80,
            textAlign: 'center',
          }}
        >
          {formatTime(currentTime)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
          / {formatTime(duration)}
        </Typography>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Edit tools */}
        <Tooltip title="Split at Playhead (S)">
          <span>
            <IconButton size="small" disabled={!selectedClipId} onClick={handleSplit}>
              <ContentCut fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Undo (Ctrl+Z)">
          <span>
            <IconButton size="small" disabled={past.length === 0} onClick={() => dispatch(undo())}>
              <Undo fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Redo (Ctrl+Shift+Z)">
          <span>
            <IconButton size="small" disabled={future.length === 0} onClick={() => dispatch(redo())}>
              <Redo fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={snapEnabled ? 'Disable Snap' : 'Enable Snap'}>
          <IconButton
            size="small"
            onClick={() => dispatch(toggleSnap())}
            sx={{
              bgcolor: snapEnabled ? alpha(theme.palette.primary.main, 0.2) : undefined,
              color: snapEnabled ? 'primary.main' : 'text.secondary',
            }}
          >
            <Straighten fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Add track buttons */}
        <Tooltip title="Add Video Track">
          <IconButton size="small" onClick={() => dispatch(addTrack({ type: 'video' }))}>
            <VideoLibrary fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Add Image Track">
          <IconButton size="small" onClick={() => dispatch(addTrack({ type: 'image' }))}>
            <ImageIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Add Audio Track">
          <IconButton size="small" onClick={() => dispatch(addTrack({ type: 'audio' }))}>
            <AudioFile fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Add Text">
          <IconButton size="small" onClick={onAddText}>
            <Add fontSize="small" />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        {/* Zoom controls */}
        <Tooltip title="Zoom Out">
          <IconButton size="small" onClick={() => dispatch(setZoom(zoom - 10))}>
            <ZoomOut fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, minWidth: 32, textAlign: 'center' }}>
          {zoom}px/s
        </Typography>
        <Tooltip title="Zoom In">
          <IconButton size="small" onClick={() => dispatch(setZoom(zoom + 10))}>
            <ZoomIn fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Fit to View">
          <IconButton size="small" onClick={() => dispatch(setZoom(50))}>
            <FitScreen fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Scrollable timeline area */}
      <Box
        ref={scrollRef}
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {/* Ruler */}
        <Box sx={{ position: 'sticky', top: 0, zIndex: 15, ml: '180px' }}>
          <TimelineRuler />
        </Box>

        {/* Tracks */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={trackIds} strategy={verticalListSortingStrategy}>
        <Box sx={{ position: 'relative' }}>
          {tracks.map((track) => (
            <TimelineTrack key={track.id} track={track} onSnapLine={handleSnapLine} />
          ))}

          {tracks.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                No tracks — add one to get started
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<VideoLibrary />}
                  onClick={() => dispatch(addTrack({ type: 'video' }))}
                >
                  Video Track
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AudioFile />}
                  onClick={() => dispatch(addTrack({ type: 'audio' }))}
                >
                  Audio Track
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ImageIcon />}
                  onClick={() => dispatch(addTrack({ type: 'image' }))}
                >
                  Image Track
                </Button>
              </Box>
            </Box>
          )}

          {/* Playhead line across all tracks */}
          <Box
            sx={{
              position: 'absolute',
              left: 180 + currentTime * zoom,
              top: 0,
              bottom: 0,
              width: 1.5,
              bgcolor: 'error.main',
              zIndex: 10,
              pointerEvents: 'none',
              boxShadow: `0 0 4px ${theme.palette.error.main}`,
            }}
          />

          {/* Snap guide line */}
          {activeSnapLine !== null && (
            <Box
              sx={{
                position: 'absolute',
                left: 180 + activeSnapLine * zoom,
                top: 0,
                bottom: 0,
                width: 1,
                bgcolor: theme.palette.warning.main,
                zIndex: 9,
                pointerEvents: 'none',
                opacity: 0.7,
                borderLeft: `1px dashed ${theme.palette.warning.main}`,
              }}
            />
          )}
        </Box>
        </SortableContext>
        </DndContext>
      </Box>
    </Box>
  );
}
