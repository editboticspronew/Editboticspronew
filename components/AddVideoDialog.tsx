'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  IconButton,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  LinearProgress,
  useTheme,
  useMediaQuery,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Close,
  VideoLibrary,
  Newspaper,
  ContentCut,
  Edit as EditIcon,
  RateReview,
  School,
  CloudUpload,
  SmartToy,
  ExpandMore,
} from '@mui/icons-material';
import { transcribeAudio } from '../utils/audioTranscription';
import { OPENAI_API_KEY } from '../lib/config/constants';
import { analyzeVideo, getProviderDisplayName, isProviderConfigured } from '@/lib/ai';

interface AddVideoDialogProps {
  open: boolean;
  onClose: () => void;
  onVideoUpload: (file: File, videoType: string, transcription: string, aiAnalysis?: any) => Promise<void>;
  preSelectedFile?: File | null;
}

const videoTypes = [
  { id: 'news', name: 'News', icon: <Newspaper />, color: '#3b82f6' },
  { id: 'long-short', name: 'Long→Short', icon: <ContentCut />, color: '#8b5cf6' },
  { id: 'edit', name: 'Edit', icon: <EditIcon />, color: '#ec4899' },
  { id: 'critique', name: 'Critique', icon: <RateReview />, color: '#f59e0b' },
  { id: 'training', name: 'Training', icon: <School />, color: '#10b981' },
];

