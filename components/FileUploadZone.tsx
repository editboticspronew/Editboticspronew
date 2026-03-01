'use client';

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  LinearProgress,
  Alert,
  Button,
  Chip,
  Tooltip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
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
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { uploadProjectFile, deleteProjectFile, fetchProjectFiles } from '@/store/filesSlice';
import TranscriptionModal from './TranscriptionModal';
import AddVideoDialog from './AddVideoDialog';
import GenerateClipsDialog from './GenerateClipsDialog';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/init';

interface FileUploadZoneProps {
  projectId: string;
  userId: string;
  acceptedTypes?: 'video' | 'image' | 'audio' | 'all';
}

export default function FileUploadZone({ projectId, userId, acceptedTypes = 'all' }: FileUploadZoneProps) {
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

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <VideoLibrary color="primary" />;
      case 'audio':
        return <AudioFile color="secondary" />;
      case 'image':
        return <ImageIcon color="success" />;
      default:
        return <CloudUpload />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Box>
      {/* Drop Zone */}
      <Card
        {...getRootProps()}
        sx={{
          border: 2,
          borderStyle: 'dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          bgcolor: isDragActive ? 'action.hover' : 'transparent',
          cursor: 'pointer',
          transition: 'all 0.2s',
          mb: 3,
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
      >
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <input {...getInputProps()} />
          <CloudUpload sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" fontWeight={600}>
            {isDragActive ? 'Drop files here' : 'Drag & drop files here or click to browse'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {acceptedTypes === 'video' && 'Supported: MP4, WebM, MOV, AVI'}
            {acceptedTypes === 'image' && 'Supported: JPG, PNG, WebP, GIF'}
            {acceptedTypes === 'audio' && 'Supported: MP3, WAV, AAC, OGG'}
            {acceptedTypes === 'all' && 'Supported: Videos, Images, Audio files'}
          </Typography>
        </CardContent>
      </Card>

      {/* Error Message */}
      {(uploadError || error) && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setUploadError('')}>
          {uploadError || error}
        </Alert>
      )}

      {/* File List */}
      {projectFiles.length > 0 && (
        <Box>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Project Files ({projectFiles.length})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {projectFiles.map((file) => (
              <Box key={file.id} sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box sx={{ flexShrink: 0 }}>
                        {getFileIcon(file.type)}
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {file.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(file.size)} • {file.type}
                        </Typography>
                        {file.transcription && (
                          <Box sx={{ mt: 1 }}>
                            <Chip
                              icon={<Subtitles />}
                              label={
                                file.transcriptionSegments && file.transcriptionSegments.length > 0
                                  ? `Transcription (${file.transcriptionSegments.length} segments)`
                                  : 'Transcription (no timestamps)'
                              }
                              size="small"
                              color={file.transcriptionSegments && file.transcriptionSegments.length > 0 ? 'success' : 'warning'}
                              onClick={() => setViewTranscription({
                                fileName: file.name,
                                transcription: file.transcription!,
                                segments: file.transcriptionSegments as any,
                              })}
                            />
                          </Box>
                        )}
                        {file.videoType && (
                          <Box sx={{ mt: 1 }}>
                            <Chip
                              label={file.videoType}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {(file.type === 'audio' || file.type === 'video') && (
                          !file.transcription || !(file.transcriptionSegments && file.transcriptionSegments.length > 0)
                        ) && (
                          <Tooltip title={file.transcription ? 'Re-transcribe with timestamps' : 'Transcribe'}>
                            <IconButton
                              size="small"
                              color={file.transcription ? 'warning' : 'default'}
                              onClick={() => setSelectedAudioForTranscription({
                                id: file.id,
                                name: file.name,
                                url: file.url,
                                storagePath: file.storagePath,
                              })}
                            >
                              <TranslateIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {file.type === 'video' && file.videoType === 'long-short' && file.transcription && (
                          <Tooltip title="Generate Clips">
                            <IconButton
                              size="small"
                              color="primary"
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
                            >
                              <ContentCut fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(file.id, file.storagePath)}
                            color="error"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {loading && <LinearProgress sx={{ mt: 2 }} />}

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
    </Box>
  );
}
