'use client';

import React, { useState } from 'react';
import {
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
  Slider,
} from '@mui/material';
import {
  BlurOn,
  Gradient,
  ArrowForward,
  ArrowBack,
  ArrowUpward,
  ArrowDownward,
  Brightness4,
  Brightness7,
  Close,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addTransition, updateTransition, deleteTransition } from '@/store/editorSlice';
import type { TransitionType, Transition as TransitionT } from '@/store/editorSlice';

const TRANSITION_OPTIONS: { type: TransitionType; label: string; icon: React.ReactNode }[] = [
  { type: 'crossfade', label: 'Crossfade', icon: <BlurOn fontSize="small" /> },
  { type: 'dissolve', label: 'Dissolve', icon: <Gradient fontSize="small" /> },
  { type: 'wipe-left', label: 'Wipe Left', icon: <ArrowBack fontSize="small" /> },
  { type: 'wipe-right', label: 'Wipe Right', icon: <ArrowForward fontSize="small" /> },
  { type: 'wipe-up', label: 'Wipe Up', icon: <ArrowUpward fontSize="small" /> },
  { type: 'wipe-down', label: 'Wipe Down', icon: <ArrowDownward fontSize="small" /> },
  { type: 'fade-black', label: 'Fade to Black', icon: <Brightness4 fontSize="small" /> },
  { type: 'fade-white', label: 'Fade to White', icon: <Brightness7 fontSize="small" /> },
];

interface TransitionIndicatorProps {
  trackId: string;
  clipAId: string;
  clipBId: string;
  /** Position in pixels from left edge of track content */
  positionPx: number;
}

export default function TransitionIndicator({ trackId, clipAId, clipBId, positionPx }: TransitionIndicatorProps) {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const transitions = useAppSelector((s) => s.editor.transitions);
  const zoom = useAppSelector((s) => s.editor.zoom);

  const existing = transitions.find(
    (t) => t.trackId === trackId && t.clipAId === clipAId && t.clipBId === clipBId,
  );

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleSelectType = (type: TransitionType) => {
    if (existing) {
      dispatch(updateTransition({ id: existing.id, updates: { type } }));
    } else {
      dispatch(addTransition({ type, duration: 0.5, trackId, clipAId, clipBId }));
    }
    setAnchorEl(null);
  };

  const handleDelete = () => {
    if (existing) dispatch(deleteTransition(existing.id));
    setAnchorEl(null);
  };

  const handleDurationChange = (_: Event, value: number | number[]) => {
    if (existing) {
      dispatch(updateTransition({ id: existing.id, updates: { duration: value as number } }));
    }
  };

  const widthPx = existing ? existing.duration * zoom : 24;

  return (
    <>
      <Tooltip title={existing ? `${existing.type} (${existing.duration}s)` : 'Add transition'}>
        <Box
          onClick={handleClick}
          sx={{
            position: 'absolute',
            left: positionPx - widthPx / 2,
            top: 2,
            bottom: 2,
            width: widthPx,
            minWidth: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
            borderRadius: '4px',
            bgcolor: existing
              ? alpha(theme.palette.info.main, 0.35)
              : alpha(theme.palette.action.hover, 0.3),
            border: `1px dashed ${existing ? theme.palette.info.main : theme.palette.divider}`,
            '&:hover': {
              bgcolor: existing
                ? alpha(theme.palette.info.main, 0.5)
                : alpha(theme.palette.primary.main, 0.2),
              border: `1px solid ${existing ? theme.palette.info.main : theme.palette.primary.main}`,
            },
            transition: 'all 0.15s ease',
          }}
        >
          {existing ? (
            <Typography sx={{ fontSize: 8, fontWeight: 700, color: 'info.main', textTransform: 'uppercase' }}>
              {existing.type.replace('-', '\n')}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.secondary', lineHeight: 1 }}>
              +
            </Typography>
          )}
        </Box>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { minWidth: 200 } } }}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, fontWeight: 700, display: 'block' }}>
          Transition Type
        </Typography>
        {TRANSITION_OPTIONS.map((opt) => (
          <MenuItem
            key={opt.type}
            selected={existing?.type === opt.type}
            onClick={() => handleSelectType(opt.type)}
            dense
          >
            <ListItemIcon>{opt.icon}</ListItemIcon>
            <ListItemText primary={opt.label} />
          </MenuItem>
        ))}
        {existing && (
          <>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Duration: {existing.duration.toFixed(1)}s
              </Typography>
              <Slider
                value={existing.duration}
                min={0.1}
                max={3}
                step={0.1}
                size="small"
                onChange={handleDurationChange}
              />
            </Box>
            <MenuItem onClick={handleDelete} dense>
              <ListItemIcon>
                <Close fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText primary="Remove Transition" sx={{ color: 'error.main' }} />
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
}
