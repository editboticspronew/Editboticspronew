'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Typography,
  useTheme,
  alpha,
  TextField,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  VolumeUp,
  VolumeOff,
  ZoomIn,
  ZoomOut,
  FitScreen,
  Delete,
} from '@mui/icons-material';

// TODO: Add text dragging in preview for position control
// TODO: Make timeline clips draggable for timing control
// TODO: Add clip resize handles for duration control

interface Clip {
  id: string;
  fileId: string;
  fileName: string;
  fileUrl?: string;
  fileType?: string;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
}

interface Track {
  id: string;
  type: 'video' | 'audio' | 'text' | 'image';
  name: string;
  locked: boolean;
  visible: boolean;
  clips: Clip[];
}

interface VideoPreviewProps {
  tracks: Track[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onTimeUpdate: (time: number) => void;
  textOverlays?: any[];
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  selectedTextId?: string | null;
  onTextSelect?: (id: string) => void;
  onTextUpdate?: (id: string, updates: any) => void;
  onTextDelete?: (id: string) => void;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  tracks,
  currentTime,
  duration,
  isPlaying,
  onPlayPause,
  onStop,
  onTimeUpdate,
  textOverlays = [],
  zoom = 50,
  onZoomChange,
  selectedTextId = null,
  onTextSelect,
  onTextUpdate,
  onTextDelete,
}) => {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const [isMuted, setIsMuted] = useState(false);
  const [activeVideoClip, setActiveVideoClip] = useState<Clip | null>(null);
  const [activeImageClips, setActiveImageClips] = useState<Clip[]>([]);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const textStartPos = useRef({ x: 0, y: 0 });

  // Find active clips at current time
  useEffect(() => {
    const videoTrack = tracks.find(t => t.type === 'video');
    const imageTrack = tracks.find(t => t.type === 'image');
    
    if (videoTrack) {
      const activeClip = videoTrack.clips.find(
        clip => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration
      );
      setActiveVideoClip(activeClip || null);
    }

    if (imageTrack) {
      const activeImages = imageTrack.clips.filter(
        clip => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration
      );
      setActiveImageClips(activeImages);
    }
  }, [currentTime, tracks]);

  // Handle video playback
  useEffect(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  // Sync video time with current time
  useEffect(() => {
    if (!videoRef.current || !activeVideoClip) return;

    const videoTime = currentTime - activeVideoClip.startTime + activeVideoClip.trimStart;
    
    if (Math.abs(videoRef.current.currentTime - videoTime) > 0.1) {
      videoRef.current.currentTime = videoTime;
    }
  }, [currentTime, activeVideoClip]);

  // Update current time from video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (isPlaying && activeVideoClip) {
        const newTime = activeVideoClip.startTime + (video.currentTime - activeVideoClip.trimStart);
        onTimeUpdate(newTime);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isPlaying, activeVideoClip, onTimeUpdate]);

  // Handle stop
  const handleStop = () => {
    onStop();
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  // Handle text dragging
  const handleTextMouseDown = (e: React.MouseEvent, overlay: any) => {
    e.preventDefault();
    e.stopPropagation();
    onTextSelect?.(overlay.id);
    setDraggingTextId(overlay.id);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    textStartPos.current = { x: overlay.x, y: overlay.y };
  };

  useEffect(() => {
    if (!draggingTextId || !previewRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const previewRect = previewRef.current?.getBoundingClientRect();
      if (!previewRect) return;

      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;

      const deltaXPercent = (deltaX / previewRect.width) * 100;
      const deltaYPercent = (deltaY / previewRect.height) * 100;

      const newX = Math.max(0, Math.min(100, textStartPos.current.x + deltaXPercent));
      const newY = Math.max(0, Math.min(100, textStartPos.current.y + deltaYPercent));

      onTextUpdate?.(draggingTextId, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setDraggingTextId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingTextId, onTextUpdate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: alpha(theme.palette.common.black, 0.9),
      }}
    >
      {/* Video Preview Area */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          position: 'relative',
        }}
      >
        <Paper
          ref={previewRef}
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 800,
            aspectRatio: '16/9',
            bgcolor: 'black',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 1,
            borderColor: 'divider',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {activeVideoClip ? (
            <video
              ref={videoRef}
              src={activeVideoClip.fileUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              muted={isMuted}
            />
          ) : activeImageClips.length > 0 ? (
            <img
              src={activeImageClips[0].fileUrl}
              alt="Preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          ) : (
            <Typography variant="h6" color="text.secondary">
              Video Preview
            </Typography>
          )}

          {/* Text Overlays */}
          {textOverlays
            .filter((overlay) => currentTime >= overlay.startTime && currentTime < overlay.startTime + overlay.duration)
            .map((overlay) => (
              <Box
                key={overlay.id}
                onMouseDown={(e) => handleTextMouseDown(e, overlay)}
                sx={{
                  position: 'absolute',
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  fontSize: overlay.fontSize,
                  color: overlay.color,
                  fontFamily: overlay.font || 'Arial',
                  fontWeight: 700,
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                  transform: 'translate(-50%, -50%)',
                  whiteSpace: 'nowrap',
                  cursor: draggingTextId === overlay.id ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  border: selectedTextId === overlay.id ? '2px dashed' : 'none',
                  borderColor: 'primary.main',
                  padding: selectedTextId === overlay.id ? 1 : 0,
                  transition: draggingTextId === overlay.id ? 'none' : 'all 0.2s',
                  '&:hover': {
                    border: '2px dashed',
                    borderColor: 'primary.light',
                    padding: 1,
                  },
                }}
              >
                {overlay.text}
              </Box>
            ))}
        </Paper>

        {/* Text Editing Panel */}
        {selectedTextId && textOverlays.find(t => t.id === selectedTextId) && (
          <Paper
            sx={{
              mt: 2,
              p: 2,
              bgcolor: alpha(theme.palette.background.paper, 0.95),
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Edit Text
            </Typography>
            {(() => {
              const selected = textOverlays.find(t => t.id === selectedTextId);
              if (!selected) return null;
              
              return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    size="small"
                    label="Text"
                    fullWidth
                    value={selected.text}
                    onChange={(e) => onTextUpdate?.(selectedTextId, { text: e.target.value })}
                  />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      select
                      size="small"
                      label="Font"
                      value={selected.font || 'Arial'}
                      onChange={(e) => onTextUpdate?.(selectedTextId, { font: e.target.value })}
                      SelectProps={{ native: true }}
                      sx={{ flex: 1 }}
                    >
                      <option value="Arial">Arial</option>
                      <option value="Inter">Inter</option>
                      <option value="Lato">Lato</option>
                    </TextField>
                    <TextField
                      size="small"
                      type="number"
                      label="Font Size"
                      value={selected.fontSize}
                      onChange={(e) => onTextUpdate?.(selectedTextId, { fontSize: Number(e.target.value) })}
                      sx={{ width: 100 }}
                    />
                    <TextField
                      size="small"
                      type="color"
                      label="Color"
                      value={selected.color}
                      onChange={(e) => onTextUpdate?.(selectedTextId, { color: e.target.value })}
                      sx={{ width: 100 }}
                    />
                    <IconButton
                      color="error"
                      onClick={() => onTextDelete?.(selectedTextId)}
                      size="small"
                      sx={{ ml: 'auto' }}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    💡 Drag text in preview to reposition • Drag clip on timeline to adjust timing
                  </Typography>
                </Box>
              );
            })()}
          </Paper>
        )}
      </Box>

      {/* Playback Controls */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <IconButton onClick={handleStop} size="large">
            <Stop />
          </IconButton>
          <IconButton onClick={onPlayPause} size="large">
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
          <IconButton onClick={handleMuteToggle} size="medium">
            {isMuted ? <VolumeOff /> : <VolumeUp />}
          </IconButton>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Typography>
          {onZoomChange && (
            <Box sx={{ display: 'flex', gap: 0.5, ml: 2 }}>
              <IconButton size="small" onClick={() => onZoomChange(Math.min(200, zoom + 10))}>
                <ZoomIn fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => onZoomChange(Math.max(20, zoom - 10))}>
                <ZoomOut fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => onZoomChange(50)}>
                <FitScreen fontSize="small" />
              </IconButton>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};
