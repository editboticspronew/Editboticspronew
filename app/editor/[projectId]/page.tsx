'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Button,
  Paper,
  useTheme,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Container,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProjectFiles } from '@/store/filesSlice';
import { fetchUserProjects } from '@/store/projectsSlice';
import { useAuth } from '@/hooks/useAuth';
import { VideoExport } from '@/components/editor/VideoExport';
import TextPropertiesPanel from '@/components/editor/TextPropertiesPanel';
import ClipFiltersPanel from '@/components/editor/ClipFiltersPanel';
import Timeline from '@/components/editor/Timeline';
import {
  addClip,
  addTextOverlay,
  loadEditorState,
  undo,
  redo,
  togglePlaying,
  type Clip,
  type Track,
} from '@/store/editorSlice';

// Konva needs window — dynamic import with SSR disabled
const EditorCanvas = dynamic(() => import('@/components/editor/EditorCanvas'), {
  ssr: false,
  loading: () => (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000' }}>
      <Typography color="text.secondary">Loading canvas…</Typography>
    </Box>
  ),
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VideoEditorPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const router = useRouter();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { files } = useAppSelector((state) => state.files);
  const { projects } = useAppSelector((state) => state.projects);
  const editorState = useAppSelector((state) => state.editor);

  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [textInput, setTextInput] = useState('');

  const project = projects.find((p) => p.id === projectId);
  const projectFiles = files.filter((f) => f.projectId === projectId);

  // ─── Fetch project data ───────────────────────────────────────────
  useEffect(() => {
    if (user?.uid) dispatch(fetchUserProjects(user.uid));
  }, [user?.uid, dispatch]);

  useEffect(() => {
    if (projectId) dispatch(fetchProjectFiles(projectId));
  }, [projectId, dispatch]);

  // ─── Load clips from sessionStorage (from Generate Clips dialog) ──
  useEffect(() => {
    const raw = sessionStorage.getItem(`editor_clips_${projectId}`);
    if (!raw) return;
    sessionStorage.removeItem(`editor_clips_${projectId}`);

    try {
      const { sourceFile, clips: clipDefs, transcriptionSegments } = JSON.parse(raw);

      const tracks: Track[] = [
        { id: 'track-video-1', type: 'video', name: 'Video 1', locked: false, visible: true, clips: [] },
        { id: 'track-image-1', type: 'image', name: 'Image 1', locked: false, visible: true, clips: [] },
        { id: 'track-audio-1', type: 'audio', name: 'Audio 1', locked: false, visible: true, muted: false, clips: [] },
        { id: 'track-text-1', type: 'text', name: 'Text 1', locked: false, visible: true, clips: [] },
      ];

      let pos = 0;
      const videoClips: Clip[] = clipDefs.map((cd: any, i: number) => {
        const clip: Clip = {
          id: `clip-${Date.now()}-${i}`,
          fileId: sourceFile.id,
          fileName: `${sourceFile.name} (Clip ${cd.index})`,
          fileUrl: sourceFile.url,
          fileType: 'video',
          storagePath: sourceFile.storagePath,
          startTime: pos,
          duration: cd.duration,
          trimStart: cd.start,
          trimEnd: 0,
        };
        pos += cd.duration;
        return clip;
      });
      tracks[0].clips = videoClips;

      // Build text overlays for transcript segments
      const textOverlays: any[] = [];
      if (transcriptionSegments?.length) {
        let textPos = 0;
        clipDefs.forEach((cd: any) => {
          const segs = transcriptionSegments.filter(
            (s: any) => s.end > cd.start && s.start < cd.end
          );
          segs.forEach((seg: any) => {
            const relStart = Math.max(0, seg.start - cd.start) + textPos;
            const relEnd = Math.min(cd.duration, seg.end - cd.start) + textPos;
            const dur = relEnd - relStart;
            if (dur > 0.1) {
              const id = `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const trimmed = seg.text.trim();
              textOverlays.push({
                id,
                text: trimmed,
                x: 50,
                y: 85,
                fontSize: 24,
                color: '#FFFFFF',
                fontFamily: 'Arial',
                fontWeight: 700,
                fontStyle: 'normal' as const,
                textAlign: 'center' as const,
                backgroundColor: 'transparent',
                opacity: 1,
                strokeColor: '#000000',
                strokeWidth: 0,
                shadowColor: 'rgba(0,0,0,0.8)',
                shadowBlur: 4,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                startTime: relStart,
                duration: dur,
              });
              tracks[3].clips.push({
                id,
                fileId: 'text',
                fileName: trimmed.length > 25 ? trimmed.substring(0, 25) + '…' : trimmed,
                startTime: relStart,
                duration: dur,
                trimStart: 0,
                trimEnd: 0,
              });
            }
          });
          textPos += cd.duration;
        });
      }

      dispatch(loadEditorState({ tracks, textOverlays }));
      console.log(`✅ Loaded ${videoClips.length} clip(s) and ${textOverlays.length} text overlay(s)`);
    } catch (err) {
      console.error('Failed to load editor clips from sessionStorage:', err);
    }
  }, [projectId, dispatch]);

  // ─── Keyboard shortcuts (global) ─────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === ' ') {
        e.preventDefault();
        dispatch(togglePlaying());
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch(undo());
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        dispatch(redo());
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        dispatch(redo());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch]);

  // ─── Add text handler ─────────────────────────────────────────────
  const handleAddText = useCallback(() => {
    if (!textInput.trim()) return;
    dispatch(
      addTextOverlay({
        text: textInput.trim(),
        startTime: editorState.currentTime,
        duration: 5,
      })
    );
    setTextInput('');
    setTextDialogOpen(false);
  }, [textInput, editorState.currentTime, dispatch]);

  // ─── Not found ────────────────────────────────────────────────────
  if (!project) {
    return (
      <ProtectedRoute>
        <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Project not found
          </Typography>
          <Button onClick={() => router.push('/dashboard')} variant="contained" sx={{ mt: 2 }}>
            Back to Dashboard
          </Button>
        </Container>
      </ProtectedRoute>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <ProtectedRoute>
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        {/* Header */}
        <AppBar
          position="static"
          elevation={0}
          sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
        >
          <Toolbar variant="dense">
            <IconButton edge="start" onClick={() => router.push(`/project/${projectId}`)}>
              <ArrowBack />
            </IconButton>
            <Typography variant="subtitle1" fontWeight={700} sx={{ ml: 1.5, flexGrow: 1 }} noWrap>
              {project.title} — Editor
            </Typography>
            <VideoExport
              tracks={editorState.tracks}
              textOverlays={editorState.textOverlays}
              duration={editorState.duration}
              projectName={project.title || 'Untitled'}
            />
          </Toolbar>
        </AppBar>

        {/* Main area: sidebar + canvas + text panel */}
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Left — Media Library */}
          <Box
            sx={{
              width: 260,
              flexShrink: 0,
              bgcolor: 'background.paper',
              borderRight: 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Media Library
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Drag onto timeline tracks
              </Typography>
            </Box>
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1.5 }}>
              {projectFiles.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No files
                  </Typography>
                  <Button size="small" onClick={() => router.push(`/project/${projectId}`)} sx={{ mt: 1 }}>
                    Add Files
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {projectFiles.map((file) => (
                    <Paper
                      key={file.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'copy';
                        e.dataTransfer.setData('application/json', JSON.stringify(file));
                      }}
                      sx={{
                        p: 1,
                        border: 1,
                        borderColor: 'divider',
                        cursor: 'grab',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                        },
                        '&:active': { cursor: 'grabbing' },
                      }}
                    >
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="caption" fontWeight={600} noWrap display="block">
                          {file.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize', fontSize: 10 }}>
                          {file.type}
                        </Typography>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          {/* Center — Konva Canvas */}
          <EditorCanvas />

          {/* Right — Text Properties (only when text selected) */}
          {editorState.selectedTextId && <TextPropertiesPanel />}

          {/* Right — Clip Filters (when non-text clip selected, no text panel) */}
          {!editorState.selectedTextId && editorState.selectedClipId && <ClipFiltersPanel />}
        </Box>

        {/* Timeline */}
        <Timeline onAddText={() => setTextDialogOpen(true)} />

        {/* Add Text Dialog */}
        <Dialog open={textDialogOpen} onClose={() => setTextDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Text Overlay</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Enter Text"
              fullWidth
              multiline
              rows={3}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter your text here…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddText();
                }
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Appears at {Math.floor(editorState.currentTime)}s for 5 seconds
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTextDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddText}
              variant="contained"
              disabled={!textInput.trim()}
              sx={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }}
            >
              Add Text
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ProtectedRoute>
  );
}
