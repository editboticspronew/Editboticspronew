'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  Paper,
  useTheme,
  useMediaQuery,
  LinearProgress,
} from '@mui/material';
import { Close, Translate as TranslateIcon } from '@mui/icons-material';
import { transcribeAudio } from '@/utils/audioTranscription';
import { OPENAI_API_KEY } from '@/lib/config/constants';

interface TranscriptionModalProps {
  open: boolean;
  onClose: () => void;
  audioFile: {
    id: string;
    name: string;
    url?: string;
    file?: File;
  } | null;
  onSaveTranscription?: (fileId: string, transcription: string) => Promise<void>;
  onUploadWithTranscription?: (file: File, transcription: string) => void;
}

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'th', name: 'Thai' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'fi', name: 'Finnish' },
];

export default function TranscriptionModal({ open, onClose, audioFile, onSaveTranscription, onUploadWithTranscription }: TranscriptionModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleClose = () => {
    if (loading || saving || uploading) return; // Prevent closing during operations
    setTranscription('');
    setError('');
    setLoading(false);
    setSaving(false);
    setUploading(false);
    onClose();
  };

  const handleTranscribe = async () => {
    if (!audioFile) return;

    setError('');
    setLoading(true);

    try {
      // Use URL directly if available, otherwise use the File object
      const audioSource = audioFile.url || audioFile.file;
      
      if (!audioSource) {
        throw new Error('No audio file or URL provided');
      }

      // For File objects, validate file size (OpenAI Whisper limit: 25 MB)
      if (audioSource instanceof File) {
        const maxSize = 25 * 1024 * 1024; // 25 MB
        if (audioSource.size > maxSize) {
          throw new Error(`File size exceeds OpenAI Whisper API limit of 25 MB. Current size: ${(audioSource.size / (1024 * 1024)).toFixed(2)} MB`);
        }
      }

      // Get OpenAI API key from environment
      const apiKey = OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured.');
      }

      console.log('🎤 Transcribing from:', audioFile.url ? 'URL' : 'file');

      // Transcribe using OpenAI Whisper (now accepts both File and URL string)
      const result = await transcribeAudio(audioSource, apiKey, {
        language: selectedLanguage,
        timestampGranularity: 'segment',
      });

      setTranscription(result.text);

      // Auto-save transcription if callback is provided and file has ID (already uploaded)
      if (onSaveTranscription && audioFile.url && audioFile.id) {
        try {
          setSaving(true);
          await onSaveTranscription(audioFile.id, result.text);
        } catch (saveErr: any) {
          console.error('Failed to save transcription:', saveErr);
          // Don't show error since transcription was successful
        } finally {
          setSaving(false);
        }
      }
      
      // If this is a local file (before upload), automatically upload with transcription
      if (onUploadWithTranscription && audioFile.file && !audioFile.url) {
        try {
          setUploading(true);
          await new Promise<void>((resolve) => {
            onUploadWithTranscription(audioFile.file!, result.text);
            // Wait a bit for upload to start
            setTimeout(resolve, 1000);
          });
          // Wait another moment before closing
          await new Promise(resolve => setTimeout(resolve, 500));
          handleClose();
        } catch (uploadErr: any) {
          console.error('Failed to upload:', uploadErr);
          setError('Transcription succeeded but upload failed');
        } finally {
          setUploading(false);
        }
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      setError(err.message || 'Failed to transcribe audio. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2,
          maxHeight: isMobile ? '100vh' : '90vh',
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TranslateIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Transcribe Audio
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
        {audioFile && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {audioFile.name}
          </Typography>
        )}
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>          
          {/* Language Selection */}
          <FormControl fullWidth disabled={loading || !!transcription}>
            <InputLabel>Target Language</InputLabel>
            <Select
              value={selectedLanguage}
              label="Target Language"
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              {languages.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>
                  {lang.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Loading State */}
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                Transcribing audio with OpenAI Whisper...
              </Typography>
            </Box>
          )}

          {/* Transcription Result */}
          {transcription && (
            <>
              <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: 'success.main' }}>
                ✓ Transcription Complete
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  maxHeight: 200,
                  overflow: 'auto',
                  bgcolor: 'background.default',
                  mb: 2,
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {transcription}
                </Typography>
              </Paper>

              {uploading && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Uploading audio to Firebase...
                    </Typography>
                  </Box>
                  <LinearProgress />
                </Box>
              )}

              {!uploading && audioFile?.file && (
                <Alert severity="success">
                  Audio is ready! The transcription will be saved with your file.
                </Alert>
              )}

              {saving && !uploading && (
                <Alert severity="info" icon={<CircularProgress size={16} />}>
                  Saving transcription to file...
                </Alert>
              )}
            </>
          )}

          {/* Instructions */}
          {!transcription && !loading && (
            <>
              <Alert severity="info" sx={{ mt: 1 }}>
                Select the target language and click "Transcribe" to generate the transcription.
              </Alert>
              <Alert severity="warning" sx={{ mt: 1 }}>
                <strong>Note:</strong> OpenAI Whisper API has a 25 MB file size limit. Large files may need to be compressed or split.
              </Alert>
            </>
          )}
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" disabled={loading || saving || uploading}>
          {transcription ? 'Close' : 'Cancel'}
        </Button>
        {!transcription && (
          <Button
            onClick={handleTranscribe}
            variant="contained"
            disabled={loading || saving || uploading}
            startIcon={loading ? <CircularProgress size={16} /> : <TranslateIcon />}
            sx={{
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
              },
            }}
          >
            {loading ? 'Transcribing...' : saving ? 'Saving...' : uploading ? 'Uploading...' : 'Transcribe'}
          </Button>
        )}
        {transcription && !uploading && (
          <Button
            onClick={() => {
              navigator.clipboard.writeText(transcription);
            }}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
              },
            }}
          >
            Copy to Clipboard
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
