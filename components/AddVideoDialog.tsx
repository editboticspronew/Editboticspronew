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
  Checkbox,
  FormControlLabel,
  FormGroup,
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
  AutoFixHigh,
  Download,
  PlayArrow,
  Visibility,
  Code,
} from '@mui/icons-material';
import { TranscriptSegment } from '../utils/audioTranscription';
import { analyzeVideo, getProviderDisplayName, isProviderConfigured } from '@/lib/ai';
import { useAppDispatch } from '@/store/hooks';
import { saveProjectFileMetadata, updateProjectFileMetadata } from '@/store/filesSlice';

interface AddVideoDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  userId: string;
  onVideoUpload?: (
    fileMetadata: {
      name: string;
      size: number;
      url: string;
      storagePath: string;
    },
    videoType: string,
    transcription: string,
    aiAnalysis?: any
  ) => Promise<void>;
  preSelectedFile?: File | null;
}

const videoTypes = [
  { id: 'news', name: 'News', icon: <Newspaper />, color: '#3b82f6' },
  { id: 'long-short', name: 'Longâ†’Short', icon: <ContentCut />, color: '#6366f1' },
  { id: 'edit', name: 'Edit', icon: <EditIcon />, color: '#14b8a6' },
  { id: 'critique', name: 'Critique', icon: <RateReview />, color: '#f59e0b' },
  { id: 'training', name: 'Training', icon: <School />, color: '#10b981' },
];

// Google Cloud Video Intelligence Available Features
const VIDEO_ANALYSIS_FEATURES = [
  { id: 'LABEL_DETECTION', name: 'Label Detection', description: 'Detect objects, locations, activities, animal species, products' },
  { id: 'SHOT_CHANGE_DETECTION', name: 'Shot Change Detection', description: 'Detect scene changes and breaks between shots' },
  { id: 'EXPLICIT_CONTENT_DETECTION', name: 'Explicit Content Detection', description: 'Detect adult content in videos' },
  { id: 'FACE_DETECTION', name: 'Face Detection', description: 'Detect and track faces in the video' },
  { id: 'SPEECH_TRANSCRIPTION', name: 'Speech Transcription', description: 'Transcribe speech to text (Google Cloud)' },
  { id: 'TEXT_DETECTION', name: 'Text Detection', description: 'Detect and extract text appearing in the video' },
  { id: 'OBJECT_TRACKING', name: 'Object Tracking', description: 'Detect and track objects throughout the video (âš ï¸ Frame-heavy, slower)', isFrameHeavy: true },
  { id: 'LOGO_RECOGNITION', name: 'Logo Recognition', description: 'Detect and recognize brand logos (âš ï¸ Frame-heavy)', isFrameHeavy: true },
  { id: 'PERSON_DETECTION', name: 'Person Detection', description: 'Detect and track people in the video (âš ï¸ Frame-heavy, slower)', isFrameHeavy: true },
];

// Default features - exclude frame-heavy features that cause bloated responses
const DEFAULT_FEATURES = VIDEO_ANALYSIS_FEATURES
  .filter(f => !f.isFrameHeavy)
  .map(f => f.id);

