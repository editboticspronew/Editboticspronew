'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  IconButton,
  Avatar,
  Button,
  useTheme,
  alpha,
  CircularProgress,
  InputBase,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Search,
  PlayArrow,
  MovieCreation,
  AccessTime,
  MoreVert,
  CheckCircle,
  AutoAwesome,
} from '@mui/icons-material';
import {
  FaInstagram,
  FaYoutube,
  FaTiktok,
  FaFacebookF,
  FaXTwitter,
} from 'react-icons/fa6';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import CreateProjectWizard from '@/components/CreateProjectWizard';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchUserProjects } from '@/store/projectsSlice';

function getThumbnailGradient(title: string) {
  const gradients = [
    ['#14b8a6', '#0d9488'],
    ['#6366f1', '#4f46e5'],
    ['#8b5cf6', '#7c3aed'],
    ['#f59e0b', '#d97706'],
    ['#ef4444', '#dc2626'],
    ['#06b6d4', '#0891b2'],
    ['#ec4899', '#db2777'],
    ['#10b981', '#059669'],
  ];
  const idx = title.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % gradients.length;
  return `linear-gradient(135deg, ${gradients[idx][0]} 0%, ${gradients[idx][1]} 100%)`;
}

export default function DashboardPage() {
  const router = useRouter();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { projects, loading, error } = useAppSelector((s) => s.projects);
  const isDark = theme.palette.mode === 'dark';

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');

  useEffect(() => {
    if (user?.uid) dispatch(fetchUserProjects(user.uid));
  }, [user?.uid, dispatch]);

  const formatDate = (date: any) => {
    if (!date) return 'Just now';
    const d = date.toDate ? date.toDate() : new Date(date);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(diff / 3600000);
    if (h < 24) return `${h}h ago`;
    const dd = Math.floor(diff / 86400000);
    if (dd === 1) return 'Yesterday';
    if (dd < 7) return `${dd}d ago`;
    return d.toLocaleDateString();
  };

  const filtered = searchQuery
    ? projects.filter((p) => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : projects;

  const platforms = [
    { icon: <FaInstagram size={22} />, label: 'Instagram', color: '#E1306C' },
    { icon: <FaYoutube size={22} />, label: 'YouTube', color: '#FF0000' },
    { icon: <FaTiktok size={22} />, label: 'TikTok', color: isDark ? '#fff' : '#000' },
    { icon: <FaFacebookF size={20} />, label: 'Facebook', color: '#1877F2' },
    { icon: <FaXTwitter size={20} />, label: 'X / Twitter', color: isDark ? '#fff' : '#000' },
  ];

  return (
    <ProtectedRoute>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>

        {/* HERO SECTION */}
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            px: { xs: 2, sm: 4, md: 6, lg: 8 },
            pt: { xs: 4, md: 6 },
            pb: { xs: 5, md: 7 },
            background: isDark
              ? 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(20,184,166,0.12) 0%, transparent 70%)'
              : 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(13,148,136,0.08) 0%, transparent 70%)',
          }}
        >
          {/* Grid pattern */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              opacity: isDark ? 0.03 : 0.02,
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              pointerEvents: 'none',
            }}
          />

          {/* Create Project Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: { xs: 4, md: 5 }, position: 'relative' }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{
                background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                px: 3,
                py: 1.2,
                fontWeight: 700,
                fontSize: '0.9rem',
                textTransform: 'none',
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(20,184,166,0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                  boxShadow: '0 6px 28px rgba(20,184,166,0.4)',
                  transform: 'translateY(-1px)',
                },
                transition: 'all 0.2s',
              }}
            >
              Create Project
            </Button>
          </Box>

          {/* Main Heading */}
          <Box sx={{ maxWidth: 720, mx: 'auto', textAlign: 'center', position: 'relative' }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: isDark ? alpha('#14b8a6', 0.1) : alpha('#0d9488', 0.08),
                border: 1,
                borderColor: isDark ? alpha('#14b8a6', 0.2) : alpha('#0d9488', 0.15),
                borderRadius: 5,
                px: 2,
                py: 0.5,
                mb: 3,
              }}
            >
              <AutoAwesome sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="caption" fontWeight={600} sx={{ color: 'primary.main', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                Powered by AI
              </Typography>
            </Box>

            <Typography
              variant="h2"
              fontWeight={800}
              sx={{
                fontSize: { xs: '2rem', sm: '2.6rem', md: '3.2rem' },
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                mb: 2,
                background: isDark
                  ? 'linear-gradient(135deg, #fff 30%, #14b8a6 100%)'
                  : 'linear-gradient(135deg, #09090b 30%, #0d9488 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              AI-Powered Video Editor
            </Typography>

            <Typography
              variant="h6"
              sx={{
                color: 'text.secondary',
                fontWeight: 400,
                fontSize: { xs: '0.95rem', sm: '1.1rem' },
                lineHeight: 1.6,
                mb: 4,
                maxWidth: 520,
                mx: 'auto',
              }}
            >
              Create stunning videos in minutes. Let AI handle the editing while you focus on your story.
            </Typography>

            {/* Three feature checks */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'center',
                gap: { xs: 1.5, sm: 3 },
                mb: 5,
              }}
            >
              {[
                'Auto-cut & smart transitions',
                'AI-generated captions & subtitles',
                'One-click social media export',
              ].map((text) => (
                <Box key={text} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Typography variant="body2" fontWeight={500} sx={{ color: 'text.secondary' }}>
                    {text}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* AI Prompt Input */}
            <Box sx={{ maxWidth: 560, mx: 'auto', mb: 1 }}>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{ mb: 1.5, textAlign: 'left', color: 'text.primary' }}
              >
                Describe the video you want to create
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2.5,
                  px: 2,
                  py: 0.5,
                  gap: 1,
                  transition: 'all 0.2s',
                  '&:focus-within': {
                    borderColor: 'primary.main',
                    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.15)}`,
                  },
                }}
              >
                <AutoAwesome sx={{ fontSize: 18, color: 'primary.main', flexShrink: 0 }} />
                <InputBase
                  fullWidth
                  placeholder="e.g. A 30-second Instagram reel about travel tips..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  sx={{ fontSize: '0.9rem', py: 1 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  sx={{
                    background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 2.5,
                    py: 0.8,
                    borderRadius: 2,
                    fontSize: '0.8rem',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    '&:hover': {
                      background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                    },
                  }}
                >
                  Generate
                </Button>
              </Box>
            </Box>

            {/* Social Media Platforms */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontWeight: 500 }}>
                Create for any platform
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 1.5, sm: 2.5 } }}>
                {platforms.map((p) => (
                  <Tooltip title={p.label} key={p.label}>
                    <IconButton
                      sx={{
                        width: 48,
                        height: 48,
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.02),
                        color: 'text.secondary',
                        transition: 'all 0.2s',
                        '&:hover': {
                          color: p.color,
                          borderColor: p.color,
                          bgcolor: alpha(p.color, 0.1),
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      {p.icon}
                    </IconButton>
                  </Tooltip>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* PROJECTS SECTION */}
        <Box sx={{ px: { xs: 2, sm: 4, md: 6, lg: 8 }, py: { xs: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1.5, flexWrap: 'wrap' }}>
            <AccessTime sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={700} letterSpacing="-0.01em">
              Your Projects
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: isDark ? alpha('#fff', 0.04) : alpha('#000', 0.03),
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                gap: 1,
                width: { xs: '100%', sm: 220 },
                order: { xs: 3, sm: 0 },
                transition: 'border-color 0.2s',
                '&:focus-within': { borderColor: 'primary.main' },
              }}
            >
              <Search sx={{ fontSize: 16, color: 'text.secondary' }} />
              <InputBase
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ fontSize: '0.85rem', flex: 1 }}
              />
            </Box>
          </Box>

          {error && (
            <Box
              sx={{
                border: 1,
                borderColor: 'error.main',
                borderRadius: 2,
                p: 2,
                mb: 3,
                bgcolor: alpha(theme.palette.error.main, 0.08),
              }}
            >
              <Typography variant="body2" color="error.main" fontSize="0.85rem">
                {error}
              </Typography>
            </Box>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
              <CircularProgress size={32} />
            </Box>
          ) : filtered.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: { xs: 6, md: 10 },
                border: 1,
                borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
              }}
            >
              <MovieCreation sx={{ fontSize: 56, color: 'text.secondary', mb: 2, opacity: 0.4 }} />
              <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                {searchQuery ? 'No matching projects' : 'No projects yet'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {searchQuery ? 'Try a different search term' : 'Create your first project to start editing'}
              </Typography>
              {!searchQuery && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setCreateDialogOpen(true)}
                  sx={{
                    background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                    px: 3,
                    py: 1,
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': { background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' },
                  }}
                >
                  Create First Project
                </Button>
              )}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)',
                  lg: 'repeat(4, 1fr)',
                },
                gap: 2.5,
              }}
            >
              {filtered.map((project) => (
                <Box
                  key={project.id}
                  onClick={() => router.push(`/project/${project.id}`)}
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 3,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                    '&:hover': {
                      borderColor: isDark ? alpha('#14b8a6', 0.4) : 'primary.main',
                      transform: 'translateY(-4px)',
                      boxShadow: isDark
                        ? '0 20px 40px rgba(0,0,0,0.5)'
                        : '0 20px 40px rgba(0,0,0,0.08)',
                    },
                    '&:hover .play-btn': { opacity: 1, transform: 'scale(1)' },
                    '&:hover .thumb-img': { transform: 'scale(1.06)' },
                  }}
                >
                  <Box sx={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>
                    <Box
                      className="thumb-img"
                      sx={{
                        width: '100%',
                        height: '100%',
                        background: getThumbnailGradient(project.title),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
                      }}
                    >
                      <Typography sx={{ fontSize: '2.8rem', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))' }}>
                        {project.emoji || String.fromCodePoint(0x1F3AC)}
                      </Typography>
                    </Box>

                    <Box
                      className="play-btn"
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(0,0,0,0.45)',
                        backdropFilter: 'blur(2px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transform: 'scale(0.95)',
                        transition: 'all 0.25s',
                      }}
                    >
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: '50%',
                          bgcolor: 'rgba(255,255,255,0.95)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                        }}
                      >
                        <PlayArrow sx={{ fontSize: 28, color: '#111', ml: 0.3 }} />
                      </Box>
                    </Box>

                    {project.duration && (
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 8,
                          right: 8,
                          bgcolor: 'rgba(0,0,0,0.8)',
                          color: '#fff',
                          px: 0.8,
                          py: 0.3,
                          borderRadius: 1,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        {Math.floor(project.duration / 60)}:{(project.duration % 60).toString().padStart(2, '0')}
                      </Box>
                    )}

                    <Box
                      sx={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        bgcolor: 'rgba(0,0,0,0.65)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: 1.5,
                        px: 1,
                        py: 0.4,
                      }}
                    >
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
                      <Typography
                        sx={{
                          color: '#fff',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          lineHeight: 1,
                        }}
                      >
                        {project.status || 'Draft'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight={700} noWrap sx={{ mb: 0.3, fontSize: '0.9rem' }}>
                          {project.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          Edited {formatDate(project.updatedAt)}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/editor/${project.id}`);
                        }}
                        sx={{ mt: -0.3, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                      >
                        <MoreVert sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>

                    {project.tags && project.tags.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 1.2, flexWrap: 'wrap' }}>
                        {project.tags.slice(0, 3).map((tag) => (
                          <Box
                            key={tag}
                            sx={{
                              bgcolor: isDark ? alpha('#14b8a6', 0.1) : alpha('#0d9488', 0.08),
                              color: 'primary.main',
                              px: 1,
                              py: 0.2,
                              borderRadius: 1,
                              fontSize: '0.65rem',
                              fontWeight: 600,
                            }}
                          >
                            {tag}
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <CreateProjectWizard
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
        />
      </Box>
    </ProtectedRoute>
  );
}
