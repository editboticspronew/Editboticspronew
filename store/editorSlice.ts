'use client';

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Clip {
  id: string;
  fileId: string;
  fileName: string;
  fileUrl?: string;
  fileType?: string;
  storagePath?: string;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  filters?: ClipFilters;
  // Canvas transform (for image clips – move & resize on canvas)
  canvasX?: number;        // x position as percentage of canvas (0-100)
  canvasY?: number;        // y position as percentage of canvas (0-100)
  canvasWidth?: number;    // width as percentage of canvas (0-100)
  canvasHeight?: number;   // height as percentage of canvas (0-100)
  canvasRotation?: number; // degrees
}

export interface ClipFilters {
  brightness: number;   // -100 to 100 (0 = normal)
  contrast: number;     // -100 to 100
  saturation: number;   // -100 to 100
  blur: number;         // 0 to 20
  hueRotate: number;    // 0 to 360
  opacity: number;      // 0 to 1
  grayscale: number;    // 0 to 1
  sepia: number;        // 0 to 1
}

export type TransitionType = 'crossfade' | 'dissolve' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down' | 'fade-black' | 'fade-white';

export interface Transition {
  id: string;
  type: TransitionType;
  duration: number;    // seconds (default 0.5)
  trackId: string;
  clipAId: string;     // the clip before transition
  clipBId: string;     // the clip after transition
}

export interface Track {
  id: string;
  type: 'video' | 'audio' | 'text' | 'image';
  name: string;
  locked: boolean;
  visible: boolean;
  muted?: boolean;
  clips: Clip[];
}

export interface Keyframe {
  id: string;
  /** Time offset relative to the overlay's startTime (0 = start, duration = end) */
  time: number;
  x?: number;       // percentage 0-100
  y?: number;       // percentage 0-100
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  rotation?: number;
  fontSize?: number;
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number;       // percentage 0-100
  y: number;       // percentage 0-100
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  backgroundColor: string;
  opacity: number;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  startTime: number;
  duration: number;
  width?: number;   // percentage of canvas width
  keyframes?: Keyframe[];
}

export interface EditorState {
  tracks: Track[];
  textOverlays: TextOverlay[];
  transitions: Transition[];
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  zoom: number;          // pixels per second
  selectedClipId: string | null;
  selectedTrackId: string | null;
  selectedTextId: string | null;
  snapEnabled: boolean;
  // Undo / Redo
  past: EditorSnapshot[];
  future: EditorSnapshot[];
}

interface EditorSnapshot {
  tracks: Track[];
  textOverlays: TextOverlay[];
  transitions: Transition[];
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_TEXT_OVERLAY: Omit<TextOverlay, 'id' | 'text' | 'startTime' | 'duration'> = {
  x: 50,
  y: 50,
  fontSize: 32,
  color: '#FFFFFF',
  fontFamily: 'Arial',
  fontWeight: 700,
  fontStyle: 'normal',
  textAlign: 'center',
  backgroundColor: 'transparent',
  opacity: 1,
  strokeColor: '#000000',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0.8)',
  shadowBlur: 4,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
};

const DEFAULT_TRACKS: Track[] = [
  { id: 'track-video-1', type: 'video', name: 'Video 1', locked: false, visible: true, clips: [] },
  { id: 'track-image-1', type: 'image', name: 'Image 1', locked: false, visible: true, clips: [] },
  { id: 'track-audio-1', type: 'audio', name: 'Audio 1', locked: false, visible: true, muted: false, clips: [] },
  { id: 'track-text-1',  type: 'text',  name: 'Text 1',  locked: false, visible: true, clips: [] },
];