// Format seconds to MM:SS or HH:MM:SS
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AddVideoDialog({ open, onClose, projectId, userId, onVideoUpload, preSelectedFile }: AddVideoDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<'type' | 'upload' | 'selected' | 'uploading' | 'transcribe' | 'analyze' | 'review-prompt'>('type');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(preSelectedFile || null);
  const [firebaseUrl, setFirebaseUrl] = useState<string>(''); // Firebase Storage URL
  const [storagePath, setStoragePath] = useState<string>(''); // plain path for Firebase ops
  const [gsPath, setGsPath] = useState<string>(''); // gs:// path for Google Cloud
  const [savedDocId, setSavedDocId] = useState<string>(''); // Firestore document ID for incremental saves
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [transcriptionSegments, setTranscriptionSegments] = useState<TranscriptSegment[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [skipAnalysis, setSkipAnalysis] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Video analysis features (frame-heavy features unchecked by default)
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(DEFAULT_FEATURES);

  // Auto-edit state
  const [autoEditing, setAutoEditing] = useState(false);
  const [autoEditProgress, setAutoEditProgress] = useState('');
  const [autoEditClips, setAutoEditClips] = useState<any[]>([]);
  const [autoEditStats, setAutoEditStats] = useState<any>(null);
  const [mergedVideo, setMergedVideo] = useState<{ blob: Blob; objectUrl: string; fileSize: number } | null>(null);
  const [autoEditError, setAutoEditError] = useState('');

  // Prompt preview state
  const [promptPreview, setPromptPreview] = useState<{
    systemPrompt: string;
    userPrompt: string;
    estimatedTokens: number;
    compressionLevel: number;
    compressionNote: string;
    programType: string;
    segmentCount: number;
    twoPassUsed: boolean;
  } | null>(null);
  const [loadingPromptPreview, setLoadingPromptPreview] = useState(false);

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
        setTranscriptionSegments([]);
        setAnalyzing(false);
        setAnalysis(null);
        setSkipAnalysis(false);
        setError('');
        setFirebaseUrl('');
        setStoragePath('');
        setGsPath('');
        setSavedDocId('');
        setSelectedFeatures(DEFAULT_FEATURES);
        setAutoEditing(false);
        setAutoEditProgress('');
        setAutoEditClips([]);
        setAutoEditStats(null);
        setAutoEditError('');
        setPromptPreview(null);
        setLoadingPromptPreview(false);
        if (mergedVideo) {
          try { URL.revokeObjectURL(mergedVideo.objectUrl); } catch { /* ignore */ }
        }
        setMergedVideo(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, preSelectedFile]);

  const handleClose = () => {
    if (!transcribing && !uploading && !analyzing && !autoEditing) {
      setStep('type');
      setSelectedType('');
      setSelectedFile(null);
      setTranscribing(false);
      setTranscription('');
      setAnalyzing(false);
      setAnalysis(null);
      setSkipAnalysis(false);
      setError('');
      setFirebaseUrl('');
      setStoragePath('');
      setGsPath('');
      setSavedDocId('');
      setSelectedFeatures(DEFAULT_FEATURES);
      setAutoEditing(false);
      setAutoEditProgress('');
      setAutoEditClips([]);
      setAutoEditStats(null);
      setAutoEditError('');
      if (mergedVideo) {
        try { URL.revokeObjectURL(mergedVideo.objectUrl); } catch { /* ignore */ }
      }
      setMergedVideo(null);
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
      setGsPath(result.gsPath);
      setUploading(false);
      
      // Save initial metadata to database right after upload
      try {
        const savedFile = await dispatch(
          saveProjectFileMetadata({
            projectId,
            userId,
            name: selectedFile.name,
            type: 'video',
            size: selectedFile.size,
            url: result.url,
            storagePath: result.storagePath,
            videoType: selectedType,
          })
        ).unwrap();
        setSavedDocId(savedFile.id);
        console.log('âœ… Initial file metadata saved to database:', savedFile.id);
      } catch (dbErr: any) {
        console.error('âš ï¸ Failed to save initial metadata:', dbErr);
        // Don't block the flow - file is uploaded, metadata save can be retried
      }
      
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
    if (!storagePath) {
      setError('Video must be uploaded before transcription. Please upload first.');
      return;
    }

    setError('');
    setTranscribing(true);

    try {
      // Use Google Cloud Video Intelligence for transcription
      // Works directly on the video in GCS â€” no audio extraction needed
      const { transcribeVideo } = await import('@/utils/audioTranscription');

      console.log('ðŸŽ¤ Transcribing video via Google Cloud:', storagePath);
      
      const result = await transcribeVideo(storagePath);

      setTranscription(result.text);
      setTranscriptionSegments(result.segments || []);
      
      // Save transcription to database incrementally (with timestamps)
      if (savedDocId) {
        try {
          await dispatch(
            updateProjectFileMetadata({
              fileId: savedDocId,
              updates: {
                transcription: result.text,
                transcriptionSegments: result.segments || [],
              },
            })
          ).unwrap();
          console.log('âœ… Transcription saved to database');
        } catch (dbErr: any) {
          console.error('âš ï¸ Failed to save transcription to database:', dbErr);
          // Don't block the flow
        }
      }
      
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
        gsPath || undefined, // Google Cloud needs gs:// path
        transcription,
        undefined, // duration - could calculate from video
        selectedFeatures // Pass selected features to API
      );

      setAnalysis(result);
      console.log('âœ… AI Analysis complete');
      
      // Save AI analysis to database incrementally
      if (savedDocId) {
        try {
          await dispatch(
            updateProjectFileMetadata({
              fileId: savedDocId,
              updates: { aiAnalysis: result },
            })
          ).unwrap();
          console.log('âœ… AI analysis saved to database');
        } catch (dbErr: any) {
          console.error('âš ï¸ Failed to save AI analysis to database:', dbErr);
        }
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze video. You can skip this step.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePreviewPrompt = async () => {
    if (!analysis) return;

    setLoadingPromptPreview(true);
    setError('');

    try {
      const response = await fetch('/api/auto-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: analysis.analysis,
          transcriptionSegments,
          videoType: selectedType,
          recommendations: analysis.recommendations,
          previewOnly: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to build prompt preview');
      }

      setPromptPreview({
        systemPrompt: data.systemPrompt,
        userPrompt: data.userPrompt,
        estimatedTokens: data.estimatedTokens,
        compressionLevel: data.compressionLevel,
        compressionNote: data.compressionNote,
        programType: data.programType,
        segmentCount: data.segmentCount,
        twoPassUsed: data.twoPassUsed,
      });

      setStep('review-prompt');
    } catch (err: any) {
      console.error('Prompt preview error:', err);
      setError(err.message || 'Failed to build prompt preview');
    } finally {
      setLoadingPromptPreview(false);
    }
  };

  const handleAutoEdit = async () => {
    if (!analysis || !firebaseUrl) return;

    setAutoEditing(true);
    setAutoEditProgress('Generating edit commands with AI...');
    setAutoEditError('');
    setAutoEditClips([]);
    setAutoEditStats(null);
    if (mergedVideo) {
      try { URL.revokeObjectURL(mergedVideo.objectUrl); } catch { /* ignore */ }
    }
    setMergedVideo(null);

    try {
      // Step 1: Call auto-edit API to get clip definitions
      const response = await fetch('/api/auto-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: analysis.analysis,
          transcriptionSegments,
          videoType: selectedType,
          recommendations: analysis.recommendations,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate edit commands');
      }

      if (!data.clips || data.clips.length === 0) {
        setAutoEditError(data.message || 'AI could not determine edit points. The video may not need editing.');
        setAutoEditing(false);
        setAutoEditProgress('');
        return;
      }

      setAutoEditClips(data.clips);
      setAutoEditStats(data.stats);
      setAutoEditProgress(`Found ${data.clips.length} clip(s). Loading FFmpeg...`);

      // Step 2: Clip the video using FFmpeg WASM
      const { clipVideo } = await import('@/lib/video/clipVideo');
      const clipResults = await clipVideo(
        firebaseUrl,
        data.clips,
        (p) => setAutoEditProgress(p.message)
      );

      if (clipResults.length === 0) {
        throw new Error('Failed to clip video. Please try again.');
      }

      // Step 3: Merge all clips into a single final video
      setAutoEditProgress(`Merging ${clipResults.length} clips into final video...`);
      const { mergeClips } = await import('@/lib/video/clipVideo');
      const merged = await mergeClips(
        clipResults,
        (p: any) => setAutoEditProgress(p.message),
        { transition: 'fade', transitionDuration: 0.5 }
      );

      // Revoke individual clip URLs to free memory
      clipResults.forEach((clip) => {
        try { URL.revokeObjectURL(clip.objectUrl); } catch { /* ignore */ }
      });

      setMergedVideo(merged);
      setAutoEditProgress('');

      // Save auto-edit metadata to database
      if (savedDocId) {
        try {
          await dispatch(
            updateProjectFileMetadata({
              fileId: savedDocId,
              updates: {
                autoEdit: {
                  clips: data.clips,
                  stats: data.stats,
                  generatedAt: new Date().toISOString(),
                },
              },
            })
          ).unwrap();
          console.log('âœ… Auto-edit metadata saved to database');
        } catch (dbErr: any) {
          console.error('âš ï¸ Failed to save auto-edit metadata:', dbErr);
        }
      }
    } catch (err: any) {
      console.error('Auto-edit error:', err);
      setAutoEditError(err.message || 'Failed to generate auto-edit. Please try again.');
      setAutoEditProgress('');
    } finally {
      setAutoEditing(false);
    }
  };

  const handleDownloadAutoEdit = () => {
    if (!mergedVideo) return;
    const a = document.createElement('a');
    a.href = mergedVideo.objectUrl;
    a.download = `${selectedFile?.name?.replace(/\.[^.]+$/, '') || 'video'}_auto_edited.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleUploadVideo = async () => {
    // Video and transcription are already saved incrementally
    // This final step saves any remaining data (clips, analysis if not saved yet)
    if (!selectedFile || !selectedType || !firebaseUrl || !storagePath) {
      setError('Video not uploaded. Please start over.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Also notify parent if callback provided (backwards compatibility)
      if (onVideoUpload) {
        await onVideoUpload(
          {
            name: selectedFile.name,
            size: selectedFile.size,
            url: firebaseUrl,
            storagePath: storagePath,
          },
          selectedType,
          transcription,
          analysis
        );
      }
      
      // Reset state before closing
      setUploading(false);
      setStep('type');
      setSelectedType('');
      setSelectedFile(null);
      setFirebaseUrl('');
      setStoragePath('');
      setGsPath('');
      setSavedDocId('');
      setTranscribing(false);
      setTranscription('');
      setTranscriptionSegments([]);
      setAnalyzing(false);
      setAnalysis(null);
      setSkipAnalysis(false);
      setError('');
      setSelectedFeatures(DEFAULT_FEATURES);
      
      // Close the modal
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save video metadata');
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
                  Supported: MP4, MPEG, WebM, MOV
                </Typography>
              </label>
            </CardContent>
          </Card>

          <Alert severity="info" sx={{ mt: 2 }}>
            <strong>Note:</strong> Videos will be transcribed using Google Cloud before uploading to ensure accurate metadata.
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
                  {selectedFile && `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB â€¢ ${selectedTypeData?.name}`}
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
                  âœ… Upload Complete!
                </Typography>
                <Typography variant="body2">
                  Your video has been uploaded to Firebase Storage{savedDocId ? ' and saved to the database' : ''}.
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
                {selectedFile && `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB â€¢ ${selectedTypeData?.name}`}
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
                      Transcribing video with Google Cloud... This may take 1-3 minutes.
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
                Transcription Complete âœ“
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
                {transcriptionSegments.length > 0 ? (
                  <Box component="div">
                    {transcriptionSegments.map((seg, idx) => (
                      <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'primary.main',
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            minWidth: 80,
                            flexShrink: 0,
                            pt: 0.25,
                          }}
                        >
                          {formatTimestamp(seg.start)}
                        </Typography>
                        <Typography variant="body2">
                          {seg.text}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {transcription}
                  </Typography>
                )}
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

              {/* Feature Selection Checkboxes */}
              {!analyzing && (
                <Card variant="outlined" sx={{ mb: 2, p: 2, bgcolor: 'background.default' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Select Analysis Features
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button 
                        size="small" 
                        onClick={() => setSelectedFeatures(VIDEO_ANALYSIS_FEATURES.map(f => f.id))}
                        disabled={selectedFeatures.length === VIDEO_ANALYSIS_FEATURES.length}
                      >
                        Select All
                      </Button>
                      <Button 
                        size="small" 
                        onClick={() => setSelectedFeatures([])}
                        disabled={selectedFeatures.length === 0}
                      >
                        Clear All
                      </Button>
                    </Box>
                  </Box>
                  <FormGroup>
                    {VIDEO_ANALYSIS_FEATURES.map((feature) => (
                      <FormControlLabel
                        key={feature.id}
                        control={
                          <Checkbox
                            checked={selectedFeatures.includes(feature.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedFeatures([...selectedFeatures, feature.id]);
                              } else {
                                setSelectedFeatures(selectedFeatures.filter(f => f !== feature.id));
                              }
                            }}
                            size="small"
                          />
                        }
                        label={
                          <Box>
                            <Typography 
                              variant="body2" 
                              fontWeight={500}
                              color={feature.isFrameHeavy ? 'warning.main' : 'text.primary'}
                            >
                              {feature.name}
                            </Typography>
                            <Typography 
                              variant="caption" 
                              color={feature.isFrameHeavy ? 'warning.light' : 'text.secondary'}
                            >
                              {feature.description}
                            </Typography>
                          </Box>
                        }
                        sx={{ 
                          mb: 1,
                          ...(feature.isFrameHeavy && {
                            bgcolor: 'rgba(255, 152, 0, 0.05)',
                            borderRadius: 1,
                            px: 1,
                            py: 0.5,
                          })
                        }}
                      />
                    ))}
                  </FormGroup>
                  {selectedFeatures.length === 0 && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      Please select at least one feature to analyze
                    </Alert>
                  )}
                  {selectedFeatures.some(f => VIDEO_ANALYSIS_FEATURES.find(vf => vf.id === f)?.isFrameHeavy) && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      <strong>Frame-heavy features selected:</strong> These features analyze every frame (10 fps) and may take longer and produce larger responses. Our backend optimizes by sampling key frames.
                    </Alert>
                  )}
                </Card>
              )}

              {analyzing && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Analyzing video with AI ({selectedFeatures.length} features)...
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
                AI Analysis Complete âœ“
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
                          ðŸ“‹ Video Summary
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
                                {analysis.analysis.summary.keyPoints.map((point: string, i: number) => (
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
                          ðŸ“¹ Detected Scenes ({analysis.analysis.scenes.length})
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
                          â­ Key Moments ({analysis.analysis.keyMoments.length})
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
                          ðŸ’¡ AI Editing Recommendations
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
                        ðŸ“„ Transcript Analyzed
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
                        {transcriptionSegments.length > 0 ? (
                          <Box>
                            {transcriptionSegments.map((seg, idx) => (
                              <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'primary.main',
                                    fontFamily: 'monospace',
                                    fontWeight: 600,
                                    minWidth: 60,
                                    flexShrink: 0,
                                    fontSize: '0.7rem',
                                    pt: 0.25,
                                  }}
                                >
                                  {formatTimestamp(seg.start)}
                                </Typography>
                                <Typography 
                                  variant="body2" 
                                  sx={{ fontSize: '0.75rem', color: 'text.secondary' }}
                                >
                                  {seg.text}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        ) : (
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
                        )}
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

              {/* Next Step: Review AI Prompt & Generate */}
              <Divider sx={{ my: 2 }} />
              
              <Card
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 2,
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(236,72,153,0.05) 100%)',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Visibility color="primary" />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Review AI Prompt & Generate Video
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Review the full AI prompt before generating your edited video
                    </Typography>
                  </Box>
                </Box>

                {loadingPromptPreview && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Building prompt preview...
                    </Typography>
                  </Box>
                )}

                <Button
                  variant="contained"
                  startIcon={<Visibility />}
                  onClick={handlePreviewPrompt}
                  fullWidth
                  disabled={loadingPromptPreview || !transcriptionSegments || transcriptionSegments.length === 0}
                  sx={{
                    background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                    },
                  }}
                >
                  {loadingPromptPreview ? 'Loading...' : 'Review AI Prompt \u2192'}
                </Button>

                {(!transcriptionSegments || transcriptionSegments.length === 0) && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                    Transcript with timestamps is required for auto-edit
                  </Typography>
                )}
              </Card>
            </>
          )}

          {skipAnalysis && (
            <>
              <Alert severity="success" sx={{ mb: 1 }}>
                Your video and transcription have already been saved to the database.
              </Alert>
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

    // Step 5: Review AI Prompt & Generate
    if (step === 'review-prompt') {
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
                bgcolor: '#6366f1',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Code />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Review AI Prompt
              </Typography>
              <Typography variant="caption" color="text.secondary">
                This is the exact prompt that will be sent to the AI model
              </Typography>
            </Box>
          </Box>

          {promptPreview && (
            <>
              {/* Stats chips */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip
                  size="small"
                  label={`Program: ${promptPreview.programType}`}
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`~${promptPreview.estimatedTokens.toLocaleString()} tokens`}
                  color={promptPreview.estimatedTokens > 100000 ? 'error' : promptPreview.estimatedTokens > 50000 ? 'warning' : 'success'}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`${promptPreview.segmentCount} segments`}
                  variant="outlined"
                />
                {promptPreview.compressionLevel > 0 && (
                  <Chip
                    size="small"
                    label={`Compression: L${promptPreview.compressionLevel}`}
                    color="warning"
                    variant="outlined"
                  />
                )}
                {promptPreview.twoPassUsed && (
                  <Chip
                    size="small"
                    label="Two-pass mode"
                    color="info"
                    variant="outlined"
                  />
                )}
              </Box>

              {promptPreview.compressionNote && (
                <Alert severity="info" sx={{ mb: 2, fontSize: '0.75rem' }}>
                  {promptPreview.compressionNote}
                </Alert>
              )}

              {/* System Prompt */}
              <Accordion sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    System Prompt
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'grey.900',
                      color: 'grey.100',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {promptPreview.systemPrompt}
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* User Prompt (the big one) */}
              <Accordion defaultExpanded sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    User Prompt (sent to AI)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'grey.900',
                      color: 'grey.100',
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: 400,
                      overflow: 'auto',
                    }}
                  >
                    {promptPreview.userPrompt}
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* Auto-Edit Section */}
              <Divider sx={{ my: 2 }} />
              
              <Card
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 2,
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(236,72,153,0.05) 100%)',
                  borderColor: mergedVideo ? 'success.main' : 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <AutoFixHigh color={mergedVideo ? 'success' : 'primary'} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {mergedVideo ? 'Auto-Edited Video Ready' : 'Generate Final Video'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {mergedVideo
                        ? 'Your AI-edited video is ready for preview and download'
                        : 'Send the prompt above to generate your edited video'}
                    </Typography>
                  </Box>
                </Box>

                {/* Auto-edit progress */}
                {autoEditing && (
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">
                        {autoEditProgress || 'Processing...'}
                      </Typography>
                    </Box>
                    <LinearProgress />
                  </Box>
                )}

                {/* Auto-edit error */}
                {autoEditError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {autoEditError}
                  </Alert>
                )}

                {/* Stats */}
                {autoEditStats && !mergedVideo && !autoEditing && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    AI identified {autoEditStats.clipsCount} segments to keep 
                    ({autoEditStats.keepPercent}% of original). Processing...
                  </Alert>
                )}

                {/* Final merged video */}
                {mergedVideo && (
                  <Box sx={{ mb: 2 }}>
                    {/* Video preview */}
                    <Box
                      sx={{
                        position: 'relative',
                        width: '100%',
                        borderRadius: 2,
                        overflow: 'hidden',
                        bgcolor: 'black',
                        mb: 1.5,
                      }}
                    >
                      <video
                        src={mergedVideo.objectUrl}
                        controls
                        style={{ width: '100%', display: 'block', maxHeight: 300 }}
                      />
                    </Box>

                    {/* Stats row */}
                    {autoEditStats && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                        <Chip
                          size="small"
                          label={`${autoEditStats.clipsCount} clips`}
                          color="primary"
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`${autoEditStats.editedDuration?.toFixed(1) || '?'}s edited`}
                          color="success"
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`${autoEditStats.keepPercent}% kept`}
                          color="info"
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`${(mergedVideo.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                          variant="outlined"
                        />
                        {autoEditStats.highlightCount > 0 && (
                          <Chip
                            size="small"
                            label={`${autoEditStats.highlightCount} highlights`}
                            color="warning"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    )}

                    {/* Edit clips breakdown */}
                    {autoEditClips.length > 0 && (
                      <Accordion sx={{ mb: 1.5 }}>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Typography variant="caption" fontWeight={600}>
                            Edit Breakdown ({autoEditClips.length} segments)
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ maxHeight: 200, overflow: 'auto' }}>
                          {autoEditClips.map((clip: any, idx: number) => (
                            <Box
                              key={idx}
                              sx={{
                                display: 'flex',
                                gap: 1,
                                mb: 0.75,
                                alignItems: 'flex-start',
                              }}
                            >
                              <Chip
                                size="small"
                                label={`${formatTimestamp(clip.start)}\u2013${formatTimestamp(clip.end)}`}
                                color={clip.type === 'highlight' ? 'warning' : 'default'}
                                variant="outlined"
                                sx={{ flexShrink: 0, fontFamily: 'monospace', fontSize: '0.7rem' }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {clip.reason}
                              </Typography>
                            </Box>
                          ))}
                        </AccordionDetails>
                      </Accordion>
                    )}

                    {/* Download button */}
                    <Button
                      variant="contained"
                      startIcon={<Download />}
                      onClick={handleDownloadAutoEdit}
                      fullWidth
                      sx={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        },
                      }}
                    >
                      Download Auto-Edited Video ({(mergedVideo.fileSize / (1024 * 1024)).toFixed(1)} MB)
                    </Button>
                  </Box>
                )}

                {/* Generate button (when no merged video yet) */}
                {!mergedVideo && !autoEditing && (
                  <Button
                    variant="contained"
                    startIcon={<AutoFixHigh />}
                    onClick={handleAutoEdit}
                    fullWidth
                    sx={{
                      background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                      },
                    }}
                  >
                    Generate Final Video with AI Edits
                  </Button>
                )}

                {/* Regenerate button (when merged video exists) */}
                {mergedVideo && (
                  <Button
                    variant="outlined"
                    startIcon={<AutoFixHigh />}
                    onClick={handleAutoEdit}
                    fullWidth
                    sx={{ mt: 1 }}
                  >
                    Regenerate Auto-Edit
                  </Button>
                )}
              </Card>
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
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
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
                background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
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
              setTranscriptionSegments([]);
            }}
            variant="outlined"
            disabled={transcribing || uploading || autoEditing}
          >
            Back
          </Button>
          <Button
            onClick={handleTranscribe}
            variant="contained"
            disabled={transcribing}
            sx={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
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
                // Video and transcription are already saved - can close directly
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
              disabled={analyzing || !transcription || selectedFeatures.length === 0}
              sx={{
                background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                },
              }}
            >
              {analyzing ? 'Analyzing...' : 'Analyze with AI'}
            </Button>
          ) : (
            <Button
              onClick={handleUploadVideo}
              variant="contained"
              disabled={uploading || autoEditing}
              sx={{
                background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                },
              }}
            >
              {uploading ? 'Saving...' : (savedDocId ? 'Finish & Close' : 'Finish')}
            </Button>
          )}
        </>
      );
    }

    if (step === 'review-prompt') {
      return (
        <>
          <Button
            onClick={() => setStep('analyze')}
            variant="outlined"
            disabled={autoEditing}
          >
            Back to Analysis
          </Button>
          <Button
            onClick={handleUploadVideo}
            variant="contained"
            disabled={uploading || autoEditing}
            sx={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              },
            }}
          >
            {uploading ? 'Saving...' : (savedDocId ? 'Finish & Close' : 'Finish')}
          </Button>
        </>
      );
    }

  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth={step === 'review-prompt' ? 'md' : 'sm'}
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
          <IconButton onClick={handleClose} size="small" disabled={transcribing || uploading || autoEditing}>
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