export default function AddVideoDialog({ open, onClose, onVideoUpload, preSelectedFile }: AddVideoDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [step, setStep] = useState<'type' | 'upload' | 'selected' | 'uploading' | 'transcribe' | 'analyze'>('type');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(preSelectedFile || null);
  const [firebaseUrl, setFirebaseUrl] = useState<string>(''); // Firebase Storage URL
  const [storagePath, setStoragePath] = useState<string>(''); // gs:// path
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [skipAnalysis, setSkipAnalysis] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  // When preSelectedFile is provided, initialize selectedFile
  React.useEffect(() => {
    if (preSelectedFile && !selectedFile) {
      setSelectedFile(preSelectedFile);
    }
  }, [preSelectedFile, selectedFile]);

  // Reset state when dialog closes/opens
  React.useEffect(() => {
    if (!open) {
      // Don't reset immediately, wait for dialog close animation
      const timer = setTimeout(() => {
        setStep('type');
        setSelectedType('');
        if (!preSelectedFile) {
          setSelectedFile(null);
        }
        setTranscribing(false);
        setTranscription('');
        setAnalyzing(false);
        setAnalysis(null);
        setSkipAnalysis(false);
        setError('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, preSelectedFile]);

  const handleClose = () => {
    if (!transcribing && !uploading && !analyzing) {
      setStep('type');
      setSelectedType('');
      setSelectedFile(null);
      setTranscribing(false);
      setTranscription('');
      setAnalyzing(false);
      setAnalysis(null);
      setSkipAnalysis(false);
      setError('');
      onClose();
    }
  };

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    // If file is pre-selected (from drag-drop), show file details
    // Otherwise show file picker
    if (preSelectedFile) {
      setStep('selected');
    } else {
      setStep('upload');
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/mpeg', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed: MP4, MPEG, WebM, MOV');
      return;
    }

    // Validate file size (25 MB OpenAI limit)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File size exceeds 25 MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
      return;
    }

    setSelectedFile(file);
    setError('');
    // Show selected file, don't upload yet
    setStep('selected');
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;

    setError('');
    setStep('uploading');
    setUploading(true);

    try {
      // Upload to Firebase Storage
      const { uploadVideoToFirebase } = await import('@/utils/fileUpload');
      const result = await uploadVideoToFirebase(selectedFile, selectedType);
      
      setFirebaseUrl(result.url);
      setStoragePath(result.storagePath);
      setUploading(false);
      
      // Stay on uploading step to show completion message
      // User will click "Continue" to move to transcribe
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload video to Firebase');
      setUploading(false);
      setStep('selected'); // Go back to file selected view
    }
  };

  const handleTranscribe = async () => {
    if (!selectedFile) return;

    setError('');
    setTranscribing(true);

    try {
      // Get OpenAI API key from environment or user input
      const apiKey = OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured.');
      }

      // Import transcription utility
      const { transcribeAudio } = await import('@/utils/audioTranscription');

      // Use the original file from memory (already uploaded to Firebase, no need to download)
      // This avoids downloading from Firebase just to re-upload to OpenAI
      const result = await transcribeAudio(selectedFile, apiKey, {
        timestampGranularity: 'segment',
      });

      setTranscription(result.text);
      
      // After transcription, move to analyze step
      setStep('analyze');
    } catch (err: any) {
      console.error('Transcription error:', err);
      setError(err.message || 'Failed to transcribe video. Please try again.');
    } finally {
      setTranscribing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!firebaseUrl && !selectedFile) return;

    setError('');
    setAnalyzing(true);

    try {
      // Check if provider is configured
      const { configured, message } = isProviderConfigured();
      if (!configured) {
        throw new Error(message);
      }

      console.log(`Analyzing with: ${getProviderDisplayName()}`);
      
      // Use Firebase URL if available, otherwise create blob URL
      const videoUrl = firebaseUrl || URL.createObjectURL(selectedFile!);
      const videoName = selectedFile?.name || 'video.mp4';
      
      // Analyze video with AI (pass storage path for Google Cloud)
      const result = await analyzeVideo(
        videoUrl,
        videoName,
        storagePath || undefined, // Google Cloud needs gs:// path
        transcription,
        undefined // duration - could calculate from video
      );

      setAnalysis(result);
      console.log('✅ AI Analysis complete');
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze video. You can skip this step.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUploadVideo = async () => {
    // Video is already uploaded to Firebase - just save metadata
    if (!selectedFile || !selectedType) return;

    setUploading(true);
    setError('');

    try {
      // Notify parent to save metadata (video already in Firebase)
      await onVideoUpload(selectedFile, selectedType, transcription, analysis);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save video metadata');
    } finally {
      setUploading(false);
    }
  };

  const renderContent = () => {
    // Step 1: Select Video Type
    if (step === 'type') {
      return (
        <Box sx={{ py: 2 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom textAlign="center">
            What type of video are you uploading?
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
            Select the category that best describes your video
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
            {videoTypes.map((type) => (
              <Card
                key={type.id}
                sx={{
                  cursor: 'pointer',
                  border: 2,
                  borderColor: selectedType === type.id ? type.color : 'divider',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: type.color,
                    transform: 'translateY(-4px)',
                    boxShadow: 3,
                  },
                }}
                onClick={() => handleTypeSelect(type.id)}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 64,
                      height: 64,
                      borderRadius: 2,
                      bgcolor: type.color,
                      color: 'white',
                      mb: 2,
                    }}
                  >
                    {React.cloneElement(type.icon, { sx: { fontSize: 32 } })}
                  </Box>
                  <Typography variant="h6" fontWeight={700}>
                    {type.name}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      );
    }

    // Step 2: Upload Video
    if (step === 'upload') {
      const selectedTypeData = videoTypes.find((t) => t.id === selectedType);

      return (
        <Box sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1,
                bgcolor: selectedTypeData?.color,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selectedTypeData?.icon}
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Upload {selectedTypeData?.name} Video
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select a video file to upload
              </Typography>
            </Box>
          </Box>

          <Card
            sx={{
              border: 2,
              borderStyle: 'dashed',
              borderColor: 'divider',
              bgcolor: 'transparent',
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <input
                type="file"
                accept="video/mp4,video/mpeg,video/webm,video/quicktime"
                style={{ display: 'none' }}
                id="video-file-upload"
                onChange={handleFileSelect}
              />
              <label htmlFor="video-file-upload" style={{ cursor: 'pointer' }}>
                <CloudUpload sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" fontWeight={600}>
                  Click to browse or drag video here
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Supported: MP4, MPEG, WebM, MOV (max 25MB for transcription)
                </Typography>
              </label>
            </CardContent>
          </Card>

          <Alert severity="info" sx={{ mt: 2 }}>
            <strong>Note:</strong> Videos will be transcribed using OpenAI Whisper before uploading to ensure accurate metadata.
          </Alert>
        </Box>
      );
    }

    // Step 2.5: File Selected - Show details and upload button
    if (step === 'selected') {
      const selectedTypeData = videoTypes.find((t) => t.id === selectedType);

      return (
        <Box sx={{ py: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1,
                bgcolor: selectedTypeData?.color,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <VideoLibrary />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                File Selected
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ready to upload to Firebase Storage
              </Typography>
            </Box>
          </Box>

          <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <VideoLibrary sx={{ fontSize: 40, color: 'primary.main' }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {selectedFile?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedFile && `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • ${selectedTypeData?.name}`}
                </Typography>
              </Box>
            </Box>
          </Card>

          <Alert severity="info">
            Click "Upload to Firebase" to store your video in cloud storage. This allows both AI providers to access it for analysis.
          </Alert>
        </Box>
      );
    }

    // Step 3: Uploading to Firebase
    if (step === 'uploading') {
      const selectedTypeData = videoTypes.find((t) => t.id === selectedType);

      return (
        <Box sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1,
                bgcolor: selectedTypeData?.color,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CloudUpload />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Uploading to Firebase Storage
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedFile?.name}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            {uploading ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Uploading video to cloud storage...
                  </Typography>
                </Box>
                <LinearProgress />
              </>
            ) : (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  ✅ Upload Complete!
                </Typography>
                <Typography variant="body2">
                  Your video has been successfully uploaded to Firebase Storage.
                </Typography>
              </Alert>
            )}
          </Box>

          {!uploading && (
            <Alert severity="info">
              Click "Continue" to proceed with transcription and AI analysis.
            </Alert>
          )}
        </Box>
      );
    }

    // Step 3: Transcribe
    if (step === 'transcribe') {
      const selectedTypeData = videoTypes.find((t) => t.id === selectedType);

      return (
        <Box sx={{ py: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1,
                bgcolor: selectedTypeData?.color,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <VideoLibrary />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {selectedFile?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedFile && `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • ${selectedTypeData?.name}`}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {!transcription && (
            <>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Transcribe Video
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Click the button below to transcribe your video using AI
              </Typography>

              {transcribing && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Transcribing video with OpenAI Whisper...
                    </Typography>
                  </Box>
                  <LinearProgress />
                </Box>
              )}

              <Alert severity="info">
                The transcription will be saved as metadata and used for better video organization and search.
              </Alert>
            </>
          )}

          {transcription && (
            <>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Transcription Complete ✓
              </Typography>
              <Card
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
              </Card>

              {uploading && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Uploading video to Firebase...
                    </Typography>
                  </Box>
                  <LinearProgress />
                </Box>
              )}

              <Alert severity="success">
                Video is ready to upload! The transcription will be saved with your video.
              </Alert>
            </>
          )}
        </Box>
      );
    }

    // Step 4: AI Analysis
    if (step === 'analyze') {
      const selectedTypeData = videoTypes.find((t) => t.id === selectedType);

      return (
        <Box sx={{ py: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1,
                bgcolor: selectedTypeData?.color,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SmartToy />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                AI Video Analysis
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Get intelligent editing suggestions
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {!analysis && !skipAnalysis && (
            <>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Analyze Video with AI
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Use {getProviderDisplayName()} to get intelligent editing recommendations
              </Typography>
              
              {!transcription && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <strong>Transcript required:</strong> AI analysis uses the transcript to understand your video content. 
                  Without it, the AI cannot provide accurate suggestions.
                </Alert>
              )}

              {analyzing && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Analyzing video with AI...
                    </Typography>
                  </Box>
                  <LinearProgress />
                </Box>
              )}

              <Alert severity="info" sx={{ mb: 2 }}>
                <strong>What you'll get:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  <li>Scene detection and timestamps</li>
                  <li>Suggested cuts and edits</li>
                  <li>Text overlay recommendations</li>
                  <li>Key moments and highlights</li>
                </ul>
              </Alert>
            </>
          )}

          {analysis && (
            <>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                AI Analysis Complete ✓
              </Typography>
              
              <Card
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 2,
                  bgcolor: 'background.default',
                }}
              >
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  <Chip label={`${analysis.analysis.scenes.length} Scenes`} size="small" color="primary" />
                  <Chip label={`${analysis.analysis.keyMoments.length} Key Moments`} size="small" color="success" />
                  {analysis.analysis.transcription && (
                    <Chip label="With Transcript" size="small" color="info" />
                  )}
                </Box>
                
                <Divider sx={{ my: 2 }} />

                {/* Detailed Analysis Results */}
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {/* Video Summary - NEW */}
                  {analysis?.analysis?.summary && (
                    <Accordion defaultExpanded>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          📋 Video Summary
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {analysis.analysis.summary.overview && (
                            <Box>
                              <Typography variant="caption" fontWeight={600} color="primary" sx={{ mb: 0.5 }}>
                                OVERVIEW
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {analysis.analysis.summary.overview}
                              </Typography>
                            </Box>
                          )}
                          
                          {analysis.analysis.summary.mainTopic && (
                            <Box>
                              <Typography variant="caption" fontWeight={600} color="primary" sx={{ mb: 0.5 }}>
                                MAIN TOPIC
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {analysis.analysis.summary.mainTopic}
                              </Typography>
                            </Box>
                          )}
                          
                          {analysis.analysis.summary.speakers && (
                            <Box>
                              <Typography variant="caption" fontWeight={600} color="primary" sx={{ mb: 0.5 }}>
                                SPEAKERS/PARTICIPANTS
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {analysis.analysis.summary.speakers}
                              </Typography>
                            </Box>
                          )}
                          
                          {analysis.analysis.summary.keyPoints && analysis.analysis.summary.keyPoints.length > 0 && (
                            <Box>
                              <Typography variant="caption" fontWeight={600} color="primary" sx={{ mb: 0.5 }}>
                                KEY POINTS
                              </Typography>
                              <List dense sx={{ pt: 0 }}>
                                {analysis.analysis.summary.keyPoints.map((point, i) => (
                                  <ListItem key={i} sx={{ py: 0.25, px: 0 }}>
                                    <ListItemText 
                                      primary={`${i + 1}. ${point}`}
                                      primaryTypographyProps={{ 
                                        variant: 'body2',
                                        color: 'text.secondary' 
                                      }}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          )}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {/* Scenes */}
                  {analysis.analysis.scenes.length > 0 && (
                    <Accordion defaultExpanded>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          📹 Detected Scenes ({analysis.analysis.scenes.length})
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <List dense>
                          {analysis.analysis.scenes.map((scene: any, idx: number) => (
                            <ListItem key={idx} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                              <ListItemText
                                primary={`Scene ${idx + 1}: ${scene.start}s - ${scene.end}s`}
                                secondary={scene.description}
                                primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                                secondaryTypographyProps={{ fontSize: '0.813rem' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {/* Key Moments */}
                  {analysis.analysis.keyMoments.length > 0 && (
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          ⭐ Key Moments ({analysis.analysis.keyMoments.length})
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <List dense>
                          {analysis.analysis.keyMoments.map((moment: any, idx: number) => (
                            <ListItem key={idx} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                              <ListItemText
                                primary={`${moment.time}s`}
                                secondary={moment.reason}
                                primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem', color: 'success.main' }}
                                secondaryTypographyProps={{ fontSize: '0.813rem' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {/* AI Recommendations - Rendered as Markdown */}
                  {analysis.recommendations && (
                    <Accordion defaultExpanded>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          💡 AI Editing Recommendations
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box 
                          sx={{ 
                            '& h1': { fontSize: '1.25rem', fontWeight: 700, mb: 1, mt: 2 },
                            '& h2': { fontSize: '1rem', fontWeight: 600, mb: 1, mt: 2 },
                            '& h3': { fontSize: '0.875rem', fontWeight: 600, mb: 0.5, mt: 1 },
                            '& p': { fontSize: '0.813rem', mb: 1 },
                            '& ul, & ol': { fontSize: '0.813rem', pl: 2.5, mb: 1 },
                            '& li': { mb: 0.5 },
                            '& strong': { fontWeight: 600 },
                            '& code': { 
                              bgcolor: 'grey.100', 
                              px: 0.5, 
                              py: 0.25, 
                              borderRadius: 0.5,
                              fontSize: '0.75rem'
                            }
                          }}
                        >
                          {/* Render markdown content */}
                          {analysis.recommendations.split('\n').map((line: string, idx: number) => {
                            // Handle headers
                            if (line.startsWith('# ')) {
                              return <Typography key={idx} variant="h1" sx={{ fontSize: '1.25rem', fontWeight: 700, mb: 1, mt: 2 }}>{line.replace('# ', '')}</Typography>;
                            }
                            if (line.startsWith('## ')) {
                              return <Typography key={idx} variant="h2" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1, mt: 2 }}>{line.replace('## ', '')}</Typography>;
                            }
                            // Handle list items
                            if (line.match(/^\d+\. /)) {
                              return <Typography key={idx} component="li" sx={{ fontSize: '0.813rem', mb: 0.5, ml: 2 }}>{line.replace(/^\d+\. /, '')}</Typography>;
                            }
                            // Handle bold text with timestamps
                            if (line.includes('**')) {
                              const parts = line.split('**');
                              return (
                                <Typography key={idx} sx={{ fontSize: '0.813rem', mb: 0.5 }}>
                                  {parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
                                </Typography>
                              );
                            }
                            // Regular text
                            if (line.trim()) {
                              return <Typography key={idx} sx={{ fontSize: '0.813rem', mb: 0.5 }}>{line}</Typography>;
                            }
                            return <br key={idx} />;
                          })}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  )}
                  
                  {/* Transcript that was analyzed */}
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        📄 Transcript Analyzed
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Card
                        variant="outlined"
                        sx={{
                          p: 2,
                          maxHeight: 300,
                          overflow: 'auto',
                          bgcolor: 'background.default',
                        }}
                      >
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            whiteSpace: 'pre-wrap', 
                            fontFamily: 'monospace', 
                            fontSize: '0.75rem',
                            color: 'text.secondary' 
                          }}
                        >
                          {transcription}
                        </Typography>
                      </Card>
                      <Alert severity="info" sx={{ mt: 2 }}>
                        <strong>Note:</strong> AI analysis is based only on this transcript. 
                        The AI model (gpt-4o-mini) cannot see video content, only what is said.
                      </Alert>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              </Card>

              {uploading && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Uploading video to Firebase...
                    </Typography>
                  </Box>
                  <LinearProgress />
                </Box>
              )}

              <Alert severity="success">
                Video is ready to upload with AI analysis!
              </Alert>
            </>
          )}

          {skipAnalysis && (
            <>
              <Alert severity="info">
                Skipping AI analysis. You can analyze the video later from the files page.
              </Alert>

              {uploading && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Uploading video to Firebase...
                    </Typography>
                  </Box>
                  <LinearProgress />
                </Box>
              )}
            </>
          )}
        </Box>
      );
    }
  };

  const renderActions = () => {
    if (step === 'type') {
      return (
        <Button onClick={handleClose} variant="outlined">
          Cancel
        </Button>
      );
    }

    if (step === 'upload') {
      return (
        <>
          <Button onClick={() => setStep('type')} variant="outlined">
            Back
          </Button>
        </>
      );
    }

    if (step === 'selected') {
      return (
        <>
          <Button
            onClick={() => {
              setStep('upload');
              setSelectedFile(null);
            }}
            variant="outlined"
          >
            Back
          </Button>
          <Button
            onClick={handleStartUpload}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
              },
            }}
          >
            Upload to Firebase
          </Button>
        </>
      );
    }

    if (step === 'uploading') {
      return (
        <>
          {!uploading && (
            <Button
              onClick={() => setStep('transcribe')}
              variant="contained"
              sx={{
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
                },
              }}
            >
              Continue
            </Button>
          )}
        </>
      );
    }

    if (step === 'transcribe') {
      return (
        <>
          <Button
            onClick={() => {
              setStep('upload');
              setSelectedFile(null);
              setTranscription('');
            }}
            variant="outlined"
            disabled={transcribing || uploading}
          >
            Back
          </Button>
          <Button
            onClick={handleTranscribe}
            variant="contained"
            disabled={transcribing}
            sx={{
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
              },
            }}
          >
            {transcribing ? 'Transcribing...' : 'Transcribe Video'}
          </Button>
        </>
      );
    }

    if (step === 'analyze') {
      return (
        <>
          {!analysis && !skipAnalysis && !analyzing && (
            <Button
              onClick={() => {
                setSkipAnalysis(true);
              }}
              variant="outlined"
            >
              Skip Analysis
            </Button>
          )}
          {!analysis && !skipAnalysis ? (
            <Button
              onClick={handleAnalyze}
              variant="contained"
              disabled={analyzing || !transcription}
              sx={{
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
                },
              }}
            >
              {analyzing ? 'Analyzing...' : 'Analyze with AI'}
            </Button>
          ) : (
            <Button
              onClick={handleUploadVideo}
              variant="contained"
              disabled={uploading}
              sx={{
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
                },
              }}
            >
              {uploading ? 'Uploading...' : 'Upload Video'}
            </Button>
          )}
        </>
      );
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2,
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VideoLibrary color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Add Video
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={transcribing || uploading}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent>
        {renderContent()}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2, gap: 1 }}>
        {renderActions()}
      </DialogActions>
    </Dialog>
  );
}
