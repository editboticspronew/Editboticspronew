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
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  VideoLibrary,
  AudioFile,
  Image as ImageIcon,
  Translate as TranslateIcon,
  Subtitles,
  Visibility,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { uploadProjectFile, deleteProjectFile, fetchProjectFiles } from '@/store/filesSlice';
import TranscriptionModal from './TranscriptionModal';
import AddVideoDialog from './AddVideoDialog';
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
  } | null>(null);
  const [selectedVideoForUpload, setSelectedVideoForUpload] = useState<File | null>(null);
  const [viewTranscription, setViewTranscription] = useState<{
    fileName: string;
    transcription: string;
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

  const handleSaveTranscription = async (fileId: string, transcription: string) => {
    try {
      // Update file document in Firestore with transcription
      await updateDoc(doc(db, 'files', fileId), {
        transcription,
        updatedAt: new Date(),
      });
      
      // Refresh files
      dispatch(fetchProjectFiles(projectId));
    } catch (err: any) {
      console.error('Failed to save transcription:', err);
      throw new Error('Failed to save transcription to database');
    }
  };

  const handleVideoUpload = async (file: File, videoType: string, transcription: string, aiAnalysis?: any) => {
    await uploadFile(file, transcription, videoType);
    
    // TODO: Save aiAnalysis to database if provided
    if (aiAnalysis) {
      console.log('AI Analysis received:', aiAnalysis);
      // Will implement saving analysis data in next iteration
    }
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
                              label="Has Transcription"
                              size="small"
                              color="success"
                              onClick={() => setViewTranscription({
                                fileName: file.name,
                                transcription: file.transcription!,
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
                        {file.type === 'audio' && !file.transcription && (
                          <Tooltip title="Transcribe">
                            <IconButton
                              size="small"
                              onClick={() => setSelectedAudioForTranscription({
                                id: file.id,
                                name: file.name,
                                url: file.url,
                              })}
                            >
                              <TranslateIcon fontSize="small" />
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
        onClose={() => setSelectedVideoForUpload(null)}
        onVideoUpload={handleVideoUpload}
        preSelectedFile={selectedVideoForUpload}
      />

      {/* View Transcription Dialog */}
      {viewTranscription && (
        <Paper
          sx={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1300,
            p: 3,
            maxWidth: 600,
            maxHeight: '80vh',
            overflow: 'auto',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              {viewTranscription.fileName}
            </Typography>
            <IconButton onClick={() => setViewTranscription(null)} size="small">
              <Delete />
            </IconButton>
          </Box>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {viewTranscription.transcription}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