const initialState: EditorState = {
  tracks: DEFAULT_TRACKS,
  textOverlays: [],
  transitions: [],
  currentTime: 0,
  isPlaying: false,
  duration: 5,
  zoom: 50,
  selectedClipId: null,
  selectedTrackId: null,
  selectedTextId: null,
  snapEnabled: true,
  past: [],
  future: [],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

function takeSnapshot(state: EditorState): EditorSnapshot {
  return {
    tracks: JSON.parse(JSON.stringify(state.tracks)),
    textOverlays: JSON.parse(JSON.stringify(state.textOverlays)),
    transitions: JSON.parse(JSON.stringify(state.transitions)),
  };
}

function pushHistory(state: EditorState) {
  const snapshot = takeSnapshot(state);
  state.past.push(snapshot);
  if (state.past.length > MAX_HISTORY) state.past.shift();
  state.future = [];
}

function recalcDuration(state: EditorState) {
  let max = 0;
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      const end = clip.startTime + clip.duration;
      if (end > max) max = end;
    }
  }
  for (const overlay of state.textOverlays) {
    const end = overlay.startTime + overlay.duration;
    if (end > max) max = end;
  }
  state.duration = Math.max(5, max);
}

// ── Slice ────────────────────────────────────────────────────────────────────

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    // ─── Playback ────────────────────────────────────────────────────
    setPlaying(state, action: PayloadAction<boolean>) {
      state.isPlaying = action.payload;
    },
    togglePlaying(state) {
      state.isPlaying = !state.isPlaying;
    },
    setCurrentTime(state, action: PayloadAction<number>) {
      state.currentTime = Math.max(0, action.payload);
    },
    stop(state) {
      state.isPlaying = false;
      state.currentTime = 0;
    },

    // ─── Zoom ────────────────────────────────────────────────────────
    setZoom(state, action: PayloadAction<number>) {
      state.zoom = Math.max(10, Math.min(300, action.payload));
    },

    // ─── Selection ───────────────────────────────────────────────────
    selectClip(state, action: PayloadAction<{ trackId: string; clipId: string } | null>) {
      if (action.payload) {
        state.selectedClipId = action.payload.clipId;
        state.selectedTrackId = action.payload.trackId;
        state.selectedTextId = null;
      } else {
        state.selectedClipId = null;
        state.selectedTrackId = null;
      }
    },
    selectText(state, action: PayloadAction<string | null>) {
      state.selectedTextId = action.payload;
      if (action.payload) {
        state.selectedClipId = null;
        state.selectedTrackId = null;
      }
    },
    clearSelection(state) {
      state.selectedClipId = null;
      state.selectedTrackId = null;
      state.selectedTextId = null;
    },

    // ─── Snap ────────────────────────────────────────────────────────
    toggleSnap(state) {
      state.snapEnabled = !state.snapEnabled;
    },

    // ─── Tracks ──────────────────────────────────────────────────────
    addTrack(state, action: PayloadAction<{ type: Track['type']; name?: string }>) {
      pushHistory(state);
      const { type, name } = action.payload;
      const count = state.tracks.filter(t => t.type === type).length + 1;
      const track: Track = {
        id: `track-${type}-${Date.now()}`,
        type,
        name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`,
        locked: false,
        visible: true,
        muted: type === 'audio' ? false : undefined,
        clips: [],
      };
      state.tracks.push(track);
    },
    deleteTrack(state, action: PayloadAction<string>) {
      pushHistory(state);
      state.tracks = state.tracks.filter(t => t.id !== action.payload);
      // Remove text overlays for deleted text track clips
      const deletedIds = new Set<string>();
      state.tracks.forEach(t => t.clips.forEach(c => deletedIds.add(c.id)));
      state.textOverlays = state.textOverlays.filter(o => deletedIds.has(o.id) || !o.id.startsWith('text-'));
      recalcDuration(state);
    },
    toggleTrackLock(state, action: PayloadAction<string>) {
      const track = state.tracks.find(t => t.id === action.payload);
      if (track) track.locked = !track.locked;
    },
    toggleTrackVisibility(state, action: PayloadAction<string>) {
      const track = state.tracks.find(t => t.id === action.payload);
      if (track) track.visible = !track.visible;
    },
    toggleTrackMute(state, action: PayloadAction<string>) {
      const track = state.tracks.find(t => t.id === action.payload);
      if (track && track.type === 'audio') track.muted = !track.muted;
    },
    reorderTracks(state, action: PayloadAction<string[]>) {
      pushHistory(state);
      const ordered: Track[] = [];
      for (const id of action.payload) {
        const t = state.tracks.find(tr => tr.id === id);
        if (t) ordered.push(t);
      }
      state.tracks = ordered;
    },

    // ─── Clips ───────────────────────────────────────────────────────
    addClip(state, action: PayloadAction<{ trackId: string; clip: Clip }>) {
      pushHistory(state);
      const track = state.tracks.find(t => t.id === action.payload.trackId);
      if (track) {
        track.clips.push(action.payload.clip);
        track.clips.sort((a, b) => a.startTime - b.startTime);
      }
      recalcDuration(state);
    },
    updateClip(state, action: PayloadAction<{ trackId: string; clipId: string; updates: Partial<Clip> }>) {
      const { trackId, clipId, updates } = action.payload;
      const track = state.tracks.find(t => t.id === trackId);
      if (track) {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip) Object.assign(clip, updates);
        track.clips.sort((a, b) => a.startTime - b.startTime);
      }
      recalcDuration(state);
    },
    /** Commit clip position after drag — saves to undo history */
    commitClipUpdate(state, action: PayloadAction<{ trackId: string; clipId: string; updates: Partial<Clip> }>) {
      pushHistory(state);
      const { trackId, clipId, updates } = action.payload;
      const track = state.tracks.find(t => t.id === trackId);
      if (track) {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip) Object.assign(clip, updates);
        track.clips.sort((a, b) => a.startTime - b.startTime);
      }
      recalcDuration(state);
    },
    deleteClip(state, action: PayloadAction<{ trackId: string; clipId: string }>) {
      pushHistory(state);
      const { trackId, clipId } = action.payload;
      const track = state.tracks.find(t => t.id === trackId);
      if (track) {
        track.clips = track.clips.filter(c => c.id !== clipId);
      }
      // Also remove text overlay if it was a text clip
      state.textOverlays = state.textOverlays.filter(o => o.id !== clipId);
      if (state.selectedClipId === clipId) {
        state.selectedClipId = null;
        state.selectedTrackId = null;
      }
      recalcDuration(state);
    },
    splitClip(state, action: PayloadAction<{ trackId: string; clipId: string; splitTime: number }>) {
      pushHistory(state);
      const { trackId, clipId, splitTime } = action.payload;
      const track = state.tracks.find(t => t.id === trackId);
      if (!track) return;
      const clip = track.clips.find(c => c.id === clipId);
      if (!clip) return;

      const relSplit = splitTime - clip.startTime;
      if (relSplit <= 0.1 || relSplit >= clip.duration - 0.1) return;

      const rightClip: Clip = {
        ...clip,
        id: `clip-${Date.now()}-split`,
        startTime: splitTime,
        duration: clip.duration - relSplit,
        trimStart: clip.trimStart + relSplit,
      };
      clip.duration = relSplit;

      track.clips.push(rightClip);
      track.clips.sort((a, b) => a.startTime - b.startTime);
      recalcDuration(state);
    },

    // ─── Text Overlays ───────────────────────────────────────────────
    addTextOverlay(state, action: PayloadAction<{ text: string; startTime: number; duration?: number; trackId?: string }>) {
      pushHistory(state);
      const { text, startTime, duration = 5, trackId } = action.payload;
      const id = `text-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      const overlay: TextOverlay = {
        ...DEFAULT_TEXT_OVERLAY,
        id,
        text,
        startTime,
        duration,
      };
      state.textOverlays.push(overlay);

      // Add clip to a text track
      const textClip: Clip = {
        id,
        fileId: 'text',
        fileName: text.length > 25 ? text.substring(0, 25) + '…' : text,
        startTime,
        duration,
        trimStart: 0,
        trimEnd: 0,
      };

      let targetTrack: Track | undefined;
      if (trackId) {
        targetTrack = state.tracks.find(t => t.id === trackId);
      }
      if (!targetTrack) {
        // Find a text track where this time range doesn't overlap
        targetTrack = state.tracks.find(t => {
          if (t.type !== 'text') return false;
          return !t.clips.some(c =>
            startTime < c.startTime + c.duration && startTime + duration > c.startTime
          );
        });
      }
      if (!targetTrack) {
        // Create new text track
        const count = state.tracks.filter(t => t.type === 'text').length + 1;
        targetTrack = {
          id: `track-text-${Date.now()}`,
          type: 'text',
          name: `Text ${count}`,
          locked: false,
          visible: true,
          clips: [],
        };
        state.tracks.push(targetTrack);
      }

      targetTrack.clips.push(textClip);
      targetTrack.clips.sort((a, b) => a.startTime - b.startTime);
      state.selectedTextId = id;
      recalcDuration(state);
    },
    updateTextOverlay(state, action: PayloadAction<{ id: string; updates: Partial<TextOverlay> }>) {
      const overlay = state.textOverlays.find(o => o.id === action.payload.id);
      if (overlay) Object.assign(overlay, action.payload.updates);
    },
    commitTextOverlay(state, action: PayloadAction<{ id: string; updates: Partial<TextOverlay> }>) {
      pushHistory(state);
      const overlay = state.textOverlays.find(o => o.id === action.payload.id);
      if (overlay) Object.assign(overlay, action.payload.updates);
      // Also sync text clip timing if startTime/duration changed
      const { updates } = action.payload;
      if (updates.startTime !== undefined || updates.duration !== undefined) {
        for (const track of state.tracks) {
          const clip = track.clips.find(c => c.id === action.payload.id);
          if (clip) {
            if (updates.startTime !== undefined) clip.startTime = updates.startTime;
            if (updates.duration !== undefined) clip.duration = updates.duration;
          }
        }
        recalcDuration(state);
      }
    },
    deleteTextOverlay(state, action: PayloadAction<string>) {
      pushHistory(state);
      state.textOverlays = state.textOverlays.filter(o => o.id !== action.payload);
      for (const track of state.tracks) {
        track.clips = track.clips.filter(c => c.id !== action.payload);
      }
      if (state.selectedTextId === action.payload) state.selectedTextId = null;
      recalcDuration(state);
    },

    // ─── Transitions ─────────────────────────────────────────────────
    addTransition(state, action: PayloadAction<Omit<Transition, 'id'>>) {
      pushHistory(state);
      const id = `tr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      state.transitions.push({ ...action.payload, id });
    },
    updateTransition(state, action: PayloadAction<{ id: string; updates: Partial<Transition> }>) {
      const tr = state.transitions.find(t => t.id === action.payload.id);
      if (tr) Object.assign(tr, action.payload.updates);
    },
    deleteTransition(state, action: PayloadAction<string>) {
      pushHistory(state);
      state.transitions = state.transitions.filter(t => t.id !== action.payload);
    },

    // ─── Clip Filters ────────────────────────────────────────────────
    updateClipFilters(state, action: PayloadAction<{ trackId: string; clipId: string; filters: Partial<ClipFilters> }>) {
      const track = state.tracks.find(t => t.id === action.payload.trackId);
      if (!track) return;
      const clip = track.clips.find(c => c.id === action.payload.clipId);
      if (!clip) return;
      if (!clip.filters) {
        clip.filters = { brightness: 0, contrast: 0, saturation: 0, blur: 0, hueRotate: 0, opacity: 1, grayscale: 0, sepia: 0 };
      }
      Object.assign(clip.filters, action.payload.filters);
    },
    commitClipFilters(state, action: PayloadAction<{ trackId: string; clipId: string; filters: Partial<ClipFilters> }>) {
      pushHistory(state);
      const track = state.tracks.find(t => t.id === action.payload.trackId);
      if (!track) return;
      const clip = track.clips.find(c => c.id === action.payload.clipId);
      if (!clip) return;
      if (!clip.filters) {
        clip.filters = { brightness: 0, contrast: 0, saturation: 0, blur: 0, hueRotate: 0, opacity: 1, grayscale: 0, sepia: 0 };
      }
      Object.assign(clip.filters, action.payload.filters);
    },

    // ─── Keyframes ───────────────────────────────────────────────────
    addKeyframe(state, action: PayloadAction<{ overlayId: string; keyframe: Omit<Keyframe, 'id'> }>) {
      pushHistory(state);
      const overlay = state.textOverlays.find(o => o.id === action.payload.overlayId);
      if (!overlay) return;
      if (!overlay.keyframes) overlay.keyframes = [];
      const id = `kf-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      overlay.keyframes.push({ ...action.payload.keyframe, id });
      overlay.keyframes.sort((a, b) => a.time - b.time);
    },
    updateKeyframe(state, action: PayloadAction<{ overlayId: string; keyframeId: string; updates: Partial<Keyframe> }>) {
      const overlay = state.textOverlays.find(o => o.id === action.payload.overlayId);
      if (!overlay?.keyframes) return;
      const kf = overlay.keyframes.find(k => k.id === action.payload.keyframeId);
      if (kf) {
        Object.assign(kf, action.payload.updates);
        overlay.keyframes.sort((a, b) => a.time - b.time);
      }
    },
    deleteKeyframe(state, action: PayloadAction<{ overlayId: string; keyframeId: string }>) {
      pushHistory(state);
      const overlay = state.textOverlays.find(o => o.id === action.payload.overlayId);
      if (!overlay?.keyframes) return;
      overlay.keyframes = overlay.keyframes.filter(k => k.id !== action.payload.keyframeId);
    },

    // ─── Bulk load (from sessionStorage / Firestore) ─────────────────
    loadEditorState(state, action: PayloadAction<{ tracks: Track[]; textOverlays: TextOverlay[] }>) {
      state.tracks = action.payload.tracks;
      state.textOverlays = action.payload.textOverlays;
      state.past = [];
      state.future = [];
      recalcDuration(state);
    },
    resetEditor(state) {
      Object.assign(state, { ...initialState, tracks: JSON.parse(JSON.stringify(DEFAULT_TRACKS)) });
    },

    // ─── Undo / Redo ─────────────────────────────────────────────────
    undo(state) {
      if (state.past.length === 0) return;
      const current = takeSnapshot(state);
      state.future.push(current);
      const prev = state.past.pop()!;
      state.tracks = prev.tracks;
      state.textOverlays = prev.textOverlays;
      state.transitions = prev.transitions;
      recalcDuration(state);
    },
    redo(state) {
      if (state.future.length === 0) return;
      const current = takeSnapshot(state);
      state.past.push(current);
      const next = state.future.pop()!;
      state.tracks = next.tracks;
      state.textOverlays = next.textOverlays;
      state.transitions = next.transitions;
      recalcDuration(state);
    },
  },
});

export const {
  setPlaying, togglePlaying, setCurrentTime, stop,
  setZoom,
  selectClip, selectText, clearSelection, toggleSnap,
  addTrack, deleteTrack, toggleTrackLock, toggleTrackVisibility, toggleTrackMute, reorderTracks,
  addClip, updateClip, commitClipUpdate, deleteClip, splitClip,
  addTextOverlay, updateTextOverlay, commitTextOverlay, deleteTextOverlay,
  addTransition, updateTransition, deleteTransition,
  updateClipFilters, commitClipFilters,
  addKeyframe, updateKeyframe, deleteKeyframe,
  loadEditorState, resetEditor,
  undo, redo,
} = editorSlice.actions;

export default editorSlice.reducer;
