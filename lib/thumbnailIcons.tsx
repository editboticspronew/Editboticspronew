'use client';

import React from 'react';
import {
  Videocam,
  Movie,
  CameraRoll,
  TheaterComedy,
  MusicNote,
  Mic,
  MenuBook,
  AutoAwesome,
  LocalFireDepartment,
  Diamond,
  Rocket,
  Landscape,
  NightlightRound,
  Palette,
  SportsEsports,
  Headphones,
  PhotoCamera,
  Campaign,
  Podcasts,
  SlowMotionVideo,
} from '@mui/icons-material';
import { Box, SxProps, Theme } from '@mui/material';

// Map of icon name strings to MUI icon components
// These string keys are what gets saved to Firestore
const ICON_MAP: Record<string, React.ReactElement> = {
  Videocam: <Videocam />,
  Movie: <Movie />,
  CameraRoll: <CameraRoll />,
  TheaterComedy: <TheaterComedy />,
  MusicNote: <MusicNote />,
  Mic: <Mic />,
  MenuBook: <MenuBook />,
  AutoAwesome: <AutoAwesome />,
  LocalFireDepartment: <LocalFireDepartment />,
  Diamond: <Diamond />,
  Rocket: <Rocket />,
  Landscape: <Landscape />,
  NightlightRound: <NightlightRound />,
  Palette: <Palette />,
  SportsEsports: <SportsEsports />,
  Headphones: <Headphones />,
  PhotoCamera: <PhotoCamera />,
  Campaign: <Campaign />,
  Podcasts: <Podcasts />,
  SlowMotionVideo: <SlowMotionVideo />,
};

// Thumbnail options with colors for the selector UI
export const THUMBNAIL_OPTIONS = [
  { id: 'Videocam', label: 'Camera', color: '#14b8a6' },
  { id: 'Movie', label: 'Movie', color: '#6366f1' },
  { id: 'CameraRoll', label: 'Film', color: '#8b5cf6' },
  { id: 'TheaterComedy', label: 'Drama', color: '#ec4899' },
  { id: 'MusicNote', label: 'Music', color: '#f59e0b' },
  { id: 'Mic', label: 'Mic', color: '#ef4444' },
  { id: 'MenuBook', label: 'Book', color: '#3b82f6' },
  { id: 'AutoAwesome', label: 'Magic', color: '#a855f7' },
  { id: 'LocalFireDepartment', label: 'Fire', color: '#f97316' },
  { id: 'Diamond', label: 'Diamond', color: '#06b6d4' },
  { id: 'Rocket', label: 'Rocket', color: '#10b981' },
  { id: 'Landscape', label: 'Nature', color: '#22c55e' },
  { id: 'NightlightRound', label: 'Night', color: '#6366f1' },
  { id: 'Palette', label: 'Art', color: '#f43f5e' },
  { id: 'SportsEsports', label: 'Gaming', color: '#8b5cf6' },
  { id: 'Headphones', label: 'Audio', color: '#0ea5e9' },
  { id: 'PhotoCamera', label: 'Photo', color: '#14b8a6' },
  { id: 'Campaign', label: 'Promo', color: '#f97316' },
  { id: 'Podcasts', label: 'Podcast', color: '#ec4899' },
  { id: 'SlowMotionVideo', label: 'Slow-Mo', color: '#6366f1' },
];

/** Default thumbnail icon name */
export const DEFAULT_THUMBNAIL = 'Videocam';

/**
 * Render a thumbnail icon from a stored string name.
 * Falls back to Videocam if the name isn't recognized.
 */
export function ThumbnailIcon({
  name,
  size = 24,
  color = 'white',
  sx,
}: {
  name: string;
  size?: number;
  color?: string;
  sx?: SxProps<Theme>;
}) {
  const icon = ICON_MAP[name] || ICON_MAP['Videocam'];
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        ...sx,
      }}
    >
      {React.cloneElement(icon, { sx: { fontSize: size } })}
    </Box>
  );
}

/**
 * Get the color associated with a thumbnail icon name.
 */
export function getThumbnailColor(name: string): string {
  const option = THUMBNAIL_OPTIONS.find((o) => o.id === name);
  return option?.color || '#14b8a6';
}
