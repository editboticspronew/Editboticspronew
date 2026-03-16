'use client';

import React from 'react';
import {
  Box,
  Typography,
  Slider,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  Divider,
  Button,
} from '@mui/material';
import { Close, RestartAlt } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { updateClipFilters, commitClipFilters, clearSelection } from '@/store/editorSlice';
import type { ClipFilters } from '@/store/editorSlice';

const DEFAULT_FILTERS: ClipFilters = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
  hueRotate: 0,
  opacity: 1,
  grayscale: 0,
  sepia: 0,
};

interface FilterControl {
  key: keyof ClipFilters;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

const FILTER_CONTROLS: FilterControl[] = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100, step: 1, default: 0 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, step: 1, default: 0 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1, default: 0 },
  { key: 'hueRotate', label: 'Hue Rotate', min: 0, max: 360, step: 1, default: 0, unit: '°' },
  { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01, default: 1 },
  { key: 'blur', label: 'Blur', min: 0, max: 20, step: 0.5, default: 0, unit: 'px' },
  { key: 'grayscale', label: 'Grayscale', min: 0, max: 1, step: 0.01, default: 0 },
  { key: 'sepia', label: 'Sepia', min: 0, max: 1, step: 0.01, default: 0 },
];

export default function ClipFiltersPanel() {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { selectedClipId, selectedTrackId, tracks } = useAppSelector((s) => s.editor);

  // Find the selected clip
  const track = tracks.find((t) => t.id === selectedTrackId);
  const clip = track?.clips.find((c) => c.id === selectedClipId);

  if (!clip || !track || track.type === 'text') return null;

  const filters = clip.filters || DEFAULT_FILTERS;

  const handleChange = (key: keyof ClipFilters, value: number) => {
    dispatch(updateClipFilters({ trackId: track.id, clipId: clip.id, filters: { [key]: value } }));
  };

  const handleCommit = (key: keyof ClipFilters, value: number) => {
    dispatch(commitClipFilters({ trackId: track.id, clipId: clip.id, filters: { [key]: value } }));
  };

  const handleReset = () => {
    dispatch(commitClipFilters({ trackId: track.id, clipId: clip.id, filters: { ...DEFAULT_FILTERS } }));
  };

  return (
    <Box
      sx={{
        width: 260,
        flexShrink: 0,
        bgcolor: alpha(theme.palette.background.paper, 0.95),
        borderLeft: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2" fontWeight={700}>
          Filters & Effects
        </Typography>
        <Tooltip title="Close">
          <IconButton size="small" onClick={() => dispatch(clearSelection())}>
            <Close fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Clip info */}
      <Box sx={{ px: 1.5, py: 1 }}>
        <Typography variant="caption" color="text.secondary" noWrap>
          {clip.fileName}
        </Typography>
      </Box>

      {/* Filter sliders */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, pb: 2 }}>
        {FILTER_CONTROLS.map((ctrl) => (
          <Box key={ctrl.key} sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.3 }}>
              <Typography variant="caption" fontWeight={600} sx={{ fontSize: 11 }}>
                {ctrl.label}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                {typeof filters[ctrl.key] === 'number' ? (
                  ctrl.step < 1 ? filters[ctrl.key].toFixed(2) : filters[ctrl.key]
                ) : ctrl.default}
                {ctrl.unit || ''}
              </Typography>
            </Box>
            <Slider
              size="small"
              value={filters[ctrl.key] ?? ctrl.default}
              min={ctrl.min}
              max={ctrl.max}
              step={ctrl.step}
              onChange={(_, v) => handleChange(ctrl.key, v as number)}
              onChangeCommitted={(_, v) => handleCommit(ctrl.key, v as number)}
            />
          </Box>
        ))}

        <Divider sx={{ my: 1 }} />

        <Button
          variant="outlined"
          size="small"
          startIcon={<RestartAlt />}
          onClick={handleReset}
          fullWidth
          sx={{ mt: 1 }}
        >
          Reset All Filters
        </Button>
      </Box>
    </Box>
  );
}
