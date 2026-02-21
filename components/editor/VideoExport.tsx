'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { Download } from '@mui/icons-material';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { ref, getBlob } from 'firebase/storage';
import { storage } from '@/lib/firebase/init';

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

interface Track {
  id: string;
  type: 'video' | 'audio' | 'text' | 'image';
  name: string;
  locked: boolean;
  visible: boolean;
  clips: Clip[];
}

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  font?: string;
  startTime: number;
  duration: number;
}

interface VideoExportProps {
  tracks: Track[];
  textOverlays: TextOverlay[];
  duration: number;
  projectName: string;
}

export const VideoExport: React.FC<VideoExportProps> = ({
  tracks,
  textOverlays,
  duration,
  projectName,
}) => {
  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logMessages, setLogMessages] = useState('');
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('medium');

  // Load FFmpeg
  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        const ffmpegInstance = new FFmpeg();
        
        ffmpegInstance.on('log', ({ message }) => {
          setLogMessages(prev => prev + message + '\n');
          console.log(message);
        });

        ffmpegInstance.on('progress', ({ progress: prog, time }) => {
          // FFmpeg WASM progress can be unreliable, clamp between 0-100
          const normalizedProgress = Math.max(0, Math.min(100, Math.round(prog * 100)));
          setProgress(normalizedProgress);
          console.log(`Export progress: ${normalizedProgress}%, time: ${time}`);
        });

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpegInstance.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        setFfmpeg(ffmpegInstance);
        setLoaded(true);
      } catch (error) {
        console.error('Failed to load FFmpeg:', error);
      }
    };

    loadFFmpeg();
  }, []);

  const getQualityParams = () => {
    switch (quality) {
      case 'high':
        return { preset: 'slow', crf: 18 };
      case 'medium':
        return { preset: 'medium', crf: 23 };
      case 'low':
        return { preset: 'fast', crf: 28 };
      default:
        return { preset: 'medium', crf: 23 };
    }
  };

  const handleExport = async () => {
    if (!ffmpeg || !loaded) return;

    setDialogOpen(true);
    setExporting(true);
    setProgress(0);
    setLogMessages('Starting export...\n');
    setExportUrl(null);

    // Helper function to download files from Firebase Storage (CORS is now configured)
    const downloadFile = async (fileUrl?: string, storagePath?: string): Promise<Blob> => {
      try {
        if (storagePath) {
          console.log('Downloading from storagePath:', storagePath);
          const fileRef = ref(storage, storagePath);
          const blob = await getBlob(fileRef);
          console.log('Downloaded successfully, size:', blob.size);
          return blob;
        } else if (fileUrl) {
          console.log('Downloading from URL via fetch');
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const blob = await response.blob();
          console.log('Downloaded successfully, size:', blob.size);
          return blob;
        }
        
        throw new Error('No file URL or storage path provided');
      } catch (error) {
        console.error('Error downloading file:', { fileUrl, storagePath, error });
        throw error;
      }
    };

    try {
      const filters = [];
      const overlays = [];
      const inputs = [];
      const audioDelays = [];

      console.log(`Starting export with duration: ${duration.toFixed(2)}s`);

      // ALWAYS create base black background (critical for clip-js compatibility)
      filters.push(`color=c=black:size=1920x1080:d=${duration.toFixed(3)}[base]`);

      const hasVideo = (tracks.find(t => t.type === 'video')?.clips.length ?? 0) > 0;
      
      // Process video clips
      const videoTrack = tracks.find(t => t.type === 'video');
      let clipIndex = 0;

      if (videoTrack && videoTrack.clips.length > 0) {
        for (const clip of videoTrack.clips) {
          try {
            // Download video file from Firebase Storage
            const blob = await downloadFile(clip.fileUrl, clip.storagePath);
            const buffer = await blob.arrayBuffer();
            const ext = clip.fileType?.split('/')[1] || 'mp4';
            
            await ffmpeg.writeFile(`input${clipIndex}.${ext}`, new Uint8Array(buffer));

            inputs.push('-i', `input${clipIndex}.${ext}`);

            const visualLabel = `visual${clipIndex}`;
            const audioLabel = `audio${clipIndex}`;

            // Video filter - trim and position
            filters.push(
              `[${clipIndex}:v]trim=start=${clip.trimStart.toFixed(3)}:duration=${clip.duration.toFixed(3)},scale=1920:1080,setpts=PTS-STARTPTS+${clip.startTime.toFixed(3)}/TB[${visualLabel}]`
            );

            // Store overlay info
            overlays.push({
              label: visualLabel,
              x: 0,
              y: 0,
              start: clip.startTime.toFixed(3),
              end: (clip.startTime + clip.duration).toFixed(3),
            });

            // Audio filter
            const delayMs = Math.round(clip.startTime * 1000);
            filters.push(
              `[${clipIndex}:a]atrim=start=${clip.trimStart.toFixed(3)}:duration=${clip.duration.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs}[${audioLabel}]`
            );
            audioDelays.push(`[${audioLabel}]`);

            clipIndex++;
          } catch (error) {
            console.error('Error processing clip:', clip.fileName, error);
          }
        }
      }

      // Process image clips
      const imageTrack = tracks.find(t => t.type === 'image');
      if (imageTrack && imageTrack.clips.length > 0) {
        for (const clip of imageTrack.clips) {
          try {
            const blob = await downloadFile(clip.fileUrl, clip.storagePath);
            const buffer = await blob.arrayBuffer();
            const ext = clip.fileType?.split('/')[1] || 'jpg';

            await ffmpeg.writeFile(`input${clipIndex}.${ext}`, new Uint8Array(buffer));

            inputs.push('-loop', '1', '-t', clip.duration.toFixed(3), '-i', `input${clipIndex}.${ext}`);

            const visualLabel = `visual${clipIndex}`;
            
            filters.push(
              `[${clipIndex}:v]scale=1920:1080,setpts=PTS+${clip.startTime.toFixed(3)}/TB[${visualLabel}]`
            );

            overlays.push({
              label: visualLabel,
              x: 0,
              y: 0,
              start: clip.startTime.toFixed(3),
              end: (clip.startTime + clip.duration).toFixed(3),
            });

            clipIndex++;
          } catch (error) {
            console.error('Error processing image:', clip.fileName, error);
          }
        }
      }

      // Apply overlays
      let lastLabel = 'base';
      if (overlays.length > 0) {
        for (let i = 0; i < overlays.length; i++) {
          const { label, start, end, x, y } = overlays[i];
          const nextLabel = i === overlays.length - 1 && textOverlays.length === 0 ? 'outv' : `tmp${i}`;
          filters.push(
            `[${lastLabel}][${label}]overlay=${x}:${y}:enable='between(t,${start},${end})'[${nextLabel}]`
          );
          lastLabel = nextLabel;
        }
      }

      // Apply text overlays
      if (textOverlays.length > 0) {
        // Load fonts first
        const fonts = ['Arial', 'Inter', 'Lato'];
        for (const font of fonts) {
          try {
            const res = await fetch(`/fonts/${font}.ttf`);
            if (res.ok) {
              const fontBuf = await res.arrayBuffer();
              await ffmpeg.writeFile(`font${font}.ttf`, new Uint8Array(fontBuf));
            }
          } catch (error) {
            console.warn(`Failed to load font ${font}:`, error);
          }
        }

        // Apply text overlays using textfile= to avoid quoting/escaping issues.
        // Inline text='...' breaks when content contains apostrophes or special chars
        // because they interfere with FFmpeg's filter_complex single-quote parsing.
        for (let i = 0; i < textOverlays.length; i++) {
          const text = textOverlays[i];
          const outputLabel = i === textOverlays.length - 1 ? 'outv' : `text${i}`;
          const endTime = text.startTime + text.duration;
          const fontFile = text.font ? `font${text.font}.ttf` : 'fontArial.ttf';

          // Write text content to a temp file to bypass all escaping issues
          const textFileName = `overlay_text_${i}.txt`;
          await ffmpeg.writeFile(textFileName, text.text);

          // Use FFmpeg's built-in text_w / text_h expressions for accurate centering
          // instead of estimating from character count
          const videoWidth = 1920;
          const videoHeight = 1080;
          const anchorX = Math.round((text.x / 100) * videoWidth);
          const anchorY = Math.round((text.y / 100) * videoHeight);

          // x and y accept FFmpeg expressions — text_w/text_h are computed at render time
          const xExpr = `(${anchorX}-text_w/2)`;
          const yExpr = `(${anchorY}-text_h/2)`;

          // enable expression: commas inside single quotes don't need escaping
          filters.push(
            `[${lastLabel}]drawtext=fontfile=${fontFile}:textfile=${textFileName}:x=${xExpr}:y=${yExpr}:fontsize=${text.fontSize}:fontcolor=${text.color}:enable='between(t,${text.startTime.toFixed(3)},${endTime.toFixed(3)})'[${outputLabel}]`
          );
          lastLabel = outputLabel;
        }
      }

      // Safety: if no overlays or text created [outv], add a passthrough
      if (lastLabel !== 'outv') {
        filters.push(`[${lastLabel}]null[outv]`);
      }

      // Mix audio tracks
      if (audioDelays.length > 0) {
        const audioMix = audioDelays.join('');
        filters.push(`${audioMix}amix=inputs=${audioDelays.length}:normalize=0[outa]`);
      }

      // Build final FFmpeg command with filter_complex (clip-js approach)
      const { preset, crf } = getQualityParams();
      const complexFilter = filters.join('; ');
      
      console.log('Complex filter:', complexFilter);
      
      const ffmpegArgs = [
        ...inputs,
        '-filter_complex', complexFilter,
        '-map', '[outv]',
      ];

      if (audioDelays.length > 0) {
        ffmpegArgs.push('-map', '[outa]');
      }

      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', preset,
        '-crf', crf.toString(),
        '-pix_fmt', 'yuv420p',
        '-t', duration.toFixed(3),
        'output.mp4'
      );
      
      console.log('FFmpeg args:', ffmpegArgs.join(' '));
      await ffmpeg.exec(ffmpegArgs);

      // Read output file
      const outputData = await ffmpeg.readFile('output.mp4');
      const buffer = new Uint8Array(outputData as unknown as ArrayBuffer);
      const outputBlob = new Blob([buffer.buffer], { type: 'video/mp4' });
      const outputUrl = URL.createObjectURL(outputBlob);

      setExportUrl(outputUrl);
      setExporting(false);
      setProgress(100);
      setLogMessages(prev => prev + '\n=== Export completed successfully! ===\n');
      console.log('Export completed! Video ready for download.');
    } catch (error) {
      console.error('Export error:', error);
      setLogMessages(prev => prev + `\nError: ${error}\n`);
      setExporting(false);
      setProgress(0);
    }
  };

  const handleDownload = () => {
    if (exportUrl) {
      const a = document.createElement('a');
      a.href = exportUrl;
      a.download = `${projectName}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setExportUrl(null);
    setProgress(0);
    setLogMessages('');
  };

  return (
    <>
      <Button
        variant="contained"
        startIcon={<Download />}
        onClick={handleExport}
        disabled={!loaded || exporting}
        sx={{
          background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
          },
        }}
      >
        {loaded ? 'Export Video' : 'Loading FFmpeg...'}
      </Button>

      <Dialog
        open={dialogOpen}
        onClose={exporting ? undefined : handleClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {exporting ? 'Exporting Video...' : exportUrl ? 'Export Complete' : 'Export Video'}
        </DialogTitle>
        <DialogContent>
          {!exporting && !exportUrl && (
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Quality</InputLabel>
                <Select
                  value={quality}
                  label="Quality"
                  onChange={(e) => setQuality(e.target.value as any)}
                >
                  <MenuItem value="high">High (Slow, Large File)</MenuItem>
                  <MenuItem value="medium">Medium (Balanced)</MenuItem>
                  <MenuItem value="low">Low (Fast, Small File)</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}

          {exporting && (
            <Box>
              <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Progress: {progress}%
              </Typography>
              <Box
                sx={{
                  bgcolor: 'background.default',
                  p: 2,
                  borderRadius: 1,
                  maxHeight: 200,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                }}
              >
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{logMessages}</pre>
              </Box>
              <Alert severity="info" sx={{ mt: 2 }}>
                The progress bar may appear slow. The actual processing continues in the background.
              </Alert>
            </Box>
          )}

          {exportUrl && !exporting && (
            <Box>
              <video src={exportUrl} controls style={{ width: '100%', marginBottom: 16 }} />
              <Alert severity="success">
                Video exported successfully! Click download to save.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!exporting && (
            <Button onClick={handleClose}>Close</Button>
          )}
          {exportUrl && (
            <Button
              onClick={handleDownload}
              variant="contained"
              sx={{
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
                },
              }}
            >
              Download
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};
