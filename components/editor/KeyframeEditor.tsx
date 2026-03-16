'use client';

import React, { useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  Button,
  Divider,
} from '@mui/material';
import { AddCircle, Diamond, Delete } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addKeyframe, deleteKeyframe } from '@/store/editorSlice';

/**
 * KeyframeEditor — shown inside TextPropertiesPanel when an overlay is selected.
 * Displays a mini-timeline with keyframe diamonds. Users can add/remove keyframes.
 */
export default function KeyframeEditor({ overlayId }: { overlayId: string }) {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const overlay = useAppSelector((s) => s.editor.textOverlays.find((o) => o.id === overlayId));
  const currentTime = useAppSelector((s) => s.editor.currentTime);

  const keyframes = overlay?.keyframes || [];

  const handleAddKeyframe = useCallback(() => {
    if (!overlay) return;
    const relativeTime = Math.max(0, Math.min(overlay.duration, currentTime - overlay.startTime));
    dispatch(
      addKeyframe({
        overlayId,
        keyframe: {
          time: relativeTime,
          x: overlay.x,
          y: overlay.y,
          scaleX: overlay.scaleX,
          scaleY: overlay.scaleY,
          opacity: overlay.opacity,
          rotation: overlay.rotation,
          fontSize: overlay.fontSize,
        },
      })
    );
  }, [overlay, currentTime, overlayId, dispatch]);

  const handleDeleteKeyframe = useCallback(
    (kfId: string) => {
      dispatch(deleteKeyframe({ overlayId, keyframeId: kfId }));
    },
    [overlayId, dispatch]
  );

  if (!overlay) return null;

  const duration = overlay.duration;
  const barWidth = 200; // pixels for the mini-timeline

  return (
    <Box sx={{ mt: 1 }}>
      <Divider sx={{ mb: 1 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11 }}>
          Keyframes
        </Typography>
        <Tooltip title="Add keyframe at current time">
          <IconButton size="small" onClick={handleAddKeyframe} color="primary">
            <AddCircle sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Mini-timeline bar */}
      <Box
        sx={{
          position: 'relative',
          height: 28,
          bgcolor: alpha(theme.palette.common.black, 0.3),
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          width: barWidth,
          mx: 'auto',
          overflow: 'visible',
        }}
      >
        {/* Current time indicator */}
        {currentTime >= overlay.startTime && currentTime <= overlay.startTime + overlay.duration && (
          <Box
            sx={{
              position: 'absolute',
              left: ((currentTime - overlay.startTime) / duration) * barWidth,
              top: 0,
              bottom: 0,
              width: 1.5,
              bgcolor: 'error.main',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Keyframe diamonds */}
        {keyframes.map((kf) => {
          const pos = (kf.time / duration) * barWidth;
          return (
            <Tooltip key={kf.id} title={`t=${kf.time.toFixed(2)}s`}>
              <Box
                sx={{
                  position: 'absolute',
                  left: pos - 6,
                  top: '50%',
                  transform: 'translateY(-50%) rotate(45deg)',
                  width: 10,
                  height: 10,
                  bgcolor: theme.palette.warning.main,
                  border: `1px solid ${theme.palette.warning.dark}`,
                  cursor: 'pointer',
                  zIndex: 3,
                  '&:hover': {
                    bgcolor: theme.palette.warning.light,
                    transform: 'translateY(-50%) rotate(45deg) scale(1.3)',
                  },
                  transition: 'all 0.15s',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  // Right click or ctrl+click to delete
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleDeleteKeyframe(kf.id);
                }}
              />
            </Tooltip>
          );
        })}
      </Box>

      {/* Keyframe list */}
      {keyframes.length > 0 && (
        <Box sx={{ mt: 1, maxHeight: 120, overflow: 'auto' }}>
          {keyframes.map((kf, idx) => (
            <Box
              key={kf.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 0.3,
                px: 0.5,
                borderRadius: 0.5,
                '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.3) },
              }}
            >
              <Typography variant="caption" sx={{ fontSize: 10, fontFamily: 'monospace' }}>
                KF{idx + 1} @ {kf.time.toFixed(2)}s
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {kf.opacity !== undefined && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
                    α:{kf.opacity.toFixed(1)}
                  </Typography>
                )}
                {kf.rotation !== undefined && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
                    R:{Math.round(kf.rotation)}°
                  </Typography>
                )}
                <IconButton
                  size="small"
                  onClick={() => handleDeleteKeyframe(kf.id)}
                  sx={{ p: 0.2 }}
                >
                  <Delete sx={{ fontSize: 12 }} color="error" />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {keyframes.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, display: 'block', textAlign: 'center', mt: 0.5 }}>
          No keyframes. Click + to add at playhead.
        </Typography>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, display: 'block', textAlign: 'center', mt: 0.5 }}>
        Right-click diamond to delete
      </Typography>
    </Box>
  );
}
