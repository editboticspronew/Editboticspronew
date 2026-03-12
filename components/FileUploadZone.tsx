'use client';

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  LinearProgress,
  Alert,
  Button,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Close,
  VideoLibrary,
  AudioFile,
  Image as ImageIcon,
  Translate as TranslateIcon,
  Subtitles,
  Visibility,
  ContentCut,
  PlayArrow,
  InsertDriveFile,
  Download,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { uploadProjectFile, deleteProjectFile, fetchProjectFiles } from '@/store/filesSlice';
import TranscriptionModal from './TranscriptionModal';
import AddVideoDialog from './AddVideoDialog';
import GenerateClipsDialog from './GenerateClipsDialog';
import VideoPlayer from './VideoPlayer';
import dynamic from 'next/dynamic';
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/init';

interface FileUploadZoneProps {
  projectId: string;
  userId: string;
  acceptedTypes?: 'video' | 'image' | 'audio' | 'all';
}

export default function FileUploadZone({ projectId, userId, acceptedTypes = 'all' }: FileUploadZoneProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const dispatch = useAppDispatch();
  const { files, uploadProgress, loading, error } = useAppSelector((state) => state.files);
  const [uploadError, setUploadError] = useState('');
  const [selectedAudioForTranscription, setSelectedAudioForTranscription] = useState<{
    id: string;
    name: string;
    url?: string;
    file?: File;
    storagePath?: string;
  } | null>(null);
  const [selectedVideoForUpload, setSelectedVideoForUpload] = useState<File | null>(null);
  const [viewTranscription, setViewTranscription] = useState<{
    fileName: string;
    transcription: string;
    segments?: { text: string; start: number; end: number }[];
  } | null>(null);
  const [clipGenerationFile, setClipGenerationFile] = useState<{
    id: string;
    name: string;
    url: string;
    storagePath: string;
    transcription?: string;
    transcriptionSegments?: { text: string; start: number; end: number }[];
    videoType?: string;
    visionAnalysis?: any;
  } | null>(null);

  // Video/audio preview
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; type: 'video' | 'audio' } | null>(null);

  const projectFiles = files.filter((f) => f.projectId === projectId);

  const getAcceptConfig = (): Record<string, string[]> => {
    if (acceptedTypes === 'video') {
      return { 'video/*': ['.mp4', '.webm', '.mov', '.avi'] };
    }
    if (acceptedTypes === 'image') {
      return { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'] };
    }
    if (acceptedTypes === 'audio') {
      return { 'audio/*': ['.mp3', '.wav', '.aac', '.ogg', '.m4a'] };
    }
    return {
      'video/*': ['.mp4', '.webm', '.mov', '.avi'],
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      'audio/*': ['.mp3', '.wav', '.aac', '.ogg', '.m4a'],
    };
  };

  const uploadFile = useCallback(
    async (file: File, transcription?: string, videoType?: string) => {
      const fileType = file.type.split('/')[0] as 'video' | 'audio' | 'image';

      try {
        await dispatch(
          uploadProjectFile({
            file,
            projectId,
            userId,
            type: fileType,
            transcription,
            videoType,
          })
        ).unwrap();
        
        // Refresh files
        dispatch(fetchProjectFiles(projectId));
      } catch (err: any) {
        setUploadError(err.message);
      }
    },
    [dispatch, projectId, userId]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setUploadError('');

      for (const file of acceptedFiles) {
        const fileType = file.type.split('/')[0] as 'video' | 'audio' | 'image';

        // Only accept video, image, and audio files
        if (!['video', 'image', 'audio'].includes(fileType)) {
          setUploadError('Only video, image, and audio files are supported');
          continue;
        }

        // Validate file size
        const maxSize = 500 * 1024 * 1024; // 500 MB
        if (file.size > maxSize) {
          setUploadError(`File size exceeds 500 MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
          continue;
        }

        // Handle different file types
        if (fileType === 'video') {
          // Open video dialog for video files
          setSelectedVideoForUpload(file);
          continue; // Don't upload yet, wait for video type selection and transcription
        } else if (fileType === 'audio') {
          // Open transcription modal for audio files
          setSelectedAudioForTranscription({
            id: `local_${Date.now()}`,
            name: file.name,
            file: file,
          });
          continue; // Don't upload yet, wait for transcription
        }

        // Upload images immediately
        await uploadFile(file);
      }
    },
    [uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: getAcceptConfig() as any,
  });

  const handleDelete = async (fileId: string, storagePath: string) => {
    try {
      await dispatch(deleteProjectFile({ fileId, storagePath })).unwrap();
      // Refresh files
      dispatch(fetchProjectFiles(projectId));
    } catch (err: any) {
      setUploadError(err.message);
    }
  };

  const handleSaveTranscription = async (
    fileId: string,
    transcription: string,
    segments?: { text: string; start: number; end: number }[]
  ) => {
    try {
      // Update file document in Firestore with transcription + segments
      const updateData: Record<string, any> = {
        transcription,
        updatedAt: new Date(),
      };

      // Save timestamped segments so we don't have to re-transcribe
      if (segments && segments.length > 0) {
        updateData.transcriptionSegments = segments.map((s) => ({
          text: s.text,
          start: s.start,
          end: s.end,
        }));
      }

      await updateDoc(doc(db, 'files', fileId), updateData);
      
      // Refresh files
      dispatch(fetchProjectFiles(projectId));
    } catch (err: any) {
      console.error('Failed to save transcription:', err);
      throw new Error('Failed to save transcription to database');
    }
  };

  const handleVideoUpload = async () => {
    // Video upload and metadata saving is now handled incrementally by AddVideoDialog
    // Just refresh files to show the newly saved file
    dispatch(fetchProjectFiles(projectId));
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'video': return '#14b8a6';
      case 'audio': return '#8b5cf6';
      case 'image': return '#f59e0b';
      default: return '#71717a';
    }
  };

  const getTypeIcon = (type: string, size = 20) => {
    const color = getTypeColor(type);
    switch (type) {
      case 'video': return <VideoLibrary sx={{ fontSize: size, color }} />;
      case 'audio': return <AudioFile sx={{ fontSize: size, color }} />;
      case 'image': return <ImageIcon sx={{ fontSize: size, color }} />;
      default: return <InsertDriveFile sx={{ fontSize: size, color }} />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0) + ' ' + sizes[i];
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return null;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Box>
      {/* ── Modern Drop Zone ── */}
      <Box
        {...getRootProps()}
        sx={{
          border: 2,
          borderStyle: 'dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          bgcolor: isDragActive
            ? (isDark ? alpha('#14b8a6', 0.06) : alpha('#0d9488', 0.04))
            : 'transparent',
          borderRadius: 3,
          cursor: 'pointer',
          transition: 'all 0.2s',
          mb: 3,
          py: 5,
          textAlign: 'center',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: isDark ? alpha('#14b8a6', 0.04) : alpha('#0d9488', 0.03),
          },
        }}
      >
        <input {...getInputProps()} />
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            bgcolor: isDark ? alpha('#14b8a6', 0.1) : alpha('#0d9488', 0.08),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <CloudUpload sx={{ fontSize: 26, color: 'primary.main' }} />
        </Box>
        <Typography variant="body1" fontWeight={600} sx={{ mb: 0.5 }}>
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
          {!isDragActive && 'or click to browse · '}
          {acceptedTypes === 'video' && 'MP4, WebM, MOV, AVI'}
          {acceptedTypes === 'image' && 'JPG, PNG, WebP, GIF'}
          {acceptedTypes === 'audio' && 'MP3, WAV, AAC, OGG'}
          {acceptedTypes === 'all' && 'Videos, Images, Audio up to 500 MB'}
        </Typography>
      </Box>

      {/* Error */}
      {(uploadError || error) && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setUploadError('')}>
          {uploadError || error}
        </Alert>
      )}

      {/* ── Modern File Cards ── */}
      {projectFiles.length > 0 && (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 2, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Files ({projectFiles.length})
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)',
              },
              gap: 2,
            }}
          >
            {projectFiles.map((file) => {
              const typeColor = getTypeColor(file.type);
              const hasTimestampedTranscription = file.transcriptionSegments && file.transcriptionSegments.length > 0;
              const needsTranscription = (file.type === 'audio' || file.type === 'video') &&
                (!file.transcription || !hasTimestampedTranscription);
              const canGenerateClips = file.type === 'video' && file.transcription;

              return (
                <Box
                  key={file.id}
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 3,
                    overflow: 'hidden',
                    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                    '&:hover': {
                      borderColor: isDark ? alpha(typeColor, 0.4) : typeColor,
                      transform: 'translateY(-3px)',
                      boxShadow: isDark
                        ? `0 16px 32px rgba(0,0,0,0.45)`
                        : `0 16px 32px rgba(0,0,0,0.07)`,
                    },
                    '&:hover .file-hover-overlay': { opacity: 1 },
                  }}
                >
                  {/* Thumbnail */}
                  <Box
                    sx={{
                      position: 'relative',
                      aspectRatio: '16/9',
                      bgcolor: isDark ? alpha(typeColor, 0.06) : alpha(typeColor, 0.04),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {file.thumbnail ? (
                      <Box
                        component="img"
                        src={file.thumbnail}
                        alt={file.name}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Box sx={{ textAlign: 'center', opacity: 0.5 }}>
                        {getTypeIcon(file.type, 36)}
                        <Typography sx={{ display: 'block', mt: 0.5, fontSize: '0.6rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {file.type}
                        </Typography>
                      </Box>
                    )}

                    {/* Hover overlay with play */}
                    {(file.type === 'video' || file.type === 'audio') && (
                      <Box
                        className="file-hover-overlay"
                        onClick={() => {
                          if (file.url) {
                            setPreviewFile({ name: file.name, url: file.url, type: file.type as 'video' | 'audio' });
                          }
                        }}
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: 'rgba(0,0,0,0.45)',
                          backdropFilter: 'blur(2px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          cursor: 'pointer',
                          transition: 'opacity 0.2s',
                        }}
                      >
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            bgcolor: 'rgba(255,255,255,0.92)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                          }}
                        >
                          <PlayArrow sx={{ fontSize: 24, color: '#111', ml: 0.3 }} />
                        </Box>
                      </Box>
                    )}

                    {/* Duration pill */}
                    {file.duration && (
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 6,
                          right: 6,
                          bgcolor: 'rgba(0,0,0,0.8)',
                          backdropFilter: 'blur(4px)',
                          color: '#fff',
                          px: 0.8,
                          py: 0.25,
                          borderRadius: 1,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                        }}
                      >
                        {formatDuration(file.duration)}
                      </Box>
                    )}

                    {/* Type badge */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        bgcolor: alpha(typeColor, 0.85),
                        backdropFilter: 'blur(8px)',
                        color: '#fff',
                        px: 0.8,
                        py: 0.25,
                        borderRadius: 1,
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {file.type}
                    </Box>
                  </Box>

                  {/* File info */}
                  <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
                    <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.85rem', mb: 0.3 }}>
                      {file.originalName || file.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {formatFileSize(file.size)}
                      </Typography>
                      {file.transcription && (
                        <Box
                          onClick={() => setViewTranscription({
                            fileName: file.name,
                            transcription: file.transcription!,
                            segments: file.transcriptionSegments as any,
                          })}
                          sx={{
                            bgcolor: isDark ? alpha('#14b8a6', 0.12) : alpha('#14b8a6', 0.08),
                            color: '#14b8a6',
                            px: 0.8,
                            py: 0.15,
                            borderRadius: 0.8,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            '&:hover': { bgcolor: alpha('#14b8a6', 0.2) },
                          }}
                        >
                          {hasTimestampedTranscription
                            ? `${file.transcriptionSegments!.length} segments`
                            : 'Transcribed'}
                        </Box>
                      )}
                      {file.videoType && (
                        <Box
                          sx={{
                            bgcolor: isDark ? alpha('#6366f1', 0.12) : alpha('#6366f1', 0.08),
                            color: '#6366f1',
                            px: 0.8,
                            py: 0.15,
                            borderRadius: 0.8,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                          }}
                        >
                          {file.videoType}
                        </Box>
                      )}
                      {file.aiAnalysis && (
                        <Box
                          sx={{
                            bgcolor: isDark ? alpha('#8b5cf6', 0.12) : alpha('#8b5cf6', 0.08),
                            color: '#8b5cf6',
                            px: 0.8,
                            py: 0.15,
                            borderRadius: 0.8,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                          }}
                        >
                          AI Analyzed
                        </Box>
                      )}
                    </Box>
                  </Box>

                  {/* ── Action Buttons ── */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1,
                      py: 1,
                      borderTop: 1,
                      borderColor: isDark ? alpha('#fff', 0.04) : alpha('#000', 0.04),
                      mt: 0.5,
                    }}
                  >
                    {/* Transcribe */}
                    {needsTranscription && (
                      <Tooltip title={file.transcription ? 'Re-transcribe with timestamps' : 'Transcribe'}>
                        <IconButton
                          size="small"
                          onClick={() => setSelectedAudioForTranscription({
                            id: file.id,
                            name: file.name,
                            url: file.url,
                            storagePath: file.storagePath,
                          })}
                          sx={{
                            color: file.transcription ? '#f59e0b' : 'text.secondary',
                            '&:hover': { bgcolor: isDark ? alpha('#fff', 0.06) : alpha('#000', 0.04) },
                          }}
                        >
                          <TranslateIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    )}

                    {/* View Transcription */}
                    {file.transcription && (
                      <Tooltip title="View Transcription">
                        <IconButton
                          size="small"
                          onClick={() => setViewTranscription({
                            fileName: file.name,
                            transcription: file.transcription!,
                            segments: file.transcriptionSegments as any,
                          })}
                          sx={{
                            color: '#14b8a6',
                            '&:hover': { bgcolor: isDark ? alpha('#14b8a6', 0.1) : alpha('#14b8a6', 0.06) },
                          }}
                        >
                          <Subtitles sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    )}

                    {/* Generate Clips */}
                    {canGenerateClips && (
                      <Tooltip title="Generate Clips">
                        <IconButton
                          size="small"
                          onClick={() => setClipGenerationFile({
                            id: file.id,
                            name: file.name,
                            url: file.url,
                            storagePath: file.storagePath,
                            transcription: file.transcription,
                            transcriptionSegments: file.transcriptionSegments as any,
                            videoType: file.videoType,
                            visionAnalysis: file.visionAnalysis,
                          })}
                          sx={{
                            color: 'primary.main',
                            '&:hover': { bgcolor: isDark ? alpha('#14b8a6', 0.1) : alpha('#14b8a6', 0.06) },
                          }}
                        >
                          <ContentCut sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    )}

                    <Box sx={{ flexGrow: 1 }} />

                    {/* Download */}
                    {file.url && (
                      <Tooltip title="Download">
                        <IconButton
                          size="small"
                          component="a"
                          href={file.url}
                          download={file.name}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            color: isDark ? alpha('#3b82f6', 0.7) : '#3b82f6',
                            '&:hover': { bgcolor: alpha('#3b82f6', 0.1) },
                          }}
                        >
                          <Download sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    )}

                    {/* Delete */}
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(file.id, file.storagePath)}
                        sx={{
                          color: isDark ? alpha('#ef4444', 0.7) : '#ef4444',
                          '&:hover': { bgcolor: alpha('#ef4444', 0.1) },
                        }}
                      >
                        <Delete sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {loading && <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />}

      {/* Transcription Modal */}
      <TranscriptionModal
        open={!!selectedAudioForTranscription}
        onClose={() => setSelectedAudioForTranscription(null)}
        audioFile={selectedAudioForTranscription}
        onSaveTranscription={handleSaveTranscription}
        onUploadWithTranscription={(file, transcription) => {
          uploadFile(file, transcription);
          setSelectedAudioForTranscription(null);
        }}
      />

      {/* Video Upload Dialog */}
      <AddVideoDialog
        open={!!selectedVideoForUpload}
        onClose={() => {
          setSelectedVideoForUpload(null);
          // Refresh files when dialog closes to show any saved files
          dispatch(fetchProjectFiles(projectId));
        }}
        projectId={projectId}
        userId={userId}
        preSelectedFile={selectedVideoForUpload}
      />

      {/* View Transcription Dialog */}
      <Dialog
        open={!!viewTranscription}
        onClose={() => setViewTranscription(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        {viewTranscription && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Subtitles color="primary" />
                  <Typography variant="h6" fontWeight={700} noWrap sx={{ maxWidth: 400 }}>
                    {viewTranscription.fileName}
                  </Typography>
                </Box>
                <IconButton onClick={() => setViewTranscription(null)} size="small">
                  <Close />
                </IconButton>
              </Box>
              {viewTranscription.segments && viewTranscription.segments.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {viewTranscription.segments.length} segments with timestamps
                </Typography>
              )}
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ pt: 2 }}>
              {viewTranscription.segments && viewTranscription.segments.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {viewTranscription.segments.map((seg, idx) => {
                    const formatTs = (s: number) => {
                      const m = Math.floor(s / 60);
                      const sec = Math.floor(s % 60);
                      return `${m}:${String(sec).padStart(2, '0')}`;
                    };
                    return (
                      <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                        <Chip
                          label={`${formatTs(seg.start)} – ${formatTs(seg.end)}`}
                          size="small"
                          variant="outlined"
                          color="primary"
                          sx={{ flexShrink: 0, mt: 0.25, fontFamily: 'monospace', fontSize: '0.75rem' }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {seg.text}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {viewTranscription.transcription}
                </Typography>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Generate Clips Dialog */}
      <GenerateClipsDialog
        open={!!clipGenerationFile}
        onClose={() => setClipGenerationFile(null)}
        file={clipGenerationFile}
        projectId={projectId}
      />

      {/* Video/Audio Preview Dialog */}
      <Dialog
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}
      >
        {previewFile && (
          <>
            <DialogTitle sx={{ pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                <PlayArrow color="primary" />
                <Typography variant="h6" fontWeight={700} noWrap>
                  {previewFile.name}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title="Download">
                  <IconButton
                    component="a"
                    href={previewFile.url}
                    download={previewFile.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                  >
                    <Download />
                  </IconButton>
                </Tooltip>
                <IconButton onClick={() => setPreviewFile(null)} size="small">
                  <Close />
                </IconButton>
              </Box>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ p: 0, bgcolor: '#000' }}>
              {previewFile.type === 'video' ? (
                <VideoPlayer
                  url={previewFile.url}
                  maxHeight="70vh"
                  borderRadius={0}
                  compact={false}
                />
              ) : (
                <Box sx={{ p: 3 }}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {React.createElement(ReactPlayer as any, {
                    url: previewFile.url,
                    controls: true,
                    width: '100%',
                    height: 50,
                    config: {
                      file: {
                        forceAudio: true,
                      },
                    },
                  })}
                </Box>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
