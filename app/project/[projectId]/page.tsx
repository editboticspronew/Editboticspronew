'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  IconButton,
  Button,
  useTheme,
  alpha,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack,
  PlayArrow,
  Add,
  VideoLibrary,
  AudioFile,
  Image as ImageIcon,
  FolderOpen,
  AutoAwesome,
  ContentCut,
  Speed,
  Storage,
} from '@mui/icons-material';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import FileUploadZone from '@/components/FileUploadZone';
import AddVideoDialog from '@/components/AddVideoDialog';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchUserProjects } from '@/store/projectsSlice';
import { fetchProjectFiles } from '@/store/filesSlice';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const router = useRouter();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { projects } = useAppSelector((s) => s.projects);
  const { files } = useAppSelector((s) => s.files);
  const isDark = theme.palette.mode === 'dark';

  const [addVideoDialogOpen, setAddVideoDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'media' | 'settings'>('media');

  const project = projects.find((p) => p.id === projectId);
  const projectFiles = files.filter((f) => f.projectId === projectId);
  const videoFiles = projectFiles.filter((f) => f.type === 'video');
  const audioFiles = projectFiles.filter((f) => f.type === 'audio');
  const imageFiles = projectFiles.filter((f) => f.type === 'image');
  const totalSize = projectFiles.reduce((sum, f) => sum + (f.size || 0), 0);

  useEffect(() => {
    if (user?.uid && !project) dispatch(fetchUserProjects(user.uid));
  }, [user?.uid, project, dispatch]);

  useEffect(() => {
    if (projectId) dispatch(fetchProjectFiles(projectId));
  }, [projectId, dispatch]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0) + ' ' + sizes[i];
  };
  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  /* ── Project not found ── */
  if (!project) {
    return (
      <ProtectedRoute>
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ textAlign: 'center' }}>
            <FolderOpen sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.35 }} />
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Project not found</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 320 }}>
              This project may have been deleted or you don&apos;t have access.
            </Typography>
            <Button
              onClick={() => router.push('/dashboard')}
              sx={{
                background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                color: '#fff',
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                py: 1,
                borderRadius: 2,
                '&:hover': { background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' },
              }}
            >
              Back to Dashboard
            </Button>
          </Box>
        </Box>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>

        {/* ═══════════ STICKY HEADER ═══════════ */}
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            bgcolor: isDark ? alpha('#09090b', 0.88) : alpha('#ffffff', 0.88),
            backdropFilter: 'blur(16px) saturate(180%)',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {/* Top row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 2, sm: 3, md: 4 }, py: 1.5 }}>
            <Tooltip title="Back to Dashboard">
              <IconButton
                size="small"
                onClick={() => router.push('/dashboard')}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  width: 36,
                  height: 36,
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.06) },
                }}
              >
                <ArrowBack sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>

            {/* Project title + meta */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1" fontWeight={700} noWrap sx={{ letterSpacing: '-0.01em' }}>
                  {project.title}
                </Typography>
                <Box
                  sx={{
                    px: 1,
                    py: 0.2,
                    borderRadius: 1,
                    bgcolor:
                      project.status === 'completed' ? alpha('#14b8a6', isDark ? 0.15 : 0.1)
                      : project.status === 'in-progress' ? alpha('#f59e0b', isDark ? 0.15 : 0.1)
                      : alpha('#71717a', isDark ? 0.15 : 0.1),
                    display: { xs: 'none', sm: 'flex' },
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor:
                        project.status === 'completed' ? '#14b8a6'
                        : project.status === 'in-progress' ? '#f59e0b'
                        : '#71717a',
                    }}
                  />
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'capitalize', color: 'text.secondary' }}>
                    {project.status || 'Draft'}
                  </Typography>
                </Box>
              </Box>
              {project.description && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: -0.2 }}>
                  {project.description}
                </Typography>
              )}
            </Box>

            {/* Action buttons */}
            <Button
              size="small"
              startIcon={<Add sx={{ fontSize: 16 }} />}
              onClick={() => setAddVideoDialogOpen(true)}
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                border: 1,
                borderColor: 'divider',
                color: 'text.primary',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                borderRadius: 2,
                px: 2,
                '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.06) },
              }}
            >
              Add Media
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<PlayArrow sx={{ fontSize: 18 }} />}
              onClick={() => router.push(`/editor/${projectId}`)}
              sx={{
                background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                textTransform: 'none',
                fontWeight: 700,
                px: { xs: 2, sm: 2.5 },
                py: 0.8,
                borderRadius: 2,
                fontSize: '0.85rem',
                boxShadow: '0 2px 12px rgba(20,184,166,0.25)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                  boxShadow: '0 4px 20px rgba(20,184,166,0.35)',
                },
                transition: 'all 0.2s',
              }}
            >
              Open Editor
            </Button>
          </Box>

          {/* Tab row */}
          <Box sx={{ display: 'flex', gap: 0, px: { xs: 2, sm: 3, md: 4 } }}>
            {(['media', 'settings'] as const).map((tab) => (
              <Box
                key={tab}
                onClick={() => setActiveTab(tab)}
                sx={{
                  px: 2,
                  py: 1.2,
                  cursor: 'pointer',
                  borderBottom: 2,
                  borderColor: activeTab === tab ? 'primary.main' : 'transparent',
                  color: activeTab === tab ? 'primary.main' : 'text.secondary',
                  fontSize: '0.85rem',
                  fontWeight: activeTab === tab ? 700 : 500,
                  transition: 'all 0.15s',
                  userSelect: 'none',
                  '&:hover': { color: activeTab === tab ? 'primary.main' : 'text.primary' },
                }}
              >
                {tab === 'media' ? `Media${projectFiles.length > 0 ? ` (${projectFiles.length})` : ''}` : 'Settings'}
              </Box>
            ))}
          </Box>
        </Box>

        {/* ═══════════ PAGE CONTENT ═══════════ */}
        <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, py: 3, maxWidth: 1200, mx: 'auto' }}>

          {activeTab === 'media' ? (
            <>
              {/* ── Quick Stats ── */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                  gap: 1.5,
                  mb: 4,
                }}
              >
                {[
                  { icon: <VideoLibrary sx={{ fontSize: 18 }} />, label: 'Videos', count: videoFiles.length, color: '#14b8a6' },
                  { icon: <AudioFile sx={{ fontSize: 18 }} />, label: 'Audio', count: audioFiles.length, color: '#8b5cf6' },
                  { icon: <ImageIcon sx={{ fontSize: 18 }} />, label: 'Images', count: imageFiles.length, color: '#f59e0b' },
                  { icon: <Storage sx={{ fontSize: 18 }} />, label: 'Total Size', count: -1, display: formatFileSize(totalSize), color: '#6366f1' },
                ].map((stat) => (
                  <Box
                    key={stat.label}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 2,
                      py: 1.5,
                      bgcolor: isDark ? alpha(stat.color, 0.06) : alpha(stat.color, 0.04),
                      border: 1,
                      borderColor: isDark ? alpha(stat.color, 0.12) : alpha(stat.color, 0.1),
                      borderRadius: 2.5,
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: alpha(stat.color, 0.3) },
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 2,
                        bgcolor: alpha(stat.color, isDark ? 0.12 : 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: stat.color,
                      }}
                    >
                      {stat.icon}
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.2, fontFeatureSettings: '"tnum"' }}>
                        {stat.count >= 0 ? stat.count : stat.display}
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500 }}>
                        {stat.label}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              {/* ── AI Quick Actions ── */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  {[
                    { icon: <AutoAwesome sx={{ fontSize: 16 }} />, label: 'AI Auto-Edit', desc: 'Smart cuts & transitions' },
                    { icon: <ContentCut sx={{ fontSize: 16 }} />, label: 'Generate Clips', desc: 'Create highlight reels' },
                    { icon: <Speed sx={{ fontSize: 16 }} />, label: 'Quick Export', desc: 'Export for social media' },
                  ].map((action) => (
                    <Box
                      key={action.label}
                      onClick={() => router.push(`/editor/${projectId}`)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        px: 2,
                        py: 1.5,
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 2.5,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: isDark ? alpha('#14b8a6', 0.4) : 'primary.main',
                          transform: 'translateY(-1px)',
                          boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.06)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: 2,
                          bgcolor: isDark ? alpha('#14b8a6', 0.1) : alpha('#0d9488', 0.08),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'primary.main',
                        }}
                      >
                        {action.icon}
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem', lineHeight: 1.2 }}>
                          {action.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          {action.desc}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* ── Upload Zone + Header ── */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.05rem' }}>
                  Project Media
                </Typography>
                <Button
                  size="small"
                  startIcon={<Add sx={{ fontSize: 16 }} />}
                  onClick={() => setAddVideoDialogOpen(true)}
                  sx={{
                    display: { xs: 'inline-flex', sm: 'none' },
                    background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 2,
                    px: 2,
                    fontSize: '0.8rem',
                    '&:hover': { background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' },
                  }}
                >
                  Add
                </Button>
              </Box>

              {/* Upload zone + file list (handled by FileUploadZone) */}
              {user && (
                <FileUploadZone projectId={projectId} userId={user.uid} acceptedTypes="all" />
              )}
            </>
          ) : (
            /* ═══════════ SETTINGS TAB ═══════════ */
            <Box sx={{ maxWidth: 600 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 2, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Project Information
              </Typography>

              <Box
                sx={{
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                {[
                  { label: 'Project Name', value: project.title },
                  { label: 'Description', value: project.description || 'No description' },
                  { label: 'Status', value: project.status, badge: true },
                  { label: 'Project ID', value: project.id, mono: true },
                  { label: 'Created', value: formatDate(project.createdAt) },
                  { label: 'Total Files', value: `${projectFiles.length} files · ${formatFileSize(totalSize)}` },
                ].map((row, i, arr) => (
                  <Box
                    key={row.label}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 2,
                      px: 2.5,
                      py: 1.8,
                      borderBottom: i < arr.length - 1 ? 1 : 0,
                      borderColor: 'divider',
                      transition: 'background 0.1s',
                      '&:hover': { bgcolor: isDark ? alpha('#fff', 0.02) : alpha('#000', 0.015) },
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ fontSize: '0.85rem', flexShrink: 0 }}>
                      {row.label}
                    </Typography>
                    {row.badge ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            bgcolor:
                              project.status === 'completed' ? '#14b8a6'
                              : project.status === 'in-progress' ? '#f59e0b'
                              : '#71717a',
                          }}
                        />
                        <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                          {row.value}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        noWrap
                        sx={{
                          fontSize: '0.85rem',
                          minWidth: 0,
                          textAlign: 'right',
                          ...(row.mono && { fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }),
                        }}
                      >
                        {row.value}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>

              {/* Tags */}
              {project.tags && project.tags.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Tags
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {project.tags.map((tag) => (
                      <Box
                        key={tag}
                        sx={{
                          bgcolor: isDark ? alpha('#14b8a6', 0.1) : alpha('#0d9488', 0.07),
                          color: 'primary.main',
                          px: 1.5,
                          py: 0.4,
                          borderRadius: 1.5,
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          border: 1,
                          borderColor: isDark ? alpha('#14b8a6', 0.15) : alpha('#0d9488', 0.1),
                        }}
                      >
                        {tag}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Danger zone placeholder */}
              <Box sx={{ mt: 5 }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 2, color: 'error.main', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Danger Zone
                </Typography>
                <Box
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: alpha(theme.palette.error.main, 0.2),
                    borderRadius: 3,
                    px: 2.5,
                    py: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                      Delete Project
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Permanently delete this project and all its files.
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    sx={{
                      color: 'error.main',
                      border: 1,
                      borderColor: alpha(theme.palette.error.main, 0.3),
                      textTransform: 'none',
                      fontWeight: 600,
                      borderRadius: 2,
                      fontSize: '0.8rem',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.error.main, 0.08),
                        borderColor: 'error.main',
                      },
                    }}
                  >
                    Delete
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </Box>

        {/* Add Video Dialog */}
        <AddVideoDialog
          open={addVideoDialogOpen}
          onClose={() => setAddVideoDialogOpen(false)}
          projectId={projectId}
          userId={user?.uid || ''}
        />
      </Box>
    </ProtectedRoute>
  );
}
