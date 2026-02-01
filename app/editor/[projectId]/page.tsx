'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Container,
} from '@mui/material';
import {
  ArrowBack,
  PlayArrow,
  Pause,
  Download,
  VideoLibrary,
  AudioFile,
  Image as ImageIcon,
  TextFields,
  Add,
  Lock,
  LockOpen,
  Visibility,
  VisibilityOff,
  Delete,
  ZoomIn,
  ZoomOut,
  FitScreen,
} from '@mui/icons-material';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProjectFiles } from '@/store/filesSlice';
import { fetchUserProjects } from '@/store/projectsSlice';
import { useAuth } from '@/hooks/useAuth';
import { VideoPreview } from '@/components/editor/VideoPreview';
import { VideoExport } from '@/components/editor/VideoExport';

interface Track {
  id: string;
  type: 'video' | 'audio' | 'text' | 'image';
  name: string;
  locked: boolean;
  visible: boolean;
  clips: Clip[];
}

interface Clip {
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
}

export default function VideoEditorPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const router = useRouter();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { files } = useAppSelector((state) => state.files);
  const { projects } = useAppSelector((state) => state.projects);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(50);
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string>('');
  const [selectedMediaType, setSelectedMediaType] = useState<'video' | 'image' | null>(null);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textOverlays, setTextOverlays] = useState<any[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([
    {
      id: 'track-1',
      type: 'video',
      name: 'Video Track 1',
      locked: false,
      visible: true,
      clips: [],
    },
    {
      id: 'track-2',
      type: 'image',
      name: 'Image Track 1',
      locked: false,
      visible: true,
      clips: [],
    },
    {
      id: 'track-3',
      type: 'audio',
      name: 'Audio Track 1',
      locked: false,
      visible: true,
      clips: [],
    },
    {
      id: 'track-4',
      type: 'text',
      name: 'Text Track 1',
      locked: false,
      visible: true,
      clips: [],
    },
  ]);

  const project = projects.find((p) => p.id === projectId);
  const projectFiles = files.filter((f) => f.projectId === projectId);

  // Calculate actual duration from all clips and text overlays
  const duration = React.useMemo(() => {
    let maxDuration = 0;
    
    // Check all clips in all tracks
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        const clipEnd = clip.startTime + clip.duration;
        if (clipEnd > maxDuration) {
          maxDuration = clipEnd;
        }
      });
    });
    
    // Check text overlays
    textOverlays.forEach(overlay => {
      const textEnd = overlay.startTime + (overlay.endTime - overlay.startTime);
      if (textEnd > maxDuration) {
        maxDuration = textEnd;
      }
    });
    
    // Minimum 5 seconds, or actual content duration
    return Math.max(5, maxDuration);
  }, [tracks, textOverlays]);

  useEffect(() => {
    if (user?.uid) {
      dispatch(fetchUserProjects(user.uid));
    }
  }, [user?.uid, dispatch]);

  useEffect(() => {
    if (projectId) {
      dispatch(fetchProjectFiles(projectId));
    }
  }, [projectId, dispatch]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleAddTrack = (type: 'video' | 'audio' | 'text' | 'image') => {
    if (type === 'text') {
      setTextDialogOpen(true);
      return;
    }
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Track ${tracks.filter((t) => t.type === type).length + 1}`,
      locked: false,
      visible: true,
      clips: [],
    };
    setTracks((prev) => [...prev, newTrack]);
  };

  const handleAddText = () => {
    if (!textInput.trim()) return;

    const textOverlay = {
      id: `text-${Date.now()}`,
      text: textInput,
      x: 50,
      y: 50,
      fontSize: 32,
      color: '#FFFFFF',
      font: 'Arial',
      startTime: currentTime,
      duration: 5,
    };

    setTextOverlays((prev) => [...prev, textOverlay]);

    // Add to text track
    const textTrack = tracks.find((t) => t.type === 'text');
    const textClip: Clip = {
      id: textOverlay.id,
      fileId: 'text',
      fileName: textInput,
      startTime: currentTime,
      duration: 5,
      trimStart: 0,
      trimEnd: 0,
    };

    if (textTrack) {
      setTracks((prev) =>
        prev.map((track) =>
          track.id === textTrack.id
            ? { ...track, clips: [...track.clips, textClip].sort((a, b) => a.startTime - b.startTime) }
            : track
        )
      );
    } else {
      const newTextTrack: Track = {
        id: `track-text-${Date.now()}`,
        type: 'text',
        name: 'Text Track 1',
        locked: false,
        visible: true,
        clips: [textClip],
      };
      setTracks((prev) => [...prev, newTextTrack]);
    }

    setTextInput('');
    setTextDialogOpen(false);
  };

  const handleDrop = (trackId: string, e: React.DragEvent) => {
    e.preventDefault();
    const fileData = e.dataTransfer.getData('application/json');
    if (!fileData) return;

    const file = JSON.parse(fileData);
    const track = tracks.find((t) => t.id === trackId);

    if (track?.type === 'text') return;

    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      fileId: file.id,
      fileName: file.name,
      fileUrl: file.url,
      fileType: file.type,
      storagePath: file.storagePath,
      startTime: 0,
      duration: file.type === 'image' ? 5 : 10,
      trimStart: 0,
      trimEnd: 0,
    };

    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId
          ? { ...track, clips: [...track.clips, newClip].sort((a, b) => a.startTime - b.startTime) }
          : track
      )
    );

    // Load media in preview
    if (file.type === 'video' || file.type === 'image') {
      setSelectedMediaUrl(file.url);
      setSelectedMediaType(file.type);
    }
  };

  const handleUpdateClip = (trackId: string, clipId: string, updates: Partial<Clip>) => {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId
          ? {
              ...track,
              clips: track.clips.map((clip) =>
                clip.id === clipId ? { ...clip, ...updates } : clip
              ),
            }
          : track
      )
    );
  };

  const handleTextDrag = (id: string, x: number, y: number) => {
    setTextOverlays((prev) =>
      prev.map((overlay) =>
        overlay.id === id ? { ...overlay, x, y } : overlay
      )
    );
  };

  const handleTextUpdate = (id: string, updates: Partial<any>) => {
    setTextOverlays((prev) =>
      prev.map((overlay) =>
        overlay.id === id ? { ...overlay, ...updates } : overlay
      )
    );
  };

  const handleTextDelete = (id: string) => {
    setTextOverlays((prev) => prev.filter((overlay) => overlay.id !== id));
    setTracks((prev) =>
      prev.map((track) =>
        track.type === 'text'
          ? { ...track, clips: track.clips.filter((clip) => clip.id !== id) }
          : track
      )
    );
    setSelectedTextId(null);
  };

  const handleToggleLock = (trackId: string) => {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId ? { ...track, locked: !track.locked } : track
      )
    );
  };

  const handleToggleVisibility = (trackId: string) => {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId ? { ...track, visible: !track.visible } : track
      )
    );
  };

  const handleDeleteTrack = (trackId: string) => {
    setTracks((prev) => prev.filter((track) => track.id !== trackId));
  };

  const getTrackIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <VideoLibrary fontSize="small" />;
      case 'audio':
        return <AudioFile fontSize="small" />;
      case 'image':
        return <ImageIcon fontSize="small" />;
      case 'text':
        return <TextFields fontSize="small" />;
      default:
        return null;
    }
  };

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

  return (
    <ProtectedRoute>
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        {/* Header */}
        <AppBar
          position="static"
          elevation={0}
          sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
        >
          <Toolbar>
            <IconButton edge="start" onClick={() => router.push(`/project/${projectId}`)}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h6" fontWeight={700} sx={{ ml: 2, flexGrow: 1 }}>
              {project.title} - Video Editor
            </Typography>
            <VideoExport
              tracks={tracks}
              textOverlays={textOverlays}
              duration={duration}
              projectName={project?.title || 'Untitled'}
            />
          </Toolbar>
        </AppBar>

        {/* Main Content */}
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          {/* Left Sidebar - Media Library */}
          <Box
            sx={{
              width: 300,
              bgcolor: 'background.paper',
              borderRight: 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Media Library
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Drag files onto timeline tracks
              </Typography>
            </Box>
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
              {projectFiles.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No files in project
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => router.push(`/project/${projectId}`)}
                    sx={{ mt: 2 }}
                  >
                    Add Files
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {projectFiles.map((file) => (
                    <Paper
                      key={file.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'copy';
                        e.dataTransfer.setData('application/json', JSON.stringify(file));
                      }}
                      sx={{
                        p: 1.5,
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
                        '&:active': {
                          cursor: 'grabbing',
                        },
                      }}
                    >
                      {file.type === 'video' && <VideoLibrary color="primary" fontSize="small" />}
                      {file.type === 'audio' && <AudioFile color="secondary" fontSize="small" />}
                      {file.type === 'image' && <ImageIcon color="success" fontSize="small" />}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {file.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                          {file.type}
                        </Typography>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          {/* Center - Video Preview */}
          <VideoPreview
            tracks={tracks}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onStop={() => {
              setIsPlaying(false);
              setCurrentTime(0);
            }}
            onTimeUpdate={setCurrentTime}
            textOverlays={textOverlays}
            zoom={zoom}
            onZoomChange={setZoom}
            selectedTextId={selectedTextId}
            onTextSelect={setSelectedTextId}
            onTextUpdate={handleTextUpdate}
            onTextDelete={handleTextDelete}
          />
        </Box>

        {/* Timeline */}
        <Box
          sx={{
            height: 350,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Add Track Buttons */}
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
            <Button size="small" startIcon={<VideoLibrary />} onClick={() => handleAddTrack('video')}>
              Video
            </Button>
            <Button size="small" startIcon={<ImageIcon />} onClick={() => handleAddTrack('image')}>
              Image
            </Button>
            <Button size="small" startIcon={<AudioFile />} onClick={() => handleAddTrack('audio')}>
              Audio
            </Button>
            <Button size="small" startIcon={<Add />} onClick={() => handleAddTrack('text')}>
              Text
            </Button>
          </Box>

          {/* Timeline Ruler */}
          <Box
            sx={{
              height: 30,
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              borderBottom: 1,
              borderColor: 'divider',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ display: 'flex', height: '100%', position: 'relative' }}>
              {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    left: `${(i / duration) * 100}%`,
                    height: '100%',
                    borderLeft: 1,
                    borderColor: 'divider',
                    pl: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                    {i}s
                  </Typography>
                </Box>
              ))}
              {/* Playhead */}
              <Box
                sx={{
                  position: 'absolute',
                  left: `${(currentTime / duration) * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  bgcolor: 'error.main',
                  zIndex: 10,
                }}
              />
            </Box>
          </Box>

          {/* Timeline Tracks */}
          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
            {tracks.map((track) => (
              <Box
                key={track.id}
                sx={{
                  display: 'flex',
                  borderBottom: 1,
                  borderColor: 'divider',
                  minHeight: 60,
                }}
              >
                {/* Track Header */}
                <Box
                  sx={{
                    width: 200,
                    p: 1.5,
                    bgcolor: 'background.default',
                    borderRight: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  {getTrackIcon(track.type)}
                  <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }} noWrap>
                    {track.name}
                  </Typography>
                  <IconButton size="small" onClick={() => handleToggleLock(track.id)}>
                    {track.locked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={() => handleToggleVisibility(track.id)}>
                    {track.visible ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDeleteTrack(track.id)} color="error">
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>

                {/* Track Content */}
                <Box
                  sx={{
                    flexGrow: 1,
                    bgcolor: track.visible ? 'background.paper' : alpha(theme.palette.action.disabled, 0.05),
                    position: 'relative',
                    minHeight: 60,
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(track.id, e)}
                >
                  {/* Clips */}
                  {track.clips.map((clip) => {
                    const ClipComponent = () => {
                      const [isDragging, setIsDragging] = React.useState(false);
                      const [isResizing, setIsResizing] = React.useState<'left' | 'right' | null>(null);
                      const [dragStart, setDragStart] = React.useState({ x: 0, startTime: 0, duration: 0 });

                      const handleMouseDown = (e: React.MouseEvent) => {
                        if (track.locked) return;
                        e.stopPropagation();
                        setIsDragging(true);
                        setDragStart({ x: e.clientX, startTime: clip.startTime, duration: clip.duration });
                      };

                      const handleResizeStart = (e: React.MouseEvent, side: 'left' | 'right') => {
                        if (track.locked) return;
                        e.stopPropagation();
                        setIsResizing(side);
                        setDragStart({ x: e.clientX, startTime: clip.startTime, duration: clip.duration });
                      };

                      React.useEffect(() => {
                        if (!isDragging && !isResizing) return;

                        const handleMouseMove = (e: MouseEvent) => {
                          const deltaX = e.clientX - dragStart.x;
                          const deltaTime = deltaX / zoom;

                          if (isDragging) {
                            const newStartTime = Math.max(0, dragStart.startTime + deltaTime);
                            handleUpdateClip(track.id, clip.id, { startTime: newStartTime });
                          } else if (isResizing === 'left') {
                            const newStartTime = Math.max(0, dragStart.startTime + deltaTime);
                            const newDuration = Math.max(0.5, dragStart.duration - deltaTime);
                            handleUpdateClip(track.id, clip.id, { 
                              startTime: newStartTime,
                              duration: newDuration 
                            });
                          } else if (isResizing === 'right') {
                            const newDuration = Math.max(0.5, dragStart.duration + deltaTime);
                            handleUpdateClip(track.id, clip.id, { duration: newDuration });
                          }
                        };

                        const handleMouseUp = () => {
                          setIsDragging(false);
                          setIsResizing(null);
                        };

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);

                        return () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                      }, [isDragging, isResizing]);

                      return (
                        <Box
                          sx={{
                            position: 'absolute',
                            left: clip.startTime * zoom,
                            width: clip.duration * zoom,
                            height: 50,
                            top: 5,
                            bgcolor: track.type === 'text' ? 'secondary.main' : 'primary.main',
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            px: 1,
                            cursor: track.locked ? 'not-allowed' : (isDragging ? 'grabbing' : 'grab'),
                            opacity: track.locked ? 0.5 : 1,
                            border: selectedTextId === clip.id ? 3 : 0,
                            borderColor: 'warning.main',
                            '&:hover': {
                              boxShadow: 2,
                            },
                          }}
                          onMouseDown={handleMouseDown}
                        >
                          {/* Left resize handle */}
                          <Box
                            sx={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 8,
                              cursor: 'ew-resize',
                              bgcolor: 'rgba(255,255,255,0.2)',
                              '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.4)',
                              },
                            }}
                            onMouseDown={(e) => handleResizeStart(e, 'left')}
                          />
                          
                          <Typography 
                            variant="caption" 
                            color="white" 
                            noWrap 
                            sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}
                            onClick={(e) => {
                              if (track.type === 'text') {
                                e.stopPropagation();
                                setSelectedTextId(clip.id);
                              }
                            }}
                          >
                            {track.type === 'text' && <TextFields fontSize="small" />}
                            {clip.fileName}
                          </Typography>

                          {/* Right resize handle */}
                          <Box
                            sx={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: 8,
                              cursor: 'ew-resize',
                              bgcolor: 'rgba(255,255,255,0.2)',
                              '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.4)',
                              },
                            }}
                            onMouseDown={(e) => handleResizeStart(e, 'right')}
                          />
                        </Box>
                      );
                    };

                    return <ClipComponent key={clip.id} />;
                  })}

                  {/* Drop zone indicator */}
                  {track.clips.length === 0 && track.type !== 'text' && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Drop {track.type} files here
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Text Dialog */}
        <Dialog open={textDialogOpen} onClose={() => setTextDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Text Overlay</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Enter Text"
              type="text"
              fullWidth
              multiline
              rows={3}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter your text here..."
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Text will appear at current time ({Math.floor(currentTime)}s) for 5 seconds
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTextDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddText}
              variant="contained"
              disabled={!textInput.trim()}
              sx={{
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              }}
            >
              Add Text
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ProtectedRoute>
  );
}
