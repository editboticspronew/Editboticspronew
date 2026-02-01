'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Menu,
  MenuItem,
  CircularProgress,
  alpha,
  Button,
  useTheme,
  Dialog,
  DialogContent,
  Grid,
  Select,
  FormControl,
} from '@mui/material';
import {
  ArrowBack,
  MoreVert,
  CloudUpload,
  VideoLibrary,
  AudioFile,
  Image as ImageIcon,
  Delete,
  Visibility,
  Download,
  Close,
  InsertDriveFile,
  Folder,
  AutoFixHigh,
} from '@mui/icons-material';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAllUserFiles, fetchProjectFiles, deleteProjectFile } from '@/store/filesSlice';
import { fetchUserProjects } from '@/store/projectsSlice';
import { VideoAnalysisReport } from '@/components/VideoAnalysisReport';
import { analyzeVideo, getProviderDisplayName, isProviderConfigured } from '@/lib/ai';

export default function FilesPage() {
  const router = useRouter();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { files, loading } = useAppSelector((state) => state.files);
  const { projects } = useAppSelector((state) => state.projects);
  const [filter, setFilter] = useState<'all' | 'video' | 'image' | 'audio'>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      dispatch(fetchUserProjects(user.uid));
    }
  }, [user?.uid, dispatch]);

  useEffect(() => {
    // Fetch files based on selected project
    if (selectedProjectId === 'all') {
      projects.forEach((project) => {
        dispatch(fetchProjectFiles(project.id));
      });
    } else if (selectedProjectId) {
      dispatch(fetchProjectFiles(selectedProjectId));
    }
  }, [selectedProjectId, projects, dispatch]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, file: any) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedFile(file);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDelete = async () => {
    if (selectedFile) {
      await dispatch(deleteProjectFile({
        fileId: selectedFile.id,
        storagePath: selectedFile.storagePath
      }));
    }
    handleMenuClose();
  };

  const handlePreview = () => {
    setPreviewOpen(true);
    handleMenuClose();
  };

  const handleDownload = () => {
    if (selectedFile?.url) {
      window.open(selectedFile.url, '_blank');
    }
    handleMenuClose();
  };

  const handleAnalyzeVideo = async () => {
    if (!selectedFile || selectedFile.type !== 'video') return;
    
    // Check if provider is configured
    const { configured, message } = isProviderConfigured();
    if (!configured) {
      console.error('Analysis provider not configured:', message);
      alert(message);
      return;
    }

    setAnalysisOpen(true);
    setIsAnalyzing(true);
    handleMenuClose();

    try {
      console.log(`Using provider: ${getProviderDisplayName()}`);
      
      // Use existing transcript from video upload wizard if available
      const transcript = selectedFile.transcription || undefined;
      const duration = selectedFile.duration || undefined;
      
      if (transcript) {
        console.log('✅ Using existing transcript from upload');
      } else {
        console.log('⚠️ No transcript available - analysis will be limited');
      }
      
      // Unified API - automatically uses configured provider
      const result = await analyzeVideo(
        selectedFile.url,
        selectedFile.name,
        selectedFile.storagePath,
        transcript,
        duration
      );
      
      setAnalysisData(result.analysis);
      setRecommendations(result.recommendations);
      setIsAnalyzing(false);
      
      console.log(`✅ Analysis complete using ${result.provider}`);
    } catch (error) {
      console.error('Video analysis failed:', error);
      setIsAnalyzing(false);
      alert(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <VideoLibrary sx={{ fontSize: 40 }} />;
      case 'audio':
        return <AudioFile sx={{ fontSize: 40 }} />;
      case 'image':
        return <ImageIcon sx={{ fontSize: 40 }} />;
      default:
        return <InsertDriveFile sx={{ fontSize: 40 }} />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Filter by project first, then by file type
  const projectFilteredFiles = selectedProjectId === 'all'
    ? files
    : files.filter(f => f.projectId === selectedProjectId);

  const filteredFiles = filter === 'all'
    ? projectFilteredFiles
    : projectFilteredFiles.filter(f => f.type === filter);

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.title || 'Unknown Project';
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <ProtectedRoute>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 4 }}>
        {/* Header */}
        <AppBar 
          position="sticky" 
          elevation={0}
          sx={{ 
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Toolbar>
            <IconButton edge="start" onClick={() => router.push('/dashboard')} sx={{ mr: 2 }}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
              Files Library
            </Typography>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => router.push('/dashboard')}
              sx={{ 
                display: { xs: 'none', sm: 'inline-flex' },
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
                },
              }}
            >
              Upload
            </Button>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ mt: 3 }}>
          {/* Project Selector */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 250 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Select Project
              </Typography>
              <Select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                size="small"
                sx={{
                  bgcolor: 'background.paper',
                  '& .MuiSelect-select': {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  },
                }}
              >
                <MenuItem value="all">
                  <Folder sx={{ mr: 1, fontSize: 20 }} />
                  All Projects
                </MenuItem>
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.emoji && <span style={{ marginRight: 8 }}>{project.emoji}</span>}
                    {project.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* File count */}
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
            </Typography>
          </Box>
          {/* Filter Chips (Tabs) */}
          <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {(['all', 'video', 'image', 'audio'] as const).map((type) => (
              <Chip
                key={type}
                label={type.charAt(0).toUpperCase() + type.slice(1)}
                onClick={() => setFilter(type)}
                color={filter === type ? 'primary' : 'default'}
                variant={filter === type ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: filter === type ? 700 : 400,
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </Box>

          {/* Files Grid */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : filteredFiles.length === 0 ? (
            <Card 
              elevation={0}
              sx={{ 
                p: 6, 
                textAlign: 'center', 
                border: 1, 
                borderColor: 'divider',
                borderRadius: 3,
              }}
            >
              <CloudUpload sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" fontWeight={700} gutterBottom>
                No {filter !== 'all' ? filter : ''} files yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Upload files to your projects to see them here
              </Typography>
              <Button
                variant="contained"
                onClick={() => router.push('/dashboard')}
                sx={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                }}
              >
                Go to Projects
              </Button>
            </Card>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
              {filteredFiles.map((file) => (
                  <Card
                    elevation={0}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 2,
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: 'primary.main',
                        transform: 'translateY(-4px)',
                        boxShadow: theme.shadows[4],
                      },
                    }}
                    onClick={() => {
                      setSelectedFile(file);
                      setPreviewOpen(true);
                    }}
                  >
                    {file.type === 'image' ? (
                      <Box
                        sx={{
                          height: 180,
                          overflow: 'hidden',
                          bgcolor: 'action.hover',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <img
                          src={file.url}
                          alt={file.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          height: 180,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                          color: 'primary.main',
                        }}
                      >
                        {getFileIcon(file.type)}
                      </Box>
                    )}
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                        <Typography 
                          variant="body2" 
                          fontWeight={600} 
                          noWrap
                          sx={{ flexGrow: 1, mr: 1 }}
                        >
                          {file.name}
                        </Typography>
                        <IconButton 
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMenuOpen(e, file);
                          }}
                        >
                          <MoreVert fontSize="small" />
                        </IconButton>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip 
                          label={file.type} 
                          size="small" 
                          sx={{ height: 18, fontSize: '0.7rem', textTransform: 'capitalize' }} 
                        />
                        <Chip 
                          label={formatFileSize(file.size)} 
                          size="small" 
                          sx={{ height: 18, fontSize: '0.7rem' }} 
                        />
                      </Box>
                      <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        noWrap
                        sx={{ display: 'block', mt: 1 }}
                      >
                        {getProjectName(file.projectId)}
                      </Typography>
                    </CardContent>
                  </Card>
              ))}
            </Box>
          )}
        </Container>

        {/* Context Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          {selectedFile?.type === 'video' && (
            <MenuItem onClick={handleAnalyzeVideo}>
              <AutoFixHigh fontSize="small" sx={{ mr: 1 }} />
              Analyze with AI
              {selectedFile && !selectedFile.transcription && (
                <Chip 
                  label="No Transcript" 
                  size="small" 
                  color="warning"
                  sx={{ ml: 1, height: 20 }}
                />
              )}
            </MenuItem>
          )}
          <MenuItem onClick={handlePreview}>
            <Visibility sx={{ mr: 1, fontSize: 20 }} />
            Preview
          </MenuItem>
          <MenuItem onClick={handleDownload}>
            <Download sx={{ mr: 1, fontSize: 20 }} />
            Download
          </MenuItem>
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <Delete sx={{ mr: 1, fontSize: 20 }} />
            Delete
          </MenuItem>
        </Menu>

        {/* Preview Dialog */}
        <Dialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              bgcolor: 'background.paper',
              maxHeight: '90vh',
            }
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
            <IconButton onClick={() => setPreviewOpen(false)}>
              <Close />
            </IconButton>
          </Box>
          <DialogContent sx={{ p: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {selectedFile?.type === 'image' && (
              <img 
                src={selectedFile.url} 
                alt={selectedFile.name}
                style={{ 
                  width: '100%', 
                  height: 'auto',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                }}
              />
            )}
            {selectedFile?.type === 'video' && (
              <video 
                src={selectedFile.url} 
                controls
                style={{ 
                  width: '100%', 
                  height: 'auto',
                  maxHeight: '80vh',
                }}
              />
            )}
            {selectedFile?.type === 'audio' && (
              <Box sx={{ p: 4, width: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  {selectedFile.name}
                </Typography>
                <audio src={selectedFile.url} controls style={{ width: '100%' }} />
              </Box>
            )}
          </DialogContent>
        </Dialog>

        {/* Video Analysis Report */}
        <VideoAnalysisReport
          open={analysisOpen}
          onClose={() => setAnalysisOpen(false)}
          videoName={selectedFile?.name || ''}
          analysisData={analysisData}
          recommendations={recommendations}
          isAnalyzing={isAnalyzing}
        />
      </Box>
    </ProtectedRoute>
  );
}
