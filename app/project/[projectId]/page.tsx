'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Card,
  Tab,
  Tabs,
  useTheme,
  Grid,
  Chip,
  alpha,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Delete,
  VideoLibrary,
  Add,
  PlayArrow,
  Image as ImageIcon,
  AudioFile,
} from '@mui/icons-material';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import FileUploadZone from '@/components/FileUploadZone';
import AddVideoDialog from '@/components/AddVideoDialog';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchUserProjects } from '@/store/projectsSlice';
import { fetchProjectFiles, saveProjectFileMetadata } from '@/store/filesSlice';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const router = useRouter();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { projects } = useAppSelector((state) => state.projects);
  const { files } = useAppSelector((state) => state.files);
  const [tabValue, setTabValue] = useState(0);
  const [addVideoDialogOpen, setAddVideoDialogOpen] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const projectFiles = files.filter((f) => f.projectId === projectId);

  useEffect(() => {
    if (user?.uid && !project) {
      dispatch(fetchUserProjects(user.uid));
    }
  }, [user?.uid, project, dispatch]);

  useEffect(() => {
    if (projectId) {
      dispatch(fetchProjectFiles(projectId));
    }
  }, [projectId, dispatch]);

  const handleVideoUpload = async (
    fileMetadata: { name: string; size: number; url: string; storagePath: string },
    videoType: string,
    transcription: string,
    aiAnalysis?: any
  ) => {
    if (!user?.uid || !projectId) {
      throw new Error('User or project ID not found');
    }

    // Save metadata to Firestore (file already uploaded to Storage)
    await dispatch(
      saveProjectFileMetadata({
        projectId,
        userId: user.uid,
        name: fileMetadata.name,
        type: 'video',
        size: fileMetadata.size,
        url: fileMetadata.url,
        storagePath: fileMetadata.storagePath,
        transcription,
        videoType,
        aiAnalysis,
      })
    ).unwrap();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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
        return <VideoLibrary sx={{ fontSize: 40 }} />;
    }
  };

  if (!project) {
    return (
      <ProtectedRoute>
        <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Project not found
          </Typography>
          <Button onClick={() => router.push('/dashboard')} variant="contained" sx={{ mt: 2 }}>
            Back to Dashboard
          </Button>
        </Container>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* App Bar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
        >
          <Toolbar>
            <IconButton edge="start" onClick={() => router.push('/dashboard')}>
              <ArrowBack />
            </IconButton>
            <Box sx={{ ml: 2, flexGrow: 1 }}>
              <Typography variant="h6" fontWeight={700}>
                {project.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {project.description || 'No description'}
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={() => router.push(`/editor/${projectId}`)}
              sx={{
                mr: 2,
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
                },
              }}
            >
              Open Editor
            </Button>
          </Toolbar>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ px: 2 }}>
            <Tab label="Files" />
            <Tab label="Settings" />
          </Tabs>
        </AppBar>

        <Container maxWidth="lg">
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" fontWeight={700}>
                Project Files ({projectFiles.length})
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setAddVideoDialogOpen(true)}
                sx={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
                  },
                }}
              >
                Add Video
              </Button>
            </Box>

            {/* File Upload Zone */}
            {user && (
              <FileUploadZone projectId={projectId} userId={user.uid} acceptedTypes="all" />
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Card sx={{ p: 3, border: 1, borderColor: 'divider', borderRadius: 3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Project Settings
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Project ID:</strong> {project.id}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Created:</strong> {new Date(project.createdAt as any).toLocaleDateString()}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Status:</strong> {project.status}
                </Typography>
                {project.tags && project.tags.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
                      Tags:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {project.tags.map((tag, index) => (
                        <Chip key={index} label={tag} size="small" />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Card>
          </TabPanel>
        </Container>

        {/* Add Video Dialog */}
        <AddVideoDialog
          open={addVideoDialogOpen}
          onClose={() => setAddVideoDialogOpen(false)}
          onVideoUpload={handleVideoUpload}
        />
      </Box>
    </ProtectedRoute>
  );
}
