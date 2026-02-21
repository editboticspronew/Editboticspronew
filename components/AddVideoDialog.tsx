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
} from '@mui/icons-material';
import { transcribeAudio, TranscriptSegment } from '../utils/audioTranscription';
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
  { id: 'long-short', name: 'Long→Short', icon: <ContentCut />, color: '#8b5cf6' },
  { id: 'edit', name: 'Edit', icon: <EditIcon />, color: '#ec4899' },
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
  { id: 'OBJECT_TRACKING', name: 'Object Tracking', description: 'Detect and track objects throughout the video (⚠️ Frame-heavy, slower)', isFrameHeavy: true },
  { id: 'LOGO_RECOGNITION', name: 'Logo Recognition', description: 'Detect and recognize brand logos (⚠️ Frame-heavy)', isFrameHeavy: true },
  { id: 'PERSON_DETECTION', name: 'Person Detection', description: 'Detect and track people in the video (⚠️ Frame-heavy, slower)', isFrameHeavy: true },
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
  const [step, setStep] = useState<'type' | 'upload' | 'selected' | 'uploading' | 'transcribe' | 'analyze'>('type');
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
      setFirebaseUrl('');
      setStoragePath('');
      setGsPath('');
      setSavedDocId('');
      setSelectedFeatures(DEFAULT_FEATURES);
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
        console.log('✅ Initial file metadata saved to database:', savedFile.id);
      } catch (dbErr: any) {
        console.error('⚠️ Failed to save initial metadata:', dbErr);
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
    if (!selectedFile && !firebaseUrl) return;

    setError('');
    setTranscribing(true);

    try {
      // Extract audio from video file on the frontend using FFmpeg WASM
      // This avoids sending the full video to the backend
      let audioSource: Blob | File;
      
      if (selectedFile) {
        console.log('🎬 Extracting audio from video file in browser...');
        const { extractAudioFromVideo } = await import('@/lib/audio/extractAudio');
        audioSource = await extractAudioFromVideo(selectedFile, (progress) => {
          console.log(`🔧 ${progress.stage}: ${progress.message}`);
        });
        console.log(`✅ Audio extracted: ${(audioSource.size / 1024 / 1024).toFixed(2)} MB`);
      } else {
        throw new Error('No video file available for audio extraction.');
      }

      // Import transcription utility
      const { transcribeAudio } = await import('@/utils/audioTranscription');

      console.log('🎤 Sending extracted audio to transcription API...');
      
      const result = await transcribeAudio(audioSource, {
        timestampGranularity: 'segment',
      });

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
          console.log('✅ Transcription saved to database');
        } catch (dbErr: any) {
          console.error('⚠️ Failed to save transcription to database:', dbErr);
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
      console.log('✅ AI Analysis complete');
      
      // Save AI analysis to database incrementally
      if (savedDocId) {
        try {
          await dispatch(
            updateProjectFileMetadata({
              fileId: savedDocId,
              updates: { aiAnalysis: result },
            })
          ).unwrap();
          console.log('✅ AI analysis saved to database');
        } catch (dbErr: any) {
          console.error('⚠️ Failed to save AI analysis to database:', dbErr);
        }
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze video. You can skip this step.');
    } finally {
      setAnalyzing(false);
    }
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
              setTranscriptionSegments([]);
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
              {uploading ? 'Saving...' : (savedDocId ? 'Finish & Close' : 'Finish')}
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
