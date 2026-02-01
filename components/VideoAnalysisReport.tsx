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
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Divider,
  Paper,
} from '@mui/material';
import {
  ExpandMore,
  VideoLibrary,
  Label,
  TextFields,
  Person,
  Schedule,
  TrendingUp,
  AutoFixHigh,
  SmartToy,
  Close,
  CheckCircle,
  Warning,
} from '@mui/icons-material';

interface VideoAnalysisReportProps {
  open: boolean;
  onClose: () => void;
  videoName: string;
  analysisData?: {
    scenes: Array<{ start: number; end: number; description: string }>;
    labels: Array<{ label: string; confidence: number; timeRanges: Array<{ start: number; end: number }> }>;
    detectedText: Array<{ text: string; timeRanges: Array<{ start: number; end: number }> }>;
    objects: Array<{ object: string; appearances: number }>;
    faces: number;
    explicitContent: boolean;
    keyMoments: Array<{ time: number; reason: string }>;
    transcription?: string; // Track if transcript was used
  };
  recommendations?: string;
  isAnalyzing?: boolean;
}

export const VideoAnalysisReport: React.FC<VideoAnalysisReportProps> = ({
  open,
  onClose,
  videoName,
  analysisData,
  recommendations,
  isAnalyzing = false,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const parseRecommendations = (text: string) => {
    // Parse the AI recommendations into sections
    const sections = text.split(/(?=^##?\s+)/m).filter(Boolean);
    return sections.map((section, index) => {
      const lines = section.trim().split('\n');
      const title = lines[0].replace(/^#+\s*/, '').replace(/\*+/g, '');
      const content = lines.slice(1).join('\n');
      return { title, content, id: index };
    });
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SmartToy color="primary" />
            <Box>
              <Typography variant="h6">AI Video Analysis</Typography>
              <Typography variant="caption" color="text.secondary">
                {videoName}
              </Typography>
            </Box>
            {analysisData && (
              <Chip 
                label={analysisData.transcription ? '📝 With Transcript' : '⚠️ Visual Only'} 
                size="small"
                color={analysisData.transcription ? 'success' : 'warning'}
              />
            )}
          </Box>
          <Close onClick={onClose} sx={{ cursor: 'pointer' }} />
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {isAnalyzing ? (
          <Box sx={{ py: 4 }}>
            <Typography variant="body1" gutterBottom align="center">
              Analyzing your video with AI...
            </Typography>
            <LinearProgress sx={{ mt: 2 }} />
            <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 2 }}>
              This may take a few minutes depending on video length
            </Typography>
          </Box>
        ) : analysisData ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Quick Stats */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" gutterBottom>
                Quick Overview
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                <Chip 
                  icon={<VideoLibrary />} 
                  label={`${analysisData.scenes.length} Scenes`} 
                  size="small" 
                />
                <Chip 
                  icon={<Label />} 
                  label={`${analysisData.labels.length} Labels`} 
                  size="small" 
                />
                <Chip 
                  icon={<Person />} 
                  label={`${analysisData.faces} Faces`} 
                  size="small" 
                />
                <Chip 
                  icon={<Schedule />} 
                  label={`${analysisData.keyMoments.length} Key Moments`} 
                  size="small" 
                />
              </Box>
            </Paper>

            {/* Content Warning */}
            {analysisData.explicitContent && (
              <Alert severity="warning" icon={<Warning />}>
                Explicit content detected in this video
              </Alert>
            )}

            {/* Scene Breakdown */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VideoLibrary color="primary" />
                  <Typography>Scene Breakdown ({analysisData.scenes.length} scenes)</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {analysisData.scenes.slice(0, 10).map((scene, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={scene.description}
                        secondary={`${formatTime(scene.start)} - ${formatTime(scene.end)} (${(scene.end - scene.start).toFixed(1)}s)`}
                      />
                    </ListItem>
                  ))}
                  {analysisData.scenes.length > 10 && (
                    <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
                      + {analysisData.scenes.length - 10} more scenes
                    </Typography>
                  )}
                </List>
              </AccordionDetails>
            </Accordion>

            {/* Content Labels */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Label color="primary" />
                  <Typography>Detected Content</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {analysisData.labels.slice(0, 20).map((label, index) => (
                    <Chip
                      key={index}
                      label={`${label.label} (${(label.confidence * 100).toFixed(0)}%)`}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Detected Text */}
            {analysisData.detectedText.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextFields color="primary" />
                    <Typography>Text in Video</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {analysisData.detectedText.map((text, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={text.text}
                          secondary={text.timeRanges.map(tr => formatTime(tr.start)).join(', ')}
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Key Moments */}
            {analysisData.keyMoments.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp color="primary" />
                    <Typography>Key Moments</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {analysisData.keyMoments.map((moment, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <CheckCircle fontSize="small" color="success" />
                        </ListItemIcon>
                        <ListItemText
                          primary={moment.reason}
                          secondary={formatTime(moment.time)}
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}

            {/* AI Recommendations */}
            {recommendations && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoFixHigh color="primary" />
                  AI Editing Recommendations
                </Typography>
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover' }}>
                  {parseRecommendations(recommendations).map((section) => (
                    <Box key={section.id} sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        {section.title}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ whiteSpace: 'pre-wrap' }}
                      >
                        {section.content}
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              </>
            )}
          </Box>
        ) : (
          <Alert severity="info">
            No analysis data available. Start the analysis to see results.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {analysisData && (
          <Button 
            variant="contained" 
            sx={{
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            }}
          >
            Apply Suggestions
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
