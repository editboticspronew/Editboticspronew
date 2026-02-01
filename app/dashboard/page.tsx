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
  Avatar,
  Fab,
  Card,
  CardContent,
  useTheme,
  alpha,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  VideoLibrary,
  TrendingUp,
  Schedule,
  Folder,
} from '@mui/icons-material';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import CreateProjectWizard from '@/components/CreateProjectWizard';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchUserProjects } from '@/store/projectsSlice';

export default function DashboardPage() {
  const router = useRouter();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { projects, loading, error } = useAppSelector((state) => state.projects);
  const isDark = theme.palette.mode === 'dark';
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      dispatch(fetchUserProjects(user.uid));
    }
  }, [user?.uid, dispatch]);

  const stats = [
    { label: 'Projects', value: projects.length.toString(), icon: VideoLibrary, color: '#6366f1' },
    { label: 'Hours Saved', value: '48', icon: Schedule, color: '#ec4899' },
    { label: 'Growth', value: '+24%', icon: TrendingUp, color: '#10b981' },
  ];

  const formatDate = (date: any) => {
    if (!date) return 'Just now';
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <ProtectedRoute>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 10 }}>
        {/* Header */}
        <AppBar 
          position="sticky" 
          elevation={0}
          sx={{ 
            bgcolor: 'background.paper',
            backdropFilter: 'blur(20px)',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Toolbar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Welcome back,
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {user?.displayName?.split(' ')[0] || 'Creator'} 👋
              </Typography>
            </Box>
            <IconButton onClick={() => router.push('/settings')} sx={{ mr: 1 }}>
              <SettingsIcon />
            </IconButton>
            <IconButton onClick={() => router.push('/profile')}>
              <Avatar
                src={user?.photoURL || undefined}
                sx={{ 
                  width: 36, 
                  height: 36,
                  background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                }}
              >
                {user?.displayName?.[0] || user?.email?.[0] || 'U'}
              </Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth="sm" sx={{ mt: 3 }}>
          {/* Stats Cards */}
          <Box 
            sx={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1.5,
              mb: 4,
            }}
          >
            {stats.map((stat, index) => (
              <Card 
                key={index}
                elevation={0}
                sx={{ 
                  background: isDark
                    ? alpha(stat.color, 0.1)
                    : alpha(stat.color, 0.05),
                  border: 1,
                  borderColor: alpha(stat.color, 0.2),
                  borderRadius: 3,
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <stat.icon sx={{ fontSize: 24, color: stat.color, mb: 1 }} />
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5 }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {stat.label}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Quick Actions */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2, px: 1 }}>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
              <Card 
                elevation={0}
                onClick={() => setCreateDialogOpen(true)}
                sx={{ 
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'scale(1.02)' },
                  borderRadius: 3,
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <AddIcon sx={{ fontSize: 32, mb: 1 }} />
                  <Typography variant="body1" fontWeight={700}>
                    New Project
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Start editing
                  </Typography>
                </CardContent>
              </Card>

              <Card 
                elevation={0}
                onClick={() => router.push('/files')}
                sx={{ 
                  background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'scale(1.02)' },
                  borderRadius: 3,
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Folder sx={{ fontSize: 32, mb: 1 }} />
                  <Typography variant="body1" fontWeight={700}>
                    Browse Files
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Your library
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Recent Projects */}
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2, px: 1 }}>
              Recent Projects
            </Typography>
            
            {error && (
              <Card 
                elevation={0}
                sx={{ 
                  border: 1,
                  borderColor: 'error.main',
                  borderRadius: 3,
                  textAlign: 'center',
                  py: 2,
                  mb: 2,
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                }}
              >
                <Typography variant="body2" color="error.main">
                  {error}
                </Typography>
              </Card>
            )}
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : projects.length === 0 ? (
              <Card 
                elevation={0}
                sx={{ 
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 3,
                  textAlign: 'center',
                  py: 4,
                }}
              >
                <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                  No projects yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Click the + button to create your first project
                </Typography>
              </Card>
            ) : (
              projects.slice(0, 5).map((project) => (
                <Card 
                  key={project.id}
                  elevation={0}
                  onClick={() => router.push(`/project/${project.id}`)}
                  sx={{ 
                    mb: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { 
                      borderColor: 'primary.main',
                      transform: 'translateX(4px)',
                    },
                  }}
                >
                  <CardContent sx={{ 
                    p: 2, 
                    '&:last-child': { pb: 2 },
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 1,
                          background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem',
                        }}
                      >
                        {project.thumbnail || '🎬'}
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" fontWeight={700}>
                          {project.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(project.updatedAt)}
                          </Typography>
                          {project.tags && project.tags.length > 0 && (
                            <>
                              <Typography variant="caption" color="text.secondary">•</Typography>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {project.tags.slice(0, 2).map((tag) => (
                                  <Chip
                                    key={tag}
                                    label={tag}
                                    size="small"
                                    sx={{ height: 18, fontSize: '0.7rem' }}
                                  />
                                ))}
                              </Box>
                            </>
                          )}
                        </Box>
                      </Box>
                      <Chip
                        label={project.status}
                        size="small"
                        color={project.status === 'completed' ? 'success' : project.status === 'in-progress' ? 'primary' : 'default'}
                      />
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        </Container>

        {/* Floating Action Button */}
        <Fab
          color="primary"
          onClick={() => setCreateDialogOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            width: 64,
            height: 64,
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
            '&:hover': {
              background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
              transform: 'scale(1.05)',
            },
            transition: 'all 0.3s',
          }}
        >
          <AddIcon sx={{ fontSize: 32 }} />
        </Fab>

        {/* Create Project Wizard */}
        <CreateProjectWizard 
          open={createDialogOpen} 
          onClose={() => setCreateDialogOpen(false)} 
        />
      </Box>
    </ProtectedRoute>
  );
}
