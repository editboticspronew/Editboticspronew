'use client';

import React, { useEffect, useRef } from 'react';
import {
  Box,
  IconButton,
  Paper,
  TextField,
  Typography,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useTheme,
  alpha,
  Button,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Close,
  Delete,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  FormatBold,
  FormatItalic,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { updateTextOverlay, commitTextOverlay, deleteTextOverlay, clearSelection } from '@/store/editorSlice';
import KeyframeEditor from './KeyframeEditor';

const FONTS = [
  'Arial',
  'Inter',
  'Lato',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
  'Impact',
];

export default function TextPropertiesPanel() {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const panelRef = useRef<HTMLDivElement>(null);

  const { selectedTextId, textOverlays } = useAppSelector((s) => s.editor);
  const overlay = textOverlays.find((o) => o.id === selectedTextId);

  // Click-outside to close (with a small delay so the stage click registers first)
  useEffect(() => {
    if (!selectedTextId) return;

    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Don't deselect if clicking on the canvas (Konva handles that)
        const target = e.target as HTMLElement;
        if (target.tagName === 'CANVAS') return;
        dispatch(clearSelection());
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedTextId, dispatch]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(clearSelection());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch]);

  if (!overlay) return null;

  const update = (updates: Record<string, any>) => {
    dispatch(updateTextOverlay({ id: overlay.id, updates }));
  };

  const commit = (updates: Record<string, any>) => {
    dispatch(commitTextOverlay({ id: overlay.id, updates }));
  };

  return (
    <Paper
      ref={panelRef}
      elevation={4}
      sx={{
        width: 280,
        bgcolor: 'background.paper',
        borderLeft: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
          Text Properties
        </Typography>
        <IconButton size="small" onClick={() => dispatch(clearSelection())}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Text content */}
        <TextField
          label="Text"
          size="small"
          fullWidth
          multiline
          maxRows={4}
          value={overlay.text}
          onChange={(e) => update({ text: e.target.value })}
          onBlur={(e) => commit({ text: (e.target as HTMLInputElement).value })}
        />

        {/* Font family */}
        <FormControl size="small" fullWidth>
          <InputLabel>Font</InputLabel>
          <Select
            value={overlay.fontFamily}
            label="Font"
            onChange={(e) => commit({ fontFamily: e.target.value })}
          >
            {FONTS.map((f) => (
              <MenuItem key={f} value={f} sx={{ fontFamily: f }}>
                {f}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Font size */}
        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Font Size: {overlay.fontSize}px
          </Typography>
          <Slider
            value={overlay.fontSize}
            min={12}
            max={120}
            step={1}
            onChange={(_, v) => update({ fontSize: v as number })}
            onChangeCommitted={(_, v) => commit({ fontSize: v as number })}
            size="small"
          />
        </Box>

        {/* Bold / Italic / Alignment */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Bold">
            <IconButton
              size="small"
              onClick={() => commit({ fontWeight: overlay.fontWeight >= 700 ? 400 : 700 })}
              sx={{
                bgcolor: overlay.fontWeight >= 700 ? alpha(theme.palette.primary.main, 0.2) : 'transparent',
              }}
            >
              <FormatBold fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Italic">
            <IconButton
              size="small"
              onClick={() => commit({ fontStyle: overlay.fontStyle === 'italic' ? 'normal' : 'italic' })}
              sx={{
                bgcolor: overlay.fontStyle === 'italic' ? alpha(theme.palette.primary.main, 0.2) : 'transparent',
              }}
            >
              <FormatItalic fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Align Left">
            <IconButton
              size="small"
              onClick={() => commit({ textAlign: 'left' })}
              sx={{
                bgcolor: overlay.textAlign === 'left' ? alpha(theme.palette.primary.main, 0.2) : 'transparent',
              }}
            >
              <FormatAlignLeft fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Align Center">
            <IconButton
              size="small"
              onClick={() => commit({ textAlign: 'center' })}
              sx={{
                bgcolor: overlay.textAlign === 'center' ? alpha(theme.palette.primary.main, 0.2) : 'transparent',
              }}
            >
              <FormatAlignCenter fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Align Right">
            <IconButton
              size="small"
              onClick={() => commit({ textAlign: 'right' })}
              sx={{
                bgcolor: overlay.textAlign === 'right' ? alpha(theme.palette.primary.main, 0.2) : 'transparent',
              }}
            >
              <FormatAlignRight fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Colors */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Fill Color
            </Typography>
            <input
              type="color"
              value={overlay.color}
              onChange={(e) => update({ color: e.target.value })}
              onBlur={(e) => commit({ color: e.target.value })}
              style={{
                width: '100%',
                height: 32,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                background: 'transparent',
              }}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Background
            </Typography>
            <input
              type="color"
              value={overlay.backgroundColor === 'transparent' ? '#000000' : overlay.backgroundColor}
              onChange={(e) => update({ backgroundColor: e.target.value })}
              onBlur={(e) => commit({ backgroundColor: e.target.value })}
              style={{
                width: '100%',
                height: 32,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                background: 'transparent',
              }}
            />
          </Box>
        </Box>

        <Divider />

        {/* Opacity */}
        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Opacity: {Math.round(overlay.opacity * 100)}%
          </Typography>
          <Slider
            value={overlay.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(_, v) => update({ opacity: v as number })}
            onChangeCommitted={(_, v) => commit({ opacity: v as number })}
            size="small"
          />
        </Box>

        {/* Stroke */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Stroke
            </Typography>
            <input
              type="color"
              value={overlay.strokeColor}
              onChange={(e) => update({ strokeColor: e.target.value })}
              onBlur={(e) => commit({ strokeColor: e.target.value })}
              style={{
                width: '100%',
                height: 32,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                background: 'transparent',
              }}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Width: {overlay.strokeWidth}
            </Typography>
            <Slider
              value={overlay.strokeWidth}
              min={0}
              max={10}
              step={0.5}
              onChange={(_, v) => update({ strokeWidth: v as number })}
              onChangeCommitted={(_, v) => commit({ strokeWidth: v as number })}
              size="small"
            />
          </Box>
        </Box>

        {/* Shadow */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Shadow
            </Typography>
            <input
              type="color"
              value={overlay.shadowColor.startsWith('rgba') ? '#000000' : overlay.shadowColor}
              onChange={(e) => update({ shadowColor: e.target.value })}
              onBlur={(e) => commit({ shadowColor: e.target.value })}
              style={{
                width: '100%',
                height: 32,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                background: 'transparent',
              }}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Blur: {overlay.shadowBlur}
            </Typography>
            <Slider
              value={overlay.shadowBlur}
              min={0}
              max={30}
              step={1}
              onChange={(_, v) => update({ shadowBlur: v as number })}
              onChangeCommitted={(_, v) => commit({ shadowBlur: v as number })}
              size="small"
            />
          </Box>
        </Box>

        <Divider />

        {/* Timing */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            size="small"
            type="number"
            label="Start (s)"
            value={overlay.startTime.toFixed(1)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 0) commit({ startTime: v });
            }}
            inputProps={{ min: 0, step: 0.1 }}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            type="number"
            label="Duration (s)"
            value={overlay.duration.toFixed(1)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) commit({ duration: v });
            }}
            inputProps={{ min: 0.1, step: 0.1 }}
            sx={{ flex: 1 }}
          />
        </Box>

        {/* Delete */}
        <Button
          variant="outlined"
          color="error"
          startIcon={<Delete />}
          onClick={() => dispatch(deleteTextOverlay(overlay.id))}
          fullWidth
          size="small"
        >
          Delete Text
        </Button>

        {/* Keyframe Editor */}
        <KeyframeEditor overlayId={overlay.id} />
      </Box>
    </Paper>
  );
}
