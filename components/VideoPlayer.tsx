'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Slider,
  useTheme,
  alpha,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  VolumeUp,
  VolumeOff,
  VolumeDown,
  Fullscreen,
  FullscreenExit,
  Replay10,
  Forward10,
  PictureInPictureAlt,
} from '@mui/icons-material';

interface VideoPlayerProps {
  /** Video source URL (supports blob:, http, Firebase Storage, etc.) */
  url: string;
  /** Auto-play on mount */
  autoPlay?: boolean;
  /** Show player in compact mode (smaller controls) */
  compact?: boolean;
  /** Max height constraint */
  maxHeight?: number | string;
  /** Callback when time updates */
  onTimeUpdate?: (currentTime: number) => void;
  /** Subtitle text to overlay at any given moment */
  subtitleText?: string;
  /** Poster / thumbnail image */
  poster?: string;
  /** Border radius */
  borderRadius?: number;
}

function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoPlayer({
  url,
  autoPlay = false,
  compact = false,
  maxHeight = 400,
  onTimeUpdate,
  subtitleText,
  poster,
  borderRadius = 12,
}: VideoPlayerProps) {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(autoPlay);
  const [played, setPlayed] = useState(0); // 0-1 fraction
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ready, setReady] = useState(false);

  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls after 3s of inactivity when playing
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    hideTimerRef.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  const handleMouseMove = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

  const handleMouseLeave = useCallback(() => {
    if (playing) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setShowControls(false), 1000);
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) setShowControls(true);
    else scheduleHide();
  }, [playing, scheduleHide]);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleVideoTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const el = e.currentTarget;
      if (!seeking) {
        const frac = el.duration ? el.currentTime / el.duration : 0;
        setPlayed(frac);
        setCurrentTime(el.currentTime);
        onTimeUpdate?.(el.currentTime);
      }
    },
    [seeking, onTimeUpdate]
  );

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration);
    setReady(true);
  }, []);

  const handleSeekChange = (_: Event | React.SyntheticEvent, value: number | number[]) => {
    const v = value as number;
    setPlayed(v / 100);
    setSeeking(true);
  };

  const handleSeekCommit = (_: Event | React.SyntheticEvent, value: number | number[]) => {
    const v = value as number;
    setSeeking(false);
    if (videoRef.current && duration) {
      videoRef.current.currentTime = (v / 100) * duration;
    }
  };

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch { /* PiP not supported */ }
  };

  const handleClickPlayer = () => {
    setPlaying((p) => !p);
    scheduleHide();
  };

  // Sync play/pause to video element
  useEffect(() => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [playing]);

  // Sync volume to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = muted;
    }
  }, [volume, muted]);

  const iconSize = compact ? 'small' : 'medium';
  const controlsPy = compact ? 0.5 : 1;

  return (
    <Box
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      sx={{
        position: 'relative',
        width: '100%',
        maxHeight: isFullscreen ? '100vh' : maxHeight,
        bgcolor: '#000',
        borderRadius: isFullscreen ? 0 : `${borderRadius}px`,
        overflow: 'hidden',
        '& video': {
          objectFit: 'contain',
        },
        aspectRatio: '16/9',
      }}
    >
      {/* Player */}
      <Box
        onClick={handleClickPlayer}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          cursor: 'pointer',
        }}
      >
        <video
          ref={videoRef}
          src={url}
          poster={poster || undefined}
          playsInline
          onTimeUpdate={handleVideoTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setPlaying(false)}
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, objectFit: 'contain' }}
        />
      </Box>

      {/* Big play button overlay (when paused and controls visible) */}
      {!playing && ready && (
        <Box
          onClick={handleClickPlayer}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: alpha(theme.palette.primary.main, 0.85),
            borderRadius: '50%',
            width: compact ? 48 : 64,
            height: compact ? 48 : 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.2s, background-color 0.2s',
            boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.5)}`,
            zIndex: 4,
            '&:hover': {
              transform: 'translate(-50%, -50%) scale(1.1)',
              bgcolor: alpha(theme.palette.primary.main, 1),
            },
          }}
        >
          <PlayArrow sx={{ color: '#fff', fontSize: compact ? 28 : 36 }} />
        </Box>
      )}

      {/* Subtitle overlay */}
      {subtitleText && (
        <Box
          sx={{
            position: 'absolute',
            bottom: showControls ? (compact ? 60 : 80) : 24,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'rgba(0,0,0,0.78)',
            color: '#fff',
            px: 2,
            py: 0.5,
            borderRadius: 1,
            maxWidth: '90%',
            textAlign: 'center',
            pointerEvents: 'none',
            transition: 'bottom 0.3s ease',
            zIndex: 5,
          }}
        >
          <Typography variant="body2" sx={{ fontSize: compact ? '0.78rem' : '0.88rem', lineHeight: 1.4 }}>
            {subtitleText}
          </Typography>
        </Box>
      )}

      {/* Controls overlay */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: `linear-gradient(transparent, ${alpha('#000', 0.85)})`,
          pt: compact ? 2 : 3,
          pb: controlsPy,
          px: compact ? 1 : 2,
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.3s ease',
          zIndex: 10,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <Slider
          size="small"
          value={played * 100}
          onChange={handleSeekChange}
          onChangeCommitted={handleSeekCommit}
          sx={{
            color: theme.palette.primary.main,
            height: 4,
            p: 0,
            mb: 0.5,
            '& .MuiSlider-thumb': {
              width: 14,
              height: 14,
              transition: '0.15s cubic-bezier(.4,0,.2,1)',
              '&:hover, &.Mui-focusVisible': {
                boxShadow: `0 0 0 6px ${alpha(theme.palette.primary.main, 0.25)}`,
                width: 16,
                height: 16,
              },
            },
            '& .MuiSlider-rail': {
              opacity: 0.35,
            },
          }}
        />

        {/* Control buttons row */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={compact ? 0 : 0.5}
          sx={{ flexWrap: 'nowrap' }}
        >
          {/* Play/Pause */}
          <IconButton onClick={() => setPlaying((p) => !p)} size={iconSize} sx={{ color: '#fff' }}>
            {playing ? <Pause fontSize={iconSize} /> : <PlayArrow fontSize={iconSize} />}
          </IconButton>

          {/* Skip back/forward — hide on compact */}
          {!compact && (
            <>
              <Tooltip title="Rewind 10s">
                <IconButton onClick={() => handleSkip(-10)} size="small" sx={{ color: '#fff' }}>
                  <Replay10 fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Forward 10s">
                <IconButton onClick={() => handleSkip(10)} size="small" sx={{ color: '#fff' }}>
                  <Forward10 fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}

          {/* Time display */}
          <Typography variant="caption" sx={{ color: '#fff', mx: 1, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          {/* Volume */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              '&:hover .volume-slider': { width: compact ? 60 : 80, opacity: 1, mx: 0.5 },
            }}
          >
            <IconButton onClick={() => setMuted((m) => !m)} size={iconSize} sx={{ color: '#fff' }}>
              {muted || volume === 0 ? (
                <VolumeOff fontSize={iconSize} />
              ) : volume < 0.5 ? (
                <VolumeDown fontSize={iconSize} />
              ) : (
                <VolumeUp fontSize={iconSize} />
              )}
            </IconButton>
            <Slider
              className="volume-slider"
              size="small"
              value={muted ? 0 : volume * 100}
              onChange={(_, v) => {
                setVolume((v as number) / 100);
                if (muted) setMuted(false);
              }}
              sx={{
                width: 0,
                opacity: 0,
                transition: 'width 0.2s, opacity 0.2s',
                color: '#fff',
                '& .MuiSlider-thumb': { width: 12, height: 12 },
              }}
            />
          </Box>

          {/* PiP — hide on compact */}
          {!compact && (
            <Tooltip title="Picture in Picture">
              <IconButton onClick={togglePiP} size="small" sx={{ color: '#fff' }}>
                <PictureInPictureAlt fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {/* Fullscreen */}
          <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            <IconButton onClick={toggleFullscreen} size={iconSize} sx={{ color: '#fff' }}>
              {isFullscreen ? <FullscreenExit fontSize={iconSize} /> : <Fullscreen fontSize={iconSize} />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );
}
