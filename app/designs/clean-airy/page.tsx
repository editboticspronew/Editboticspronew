'use client';

/**
 * Design 5: Clean Airy
 * Light with soft blue-grey palette. Rounded corners.
 * Generous spacing. Friendly but professional.
 * Inspired by: Figma, Loom, Pitch, Notion
 */

import { Box, Container, Typography, Button, IconButton, Avatar, Chip } from '@mui/material';
import { useRouter } from 'next/navigation';
import {
  ArrowBack,
  PlayArrow,
  Add,
  AutoAwesome,
  VideoLibrary,
  Schedule,
  MoreHoriz,
  KeyboardArrowRight,
  TrendingUp,
  CloudDone,
  Search,
  Notifications,
  WorkspacePremium,
} from '@mui/icons-material';

const C = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  border: '#e2e8f0',
  borderSubtle: '#f1f5f9',
  text: '#1e293b',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  accent: '#6366f1',
  accentSoft: '#eef2ff',
  accentSoftBorder: '#c7d2fe',
  success: '#22c55e',
  successSoft: '#f0fdf4',
};

export default function CleanAiryDesign() {
  const router = useRouter();

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh', color: C.text }}>

      {/* Back */}
      <Box sx={{ position: 'fixed', top: 16, left: 16, zIndex: 100 }}>
        <IconButton onClick={() => router.push('/designs')} size="small" sx={{ color: C.textSecondary, bgcolor: C.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', '&:hover': { bgcolor: C.surfaceAlt } }}>
          <ArrowBack fontSize="small" />
        </IconButton>
      </Box>

      {/* ═══════════════════════════════════════════
          SECTION 1: LANDING / HERO
          ═══════════════════════════════════════════ */}
      <Box sx={{ bgcolor: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', height: 60, gap: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 30, height: 30, borderRadius: 2, bgcolor: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PlayArrow sx={{ fontSize: 18, color: '#fff' }} />
              </Box>
              <Typography variant="body1" fontWeight={700} letterSpacing="-0.01em">ClipWeave</Typography>
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            {['Features', 'Pricing', 'Resources'].map((t) => (
              <Typography key={t} variant="body2" sx={{ color: C.textSecondary, cursor: 'pointer', fontWeight: 500, '&:hover': { color: C.text } }}>
                {t}
              </Typography>
            ))}
            <Button size="small" sx={{ color: C.textSecondary, textTransform: 'none', fontWeight: 500 }}>Log in</Button>
            <Button
              size="small"
              sx={{
                bgcolor: C.accent,
                color: '#fff',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 2.5,
                px: 2.5,
                boxShadow: '0 1px 3px rgba(99,102,241,0.3)',
                '&:hover': { bgcolor: '#4f46e5' },
              }}
            >
              Get Started Free
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Hero */}
      <Box sx={{ bgcolor: C.surface, pb: 8 }}>
        <Container maxWidth="md" sx={{ pt: 10, textAlign: 'center' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.8,
              bgcolor: C.accentSoft,
              border: `1px solid ${C.accentSoftBorder}`,
              borderRadius: 100,
              px: 2,
              py: 0.5,
              mb: 3,
            }}
          >
            <WorkspacePremium sx={{ fontSize: 14, color: C.accent }} />
            <Typography variant="caption" sx={{ color: C.accent, fontWeight: 600 }}>Trusted by 2,000+ creators</Typography>
          </Box>
          <Typography
            sx={{
              fontSize: { xs: '2.25rem', md: '3.5rem' },
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              mb: 2,
            }}
          >
            Your videos, polished
            <br />
            in minutes
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: C.textSecondary, fontSize: '1.1rem', maxWidth: 480, mx: 'auto', mb: 5, lineHeight: 1.6 }}
          >
            Upload, let AI do the heavy lifting, and export a professional edit. Simple, fast, and delightful to use.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            <Button
              sx={{
                bgcolor: C.accent,
                color: '#fff',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 2.5,
                px: 4,
                py: 1.3,
                fontSize: '0.95rem',
                boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                '&:hover': { bgcolor: '#4f46e5' },
              }}
            >
              Try it free
            </Button>
            <Button
              sx={{
                color: C.textSecondary,
                border: `1px solid ${C.border}`,
                textTransform: 'none',
                fontWeight: 500,
                borderRadius: 2.5,
                px: 3,
                py: 1.3,
                bgcolor: C.surface,
                '&:hover': { bgcolor: C.surfaceAlt },
              }}
            >
              Watch demo
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Features — card style */}
      <Box sx={{ py: 6 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
            {[
              { icon: <AutoAwesome sx={{ fontSize: 22, color: C.accent }} />, title: 'Smart AI Editing', desc: 'Automatic transcription, filler removal, and intelligent scene cuts.' },
              { icon: <VideoLibrary sx={{ fontSize: 22, color: C.accent }} />, title: 'Visual Timeline', desc: 'Drag-and-drop editing with waveform and multi-track support.' },
              { icon: <CloudDone sx={{ fontSize: 22, color: C.accent }} />, title: 'Cloud Workspace', desc: 'Access your projects anywhere. All processing in the browser.' },
            ].map((f, i) => (
              <Box
                key={i}
                sx={{
                  bgcolor: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  p: 3,
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: C.accentSoftBorder, boxShadow: '0 4px 12px rgba(99,102,241,0.06)' },
                }}
              >
                <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: C.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                  {f.icon}
                </Box>
                <Typography variant="body1" fontWeight={600} sx={{ mb: 0.5 }}>{f.title}</Typography>
                <Typography variant="body2" sx={{ color: C.textSecondary, lineHeight: 1.6 }}>{f.desc}</Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ═══════════════════════════════════════════
          SECTION 2: DASHBOARD PREVIEW
          ═══════════════════════════════════════════ */}
      <Box sx={{ py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="overline" sx={{ color: C.textTertiary, letterSpacing: 2, mb: 1.5, display: 'block' }}>
            Dashboard
          </Typography>

          <Box sx={{ bgcolor: C.surface, border: `1px solid ${C.border}`, borderRadius: 3, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            {/* Top bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2, borderBottom: `1px solid ${C.border}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 26, height: 26, borderRadius: 1.5, bgcolor: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlayArrow sx={{ fontSize: 14, color: '#fff' }} />
                </Box>
                <Typography variant="body2" fontWeight={700}>My Workspace</Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    bgcolor: C.surfaceAlt,
                    border: `1px solid ${C.border}`,
                    borderRadius: 2,
                    px: 1.5,
                    py: 0.5,
                    gap: 0.8,
                  }}
                >
                  <Search sx={{ fontSize: 16, color: C.textTertiary }} />
                  <Typography variant="caption" sx={{ color: C.textTertiary }}>Search projects...</Typography>
                </Box>
                <IconButton size="small"><Notifications sx={{ fontSize: 18, color: C.textSecondary }} /></IconButton>
                <Avatar sx={{ width: 30, height: 30, bgcolor: C.accent, fontSize: '0.8rem', fontWeight: 700 }}>J</Avatar>
              </Box>
            </Box>

            {/* Welcome + stats */}
            <Box sx={{ p: 3, borderBottom: `1px solid ${C.border}` }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Good morning, John</Typography>
              <Typography variant="body2" sx={{ color: C.textSecondary, mb: 3 }}>Pick up where you left off</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
                {[
                  { icon: <VideoLibrary sx={{ fontSize: 18 }} />, label: 'Projects', value: '9', color: C.accent },
                  { icon: <Schedule sx={{ fontSize: 18 }} />, label: 'Hours Saved', value: '67', color: '#f59e0b' },
                  { icon: <TrendingUp sx={{ fontSize: 18 }} />, label: 'This Month', value: '+12', color: C.success },
                  { icon: <CloudDone sx={{ fontSize: 18 }} />, label: 'Storage', value: '1.8 GB', color: C.textSecondary },
                ].map((s, i) => (
                  <Box
                    key={i}
                    sx={{
                      bgcolor: C.surfaceAlt,
                      borderRadius: 2.5,
                      p: 2,
                    }}
                  >
                    <Box sx={{ color: s.color, mb: 1 }}>{s.icon}</Box>
                    <Typography variant="h6" fontWeight={700}>{s.value}</Typography>
                    <Typography variant="caption" sx={{ color: C.textTertiary }}>{s.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Project list */}
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" fontWeight={600}>Recent Projects</Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                  startIcon={<Add sx={{ fontSize: 14 }} />}
                  size="small"
                  sx={{
                    bgcolor: C.accent,
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 2,
                    fontSize: '0.8rem',
                    boxShadow: '0 1px 3px rgba(99,102,241,0.2)',
                    '&:hover': { bgcolor: '#4f46e5' },
                  }}
                >
                  New Project
                </Button>
              </Box>

              {[
                { name: 'Product Launch Video', desc: 'Final review before publish', date: '30 min ago', status: 'active', clips: 8 },
                { name: 'Social Media Pack', desc: '6 short-form clips for Instagram', date: 'Yesterday', status: 'done', clips: 6 },
                { name: 'Customer Interview', desc: 'Awaiting client feedback', date: '3 days ago', status: 'active', clips: 10 },
                { name: 'Tutorial: Quick Start', desc: 'Episode 2 of the series', date: 'Last week', status: 'draft', clips: 3 },
              ].map((p, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 2,
                    mb: 1,
                    borderRadius: 2,
                    cursor: 'pointer',
                    border: `1px solid transparent`,
                    '&:hover': { bgcolor: C.surfaceAlt, border: `1px solid ${C.border}` },
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: p.status === 'done' ? C.successSoft : C.accentSoft,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                    }}
                  >
                    <PlayArrow sx={{ fontSize: 18, color: p.status === 'done' ? C.success : C.accent }} />
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                    <Typography variant="caption" sx={{ color: C.textTertiary }}>{p.desc} · {p.clips} clips</Typography>
                  </Box>
                  <Chip
                    label={p.status === 'done' ? 'Completed' : p.status === 'active' ? 'Active' : 'Draft'}
                    size="small"
                    sx={{
                      height: 24,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      bgcolor: p.status === 'done' ? C.successSoft : p.status === 'active' ? C.accentSoft : C.surfaceAlt,
                      color: p.status === 'done' ? '#166534' : p.status === 'active' ? C.accent : C.textSecondary,
                      border: 'none',
                      mr: 1,
                    }}
                  />
                  <Typography variant="caption" sx={{ color: C.textTertiary, mr: 1.5, minWidth: 70, textAlign: 'right' }}>{p.date}</Typography>
                  <IconButton size="small"><MoreHoriz sx={{ fontSize: 16, color: C.textTertiary }} /></IconButton>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ═══════════════════════════════════════════
          SECTION 3: PROJECT CARDS
          ═══════════════════════════════════════════ */}
      <Box sx={{ py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="overline" sx={{ color: C.textTertiary, letterSpacing: 2, mb: 1.5, display: 'block' }}>
            Project Cards
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2.5 }}>
            {[
              { name: 'Webinar Highlights', desc: 'Best moments from the Q1 webinar, edited to 5 minutes', emoji: '🎤', date: 'Today', clips: 9 },
              { name: 'App Demo Reel', desc: 'Walkthrough of new features for the marketing team', emoji: '📱', date: 'Yesterday', clips: 5 },
              { name: 'Weekly Vlog #14', desc: 'Behind the scenes of the product design process', emoji: '🎬', date: '3 days ago', clips: 12 },
            ].map((p, i) => (
              <Box
                key={i}
                sx={{
                  bgcolor: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: C.accentSoftBorder, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', transform: 'translateY(-2px)' },
                }}
              >
                {/* Thumbnail placeholder */}
                <Box sx={{ height: 120, bgcolor: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: C.surface,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                  >
                    {p.emoji}
                  </Box>
                </Box>
                <Box sx={{ p: 2.5 }}>
                  <Typography variant="body1" fontWeight={600} sx={{ mb: 0.5 }}>{p.name}</Typography>
                  <Typography variant="body2" sx={{ color: C.textSecondary, lineHeight: 1.6, mb: 2 }}>{p.desc}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Chip
                      label={`${p.clips} clips`}
                      size="small"
                      sx={{ height: 22, fontSize: '0.7rem', bgcolor: C.surfaceAlt, color: C.textSecondary, border: 'none' }}
                    />
                    <Box sx={{ flexGrow: 1 }} />
                    <Typography variant="caption" sx={{ color: C.textTertiary }}>{p.date}</Typography>
                    <KeyboardArrowRight sx={{ fontSize: 16, color: C.textTertiary, ml: 0.5 }} />
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ textAlign: 'center', py: 4, borderTop: `1px solid ${C.border}` }}>
        <Typography variant="caption" sx={{ color: C.textTertiary }}>
          Design 5 — Clean Airy · Click ← to go back
        </Typography>
      </Box>
    </Box>
  );
}
