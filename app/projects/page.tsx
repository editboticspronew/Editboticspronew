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
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Chip,
  Menu,
  MenuItem,
  useTheme,
  alpha,
  Fab,
} from '@mui/material';
import {
  ArrowBack,
  Add,
  MoreVert,
  Edit,
  Delete,
  PlayArrow,
} from '@mui/icons-material';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import CreateProjectWizard from '@/components/CreateProjectWizard';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchUserProjects, deleteProject } from '@/store/projectsSlice';

export default function ProjectsPage() {
  const router = useRouter();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { projects, loading, error } = useAppSelector((state) => state.projects);
  const isDark = theme.palette.mode === 'dark';

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) {
      dispatch(fetchUserProjects(user.uid));
    }
  }, [user?.uid, dispatch]);

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      await dispatch(deleteProject(projectId));
    }
    setMenuAnchor(null);
  };

  const formatDate = (date: any) => {
    if (!date) return 'Just now';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined 
    });
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
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Toolbar>
            <IconButton edge="start" onClick={() => router.push('/dashboard')} sx={{ mr: 2 }}>
              <ArrowBack />
            </IconButton>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" fontWeight={700}>
                Projects
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{ 
                display: { xs: 'none', sm: 'inline-flex' },
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              }}
            >
              New Project
            </Button>
          </Toolbar>
        </AppBar>

        <Container maxWidth="md" sx={{ mt: 3 }}>
          {error && (
            <Card 
              elevation={0}
              sx={{ 
                border: 1,
                borderColor: 'error.main',
                borderRadius: 2,
                textAlign: 'center',
                py: 2,
                mb: 3,
                bgcolor: alpha(theme.palette.error.main, 0.1),
              }}
            >
              <Typography variant="body2" color="error.main">
                {error}
              </Typography>
            </Card>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
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
                py: 8,
              }}
            >
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                No projects yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create your first project to start editing videos
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setCreateDialogOpen(true)}
                sx={{ 
                  background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                }}
              >
                Create Project
              </Button>
            </Card>
          ) : (
            <Box sx={{ display: 'grid', gap: 2 }}>
              {projects.map((project) => (
                <Card 
                  key={project.id}
                  elevation={0}
                  sx={{ 
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    transition: 'all 0.2s',
                    '&:hover': { 
                      borderColor: 'primary.main',
                      boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'start', gap: 2 }}>
                      {/* Thumbnail */}
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: 2,
                          background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2rem',
                          flexShrink: 0,
                        }}
                      >
                        {project.thumbnail || '🎬'}
                      </Box>

                      {/* Content */}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                          {project.title}
                        </Typography>
                        {project.description && (
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ 
                              mb: 1.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {project.description}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Chip
                            label={project.status}
                            size="small"
                            color={
                              project.status === 'completed' ? 'success' : 
                              project.status === 'in-progress' ? 'primary' : 
                              'default'
                            }
                          />
                          <Typography variant="caption" color="text.secondary">
                            Updated {formatDate(project.updatedAt)}
                          </Typography>
                          {project.tags && project.tags.map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20 }}
                            />
                          ))}
                        </Box>
                      </Box>

                      {/* Actions */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/editor/${project.id}`)}
                          sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.2),
                            },
                          }}
                        >
                          <PlayArrow />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            setMenuAnchor(e.currentTarget);
                            setSelectedProject(project.id);
                          }}
                        >
                          <MoreVert />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
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
            display: { sm: 'none' },
            '&:hover': {
              background: 'linear-gradient(135deg, #4f46e5 0%, #d946ef 100%)',
            },
          }}
        >
          <Add />
        </Fab>

        {/* Context Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem onClick={() => {
            if (selectedProject) router.push(`/editor/${selectedProject}`);
            setMenuAnchor(null);
          }}>
            <Edit sx={{ mr: 1, fontSize: 20 }} /> Edit
          </MenuItem>
          <MenuItem onClick={() => {
            if (selectedProject) handleDeleteProject(selectedProject);
          }}>
            <Delete sx={{ mr: 1, fontSize: 20 }} color="error" /> Delete
          </MenuItem>
        </Menu>

        {/* Create Project Wizard */}
        <CreateProjectWizard 
          open={createDialogOpen} 
          onClose={() => setCreateDialogOpen(false)} 
        />
      </Box>
    </ProtectedRoute>
  );
}
