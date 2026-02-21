'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  TextField,
  CircularProgress,
  Alert,
  LinearProgress,
  Chip,
  Card,
  CardContent,
  CardActions,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  useMediaQuery,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Close,
  ContentCut,
  SmartToy,
  Download,
  PlayArrow,
  ExpandMore,
  Info,
  ArrowUpward,
  ArrowDownward,
  DeleteOutline,
  MergeType,
  OpenInNew,
  Subtitles,
} from '@mui/icons-material';

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

interface GeneratedClip {
  index: number;
  start: number;
  end: number;
  duration: number;
  fileSize: number;
  segmentCount: number;
  transcript: string;
  reasons: string[];
  objectUrl: string; // blob URL for preview/download
}

interface GenerateClipsDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  file: {
    id: string;
    name: string;
    url: string;
    storagePath: string;
    transcription?: string;
    transcriptionSegments?: TranscriptSegment[];
    videoType?: string;
  } | null;
}

// Sub-component: clip preview with live subtitle overlay
function ClipPreviewPlayer({
  clip,
  segments,
  showSubtitles,
}: {
  clip: GeneratedClip;
  segments: TranscriptSegment[];
  showSubtitles: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentText, setCurrentText] = useState('');

  const clipSegments = useMemo(
    () =>
      segments
        .filter((s) => s.end > clip.start && s.start < clip.end)
        .map((s) => ({
          text: s.text.trim(),
          relStart: Math.max(0, s.start - clip.start),
          relEnd: Math.min(clip.duration, s.end - clip.start),
        })),
    [clip, segments]
  );

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !showSubtitles) {
      setCurrentText('');
      return;
    }
    const t = videoRef.current.currentTime;
    const seg = clipSegments.find((s) => t >= s.relStart && t <= s.relEnd);
    setCurrentText(seg?.text || '');
  }, [clipSegments, showSubtitles]);

  return (
    <Box sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden', bgcolor: 'black', mb: 2 }}>
      <video
        ref={videoRef}
        src={clip.objectUrl}
        controls
        autoPlay
        onTimeUpdate={handleTimeUpdate}
        style={{ width: '100%', maxHeight: 300, display: 'block' }}
      />
      {showSubtitles && currentText && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 50,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'rgba(0,0,0,0.75)',
            color: 'white',
            px: 2,
            py: 0.5,
            borderRadius: 1,
            maxWidth: '90%',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
            {currentText}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default function GenerateClipsDialog({ open, onClose, file, projectId }: GenerateClipsDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clips, setClips] = useState<GeneratedClip[]>([]);
  const [progress, setProgress] = useState('');
  const [previewClipIndex, setPreviewClipIndex] = useState<number | null>(null);

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [paddingSeconds, setPaddingSeconds] = useState(1.5);
  const [mergeGapSeconds, setMergeGapSeconds] = useState(3);

  // Clip management state
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [merging, setMerging] = useState(false);
  const [mergedVideo, setMergedVideo] = useState<{ blob: Blob; objectUrl: string; fileSize: number } | null>(null);

  const handleClose = () => {
    if (loading || merging) return;
    // Revoke object URLs to free memory
    clips.forEach((clip) => {
      try { URL.revokeObjectURL(clip.objectUrl); } catch { /* ignore */ }
    });
    if (mergedVideo) {
      try { URL.revokeObjectURL(mergedVideo.objectUrl); } catch { /* ignore */ }
    }
    setQuery('');
    setError('');
    setClips([]);
    setProgress('');
    setPreviewClipIndex(null);
    setMergedVideo(null);
    onClose();
  };

  const handleGenerate = async () => {
    if (!file || !query.trim()) return;

    if (!file.transcriptionSegments || file.transcriptionSegments.length === 0) {
      setError('This video needs transcription with timestamps before clips can be generated. Please transcribe the video first.');
      return;
    }

    setError('');
    setLoading(true);
    setClips([]);
    setProgress('Analyzing transcription with AI...');

    try {
      // Step 1: Ask the backend LLM to identify relevant segments
      const response = await fetch('/api/generate-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: file.transcriptionSegments,
          query: query.trim(),
          paddingSeconds,
          mergeGapSeconds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze segments');
      }

      if (!data.clips || data.clips.length === 0) {
        setError(data.message || 'No segments matched your query. Try a broader description.');
        setLoading(false);
        setProgress('');
        return;
      }

      setProgress(`Found ${data.clips.length} clip(s). Loading FFmpeg...`);

      // Step 2: Clip the video on the frontend using FFmpeg WASM
      const { clipVideo } = await import('@/lib/video/clipVideo');

      const clipResults = await clipVideo(
        file.url,
        data.clips,
        (p) => setProgress(p.message)
      );

      if (clipResults.length === 0) {
        setError('Failed to clip video. Please try again.');
        setProgress('');
      } else {
        setClips(
          clipResults.map((r) => ({
            index: r.index,
            start: r.start,
            end: r.end,
            duration: r.duration,
            fileSize: r.fileSize,
            segmentCount: r.segmentCount,
            transcript: r.transcript,
            reasons: r.reasons,
            objectUrl: r.objectUrl,
          }))
        );
        setProgress('');
      }
    } catch (err: any) {
      console.error('Generate clips error:', err);
      setError(err.message || 'Failed to generate clips');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadClip = (clip: GeneratedClip) => {
    const link = document.createElement('a');
    link.href = clip.objectUrl;
    const baseName = file?.name?.replace(/\.[^/.]+$/, '') || 'clip';
    link.download = `${baseName}_clip${clip.index}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Clip management handlers ---

  const handleMoveUp = (idx: number) => {
    if (idx <= 0) return;
    setClips((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((c, i) => ({ ...c, index: i + 1 }));
    });
    // Invalidate merged video when order changes
    if (mergedVideo) {
      try { URL.revokeObjectURL(mergedVideo.objectUrl); } catch { /* ignore */ }
      setMergedVideo(null);
    }
  };

  const handleMoveDown = (idx: number) => {
    if (idx >= clips.length - 1) return;
    setClips((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((c, i) => ({ ...c, index: i + 1 }));
    });
    if (mergedVideo) {
      try { URL.revokeObjectURL(mergedVideo.objectUrl); } catch { /* ignore */ }
      setMergedVideo(null);
    }
  };

  const handleRemoveClip = (idx: number) => {
    const removedIndex = clips[idx]?.index;
    setClips((prev) => {
      try { URL.revokeObjectURL(prev[idx].objectUrl); } catch { /* ignore */ }
      const next = prev.filter((_, i) => i !== idx);
      return next.map((c, i) => ({ ...c, index: i + 1 }));
    });
    if (previewClipIndex === removedIndex) setPreviewClipIndex(null);
    if (mergedVideo) {
      try { URL.revokeObjectURL(mergedVideo.objectUrl); } catch { /* ignore */ }
      setMergedVideo(null);
    }
  };

  const handleMergeClips = async () => {
    if (clips.length === 0) return;
    setMerging(true);
    setError('');
    setProgress('Preparing to merge clips...');

    try {
      const { mergeClips } = await import('@/lib/video/clipVideo');

      // Get blobs from object URLs
      const clipBlobs = await Promise.all(
        clips.map(async (c) => ({
          blob: await fetch(c.objectUrl).then((r) => r.blob()),
          index: c.index,
        }))
      );

      const result = await mergeClips(clipBlobs, (p) => setProgress(p.message));
      setMergedVideo(result);
      setProgress('');
    } catch (err: any) {
      console.error('Merge clips error:', err);
      setError(err.message || 'Failed to merge clips');
      setProgress('');
    } finally {
      setMerging(false);
    }
  };

  const handleDownloadMerged = () => {
    if (!mergedVideo) return;
    const link = document.createElement('a');
    link.href = mergedVideo.objectUrl;
    const baseName = file?.name?.replace(/\.[^/.]+$/, '') || 'merged';
    link.download = `${baseName}_merged.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInEditor = () => {
    if (!file || clips.length === 0) return;

    // Store clip data in sessionStorage for the editor to pick up
    const editorData = {
      sourceFile: {
        id: file.id,
        name: file.name,
        url: file.url,
        storagePath: file.storagePath,
      },
      clips: clips.map((c) => ({
        index: c.index,
        start: c.start,
        end: c.end,
        duration: c.duration,
        transcript: c.transcript,
      })),
      transcriptionSegments: file.transcriptionSegments || [],
    };

    sessionStorage.setItem(`editor_clips_${projectId}`, JSON.stringify(editorData));
    router.push(`/editor/${projectId}`);
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const hasSegments = file?.transcriptionSegments && file.transcriptionSegments.length > 0;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ContentCut color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Generate Clips
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={loading}>
            <Close />
          </IconButton>
        </Box>
        {file && (
          <Typography variant="caption" color="text.secondary">
            {file.name}
          </Typography>
        )}
      </DialogTitle>

      <Divider />

      <DialogContent>
        {/* No segments warning */}
        {!hasSegments && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Transcription required:</strong> This video needs to be transcribed with timestamps
            before clips can be generated. Please transcribe the video first from the file list.
          </Alert>
        )}

        {/* Query Input */}
        {clips.length === 0 && !loading && (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              What clips do you want?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Describe the topic or section you want to extract from this video.
              The AI will find matching segments and create clips.
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              placeholder="e.g., Extract the camera review section, Show only the battery test results, Get the unboxing part..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={!hasSegments}
              sx={{ mb: 2 }}
            />

            {/* Example queries */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} gutterBottom>
                EXAMPLES:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                {[
                  'Camera review and samples',
                  'Battery life test',
                  'Unboxing and first impressions',
                  'Performance benchmarks',
                  'Pros and cons summary',
                ].map((example) => (
                  <Chip
                    key={example}
                    label={example}
                    size="small"
                    variant="outlined"
                    clickable
                    onClick={() => setQuery(example)}
                    disabled={!hasSegments}
                  />
                ))}
              </Box>
            </Box>

            {/* Advanced Settings */}
            <Accordion
              expanded={showAdvanced}
              onChange={() => setShowAdvanced(!showAdvanced)}
              variant="outlined"
              sx={{ '&:before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="body2" fontWeight={600}>
                  Advanced Settings
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ px: 1 }}>
                  <Typography variant="caption" fontWeight={600} gutterBottom>
                    Padding (seconds around each segment)
                  </Typography>
                  <Slider
                    value={paddingSeconds}
                    onChange={(_, v) => setPaddingSeconds(v as number)}
                    min={0}
                    max={5}
                    step={0.5}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 0, label: '0s' },
                      { value: 2.5, label: '2.5s' },
                      { value: 5, label: '5s' },
                    ]}
                    sx={{ mb: 3 }}
                  />

                  <Typography variant="caption" fontWeight={600} gutterBottom>
                    Merge gap (max gap to merge nearby segments)
                  </Typography>
                  <Slider
                    value={mergeGapSeconds}
                    onChange={(_, v) => setMergeGapSeconds(v as number)}
                    min={0}
                    max={10}
                    step={1}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 0, label: '0s' },
                      { value: 5, label: '5s' },
                      { value: 10, label: '10s' },
                    ]}
                  />
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Transcription info */}
            {hasSegments && (
              <Alert severity="info" icon={<Info />} sx={{ mt: 2 }}>
                <strong>{file!.transcriptionSegments!.length} segments</strong> with timestamps available.
                The AI will search through these to find your requested content.
              </Alert>
            )}
          </Box>
        )}

        {/* Loading State */}
        {(loading || merging) && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="h6" fontWeight={600} gutterBottom>
              {merging ? 'Merging Clips...' : 'Generating Clips...'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {progress || 'Processing...'}
            </Typography>
            <LinearProgress sx={{ maxWidth: 400, mx: 'auto' }} />
            <Box sx={{ mt: 3 }}>
              <Alert severity="info">
                {merging
                  ? 'FFmpeg is merging your clips into a single video. This may take a moment.'
                  : 'This may take a minute. The AI is analyzing your transcript, finding relevant sections, and then using FFmpeg to cut the video.'}
              </Alert>
            </Box>
          </Box>
        )}

        {/* Error */}
        {error && !loading && !merging && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Results */}
        {clips.length > 0 && !loading && !merging && (
          <Box sx={{ py: 2 }}>
            {/* Results Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h6" fontWeight={700}>
                Generated Clips ({clips.length})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={showSubtitles}
                      onChange={(e) => setShowSubtitles(e.target.checked)}
                    />
                  }
                  label={<Typography variant="caption"><Subtitles sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />Subtitles</Typography>}
                  sx={{ mr: 1 }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    clips.forEach((c) => { try { URL.revokeObjectURL(c.objectUrl); } catch {} });
                    if (mergedVideo) { try { URL.revokeObjectURL(mergedVideo.objectUrl); } catch {} }
                    setClips([]);
                    setPreviewClipIndex(null);
                    setMergedVideo(null);
                  }}
                >
                  New Query
                </Button>
              </Box>
            </Box>

            <Alert severity="success" sx={{ mb: 2 }}>
              Found {clips.length} clip{clips.length > 1 ? 's' : ''} matching &quot;{query}&quot;
            </Alert>

            {/* Clip Cards */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {clips.map((clip, idx) => (
                <Card key={`${clip.index}-${idx}`} variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          Clip {clip.index}
                        </Typography>
                        {/* Reorder & Remove buttons */}
                        <Tooltip title="Move up"><span>
                          <IconButton size="small" onClick={() => handleMoveUp(idx)} disabled={idx === 0}>
                            <ArrowUpward fontSize="small" />
                          </IconButton>
                        </span></Tooltip>
                        <Tooltip title="Move down"><span>
                          <IconButton size="small" onClick={() => handleMoveDown(idx)} disabled={idx === clips.length - 1}>
                            <ArrowDownward fontSize="small" />
                          </IconButton>
                        </span></Tooltip>
                        <Tooltip title="Remove clip">
                          <IconButton size="small" color="error" onClick={() => handleRemoveClip(idx)}>
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={`${formatTime(clip.start)} → ${formatTime(clip.end)}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        <Chip
                          label={`${clip.duration.toFixed(1)}s`}
                          size="small"
                          color="info"
                        />
                        <Chip
                          label={formatFileSize(clip.fileSize)}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </Box>

                    {/* Clip Preview with subtitle overlay */}
                    {previewClipIndex === clip.index && (
                      <ClipPreviewPlayer
                        clip={clip}
                        segments={file?.transcriptionSegments || []}
                        showSubtitles={showSubtitles}
                      />
                    )}

                    {/* Reasons */}
                    {clip.reasons.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">
                          WHY THIS SEGMENT:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {clip.reasons.map((reason, i) => (
                            <Chip key={i} label={reason} size="small" variant="outlined" color="success" />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Transcript preview */}
                    <Accordion variant="outlined" sx={{ mt: 1, '&:before': { display: 'none' } }}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="caption" fontWeight={600}>
                          Transcript ({clip.segmentCount} segments)
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                          {clip.transcript}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Button
                      size="small"
                      startIcon={previewClipIndex === clip.index ? null : <PlayArrow />}
                      onClick={() => setPreviewClipIndex(previewClipIndex === clip.index ? null : clip.index)}
                    >
                      {previewClipIndex === clip.index ? 'Hide Preview' : 'Preview'}
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Download />}
                      onClick={() => handleDownloadClip(clip)}
                      sx={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
                        },
                      }}
                    >
                      Download
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Box>

            {/* Merged Video Preview */}
            {mergedVideo && (
              <Card variant="outlined" sx={{ mt: 3, border: 2, borderColor: 'success.main' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MergeType color="success" />
                      <Typography variant="subtitle1" fontWeight={700}>
                        Merged Video
                      </Typography>
                    </Box>
                    <Chip label={formatFileSize(mergedVideo.fileSize)} size="small" color="success" />
                  </Box>
                  <Box sx={{ borderRadius: 1, overflow: 'hidden', bgcolor: 'black', mb: 2 }}>
                    <video
                      src={mergedVideo.objectUrl}
                      controls
                      style={{ width: '100%', maxHeight: 400, display: 'block' }}
                    />
                  </Box>
                  <Button
                    variant="contained"
                    color="success"
                    fullWidth
                    startIcon={<Download />}
                    onClick={handleDownloadMerged}
                    size="large"
                  >
                    Download Merged Video
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons Row */}
            <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={() => clips.forEach(handleDownloadClip)}
                sx={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                  '&:hover': { background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)' },
                }}
              >
                Download All Clips
              </Button>
              {clips.length > 1 && (
                <Button
                  variant="contained"
                  startIcon={<MergeType />}
                  onClick={handleMergeClips}
                  disabled={merging}
                  color="secondary"
                >
                  Merge Clips &amp; Download
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<OpenInNew />}
                onClick={handleOpenInEditor}
                color="info"
              >
                Open in Editor
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" disabled={loading || merging}>
          {clips.length > 0 ? 'Close' : 'Cancel'}
        </Button>
        {clips.length === 0 && !loading && !merging && (
          <Button
            onClick={handleGenerate}
            variant="contained"
            disabled={!query.trim() || !hasSegments || loading}
            startIcon={<SmartToy />}
            sx={{
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
              },
            }}
          >
            Generate Clips
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
