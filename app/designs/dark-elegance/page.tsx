'use client';

/**
 * Design 4: Dark Elegance
 * Near-black background with teal accent. Dense information.
 * Dev-tool aesthetic. Subtle borders, muted tones.
 * Inspired by: Vercel, GitHub, Arc, Linear Dark
 */

import { Box, Container, Typography, Button, IconButton, Avatar, Chip } from '@mui/material';
import { useRouter } from 'next/navigation';
import {
  ArrowBack,
  PlayArrow,
  Add,
  East,
  AutoAwesome,
  VideoLibrary,
  Schedule,
  MoreHoriz,
  KeyboardArrowRight,
  Circle,
  Search,
  Code,
  Speed,
} from '@mui/icons-material';

const C = {
  bg: '#09090b',
  surface: '#18181b',
  surfaceHover: '#1f1f23',
  border: '#27272a',
  borderSubtle: '#1f1f23',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textTertiary: '#52525b',
  accent: '#14b8a6',
  accentMuted: '#0d9488',
  accentSubtle: 'rgba(20, 184, 166, 0.1)',
  accentSubtleBorder: 'rgba(20, 184, 166, 0.2)',
};

export default function DarkEleganceDesign() {
  const router = useRouter();

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh', color: C.text }}>

      {/* Back */}
      <Box sx={{ position: 'fixed', top: 16, left: 16, zIndex: 100 }}>
        <IconButton onClick={() => router.push('/designs')} size="small" sx={{ color: C.textSecondary, '&:hover': { color: C.text } }}>
          <ArrowBack fontSize="small" />
        </IconButton>
      </Box>

      {/* ═══════════════════════════════════════════
          SECTION 1: LANDING / HERO
          ═══════════════════════════════════════════ */}
      <Box sx={{ borderBottom: `1px solid ${C.border}` }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', height: 56, gap: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: C.accent }} />
              <Typography variant="body2" fontWeight={700} letterSpacing="-0.01em">EditBotics</Typography>
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            {['Docs', 'Pricing', 'Changelog'].map((t) => (
              <Typography key={t} variant="body2" sx={{ color: C.textTertiary, cursor: 'pointer', fontSize: '0.85rem', '&:hover': { color: C.textSecondary } }}>
                {t}
              </Typography>
            ))}
            <Button size="small" sx={{ color: C.textSecondary, textTransform: 'none', fontSize: '0.85rem' }}>Log in</Button>
            <Button
              size="small"
              sx={{
                bgcolor: C.text,
                color: C.bg,
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 1.5,
                px: 2,
                fontSize: '0.85rem',
                '&:hover': { bgcolor: '#d4d4d8' },
              }}
            >
              Sign Up
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Hero */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        {/* Subtle grid background */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(${C.border} 1px, transparent 1px), linear-gradient(90deg, ${C.border} 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            opacity: 0.3,
            maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
          }}
        />
        <Container maxWidth="md" sx={{ pt: 14, pb: 16, textAlign: 'center', position: 'relative' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.8,
              border: `1px solid ${C.accentSubtleBorder}`,
              bgcolor: C.accentSubtle,
              borderRadius: 100,
              px: 2,
              py: 0.4,
              mb: 3,
            }}
          >
            <Circle sx={{ fontSize: 6, color: C.accent }} />
            <Typography variant="caption" sx={{ color: C.accent, fontWeight: 500 }}>v2.0 is live</Typography>
          </Box>
          <Typography
            sx={{
              fontSize: { xs: '2.5rem', md: '4rem' },
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: '-0.04em',
              mb: 2.5,
            }}
          >
            Edit videos at
            <br />
            the speed of thought
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: C.textSecondary, fontSize: '1.05rem', maxWidth: 440, mx: 'auto', mb: 5, lineHeight: 1.6 }}
          >
            AI transcription, smart cuts, and one-click export. Built for creators who value precision and speed.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            <Button
              endIcon={<East sx={{ fontSize: 14 }} />}
              sx={{
                bgcolor: C.text,
                color: C.bg,
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 1.5,
                px: 3.5,
                py: 1.2,
                '&:hover': { bgcolor: '#d4d4d8' },
              }}
            >
              Deploy your first edit
            </Button>
            <Button
              sx={{
                color: C.textSecondary,
                border: `1px solid ${C.border}`,
                textTransform: 'none',
                fontWeight: 500,
                borderRadius: 1.5,
                px: 3,
                py: 1.2,
                '&:hover': { bgcolor: C.surface, color: C.text },
              }}
            >
              Read the docs
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Features — horizontal strip */}
      <Box sx={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' } }}>
            {[
              { icon: <AutoAwesome sx={{ fontSize: 18 }} />, title: 'AI-First', desc: 'GPT-4o-mini analyzes every frame' },
              { icon: <Code sx={{ fontSize: 18 }} />, title: 'Browser-Native', desc: 'FFmpeg WASM — no installs' },
              { icon: <Speed sx={{ fontSize: 18 }} />, title: 'Sub-Second Cuts', desc: 'Stream copy for instant clips' },
            ].map((f, i) => (
              <Box
                key={i}
                sx={{
                  p: 3,
                  borderRight: { xs: 'none', md: i < 2 ? `1px solid ${C.border}` : 'none' },
                  borderBottom: { xs: `1px solid ${C.border}`, md: 'none' },
                  display: 'flex',
                  gap: 1.5,
                  alignItems: 'flex-start',
                }}
              >
                <Box sx={{ color: C.accent, mt: 0.2 }}>{f.icon}</Box>
                <Box>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.3 }}>{f.title}</Typography>
                  <Typography variant="caption" sx={{ color: C.textTertiary }}>{f.desc}</Typography>
                </Box>
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

          <Box sx={{ bgcolor: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
            {/* Top bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2, borderBottom: `1px solid ${C.border}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: C.accent }} />
                <Typography variant="body2" fontWeight={600}>Dashboard</Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  border: `1px solid ${C.border}`,
                  borderRadius: 1,
                  px: 1.5,
                  py: 0.4,
                  gap: 1,
                  mr: 2,
                }}
              >
                <Search sx={{ fontSize: 14, color: C.textTertiary }} />
                <Typography variant="caption" sx={{ color: C.textTertiary, fontSize: '0.75rem' }}>Search...</Typography>
                <Box sx={{ border: `1px solid ${C.border}`, borderRadius: 0.5, px: 0.5 }}>
                  <Typography variant="caption" sx={{ color: C.textTertiary, fontSize: '0.6rem' }}>⌘K</Typography>
                </Box>
              </Box>
              <Avatar sx={{ width: 26, height: 26, bgcolor: C.accent, fontSize: '0.7rem' }}>J</Avatar>
            </Box>

            {/* Stats row */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `1px solid ${C.border}` }}>
              {[
                { label: 'Projects', value: '12', delta: '+3' },
                { label: 'Videos', value: '47', delta: '+8' },
                { label: 'Processing', value: '2', delta: '' },
                { label: 'Storage', value: '4.2 GB', delta: '' },
              ].map((s, i) => (
                <Box key={i} sx={{ px: 3, py: 2, borderRight: i < 3 ? `1px solid ${C.border}` : 'none' }}>
                  <Typography variant="caption" sx={{ color: C.textTertiary, display: 'block', mb: 0.5, fontSize: '0.7rem' }}>{s.label}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.8 }}>
                    <Typography variant="h6" fontWeight={600} sx={{ fontFeatureSettings: '"tnum"' }}>{s.value}</Typography>
                    {s.delta && <Typography variant="caption" sx={{ color: C.accent, fontSize: '0.7rem' }}>{s.delta}</Typography>}
                  </Box>
                </Box>
              ))}
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
                    color: C.text,
                    bgcolor: C.surface,
                    border: `1px solid ${C.border}`,
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.8rem',
                    borderRadius: 1,
                    '&:hover': { bgcolor: C.surfaceHover },
                  }}
                >
                  New
                </Button>
              </Box>

              {/* Table-style list */}
              <Box sx={{ border: `1px solid ${C.border}`, borderRadius: 1.5, overflow: 'hidden' }}>
                {/* Header */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 80px 40px', px: 2, py: 1, bgcolor: C.surfaceHover, borderBottom: `1px solid ${C.border}` }}>
                  {['Name', 'Status', 'Clips', 'Updated', ''].map((h) => (
                    <Typography key={h} variant="caption" sx={{ color: C.textTertiary, fontWeight: 500, fontSize: '0.7rem' }}>{h}</Typography>
                  ))}
                </Box>
                {[
                  { name: 'product-launch-v2', status: 'Ready', clips: 8, date: '2m ago' },
                  { name: 'quarterly-review', status: 'Building', clips: 14, date: '1h ago' },
                  { name: 'customer-testimonial', status: 'Ready', clips: 6, date: '3h ago' },
                  { name: 'training-onboard', status: 'Draft', clips: 0, date: '2d ago' },
                ].map((p, i, arr) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 100px 100px 80px 40px',
                      px: 2,
                      py: 1.5,
                      borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: C.surfaceHover },
                      alignItems: 'center',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <VideoLibrary sx={{ fontSize: 14, color: C.textTertiary }} />
                      <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{p.name}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Circle sx={{ fontSize: 6, color: p.status === 'Ready' ? C.accent : p.status === 'Building' ? '#f59e0b' : C.textTertiary }} />
                      <Typography variant="caption" sx={{ color: C.textSecondary }}>{p.status}</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: C.textSecondary, fontFamily: 'monospace' }}>{p.clips}</Typography>
                    <Typography variant="caption" sx={{ color: C.textTertiary }}>{p.date}</Typography>
                    <IconButton size="small"><MoreHoriz sx={{ fontSize: 14, color: C.textTertiary }} /></IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ═══════════════════════════════════════════
          SECTION 3: PROJECT CARDS
          ═══════════════════════════════════════════ */}
      <Box sx={{ py: 8, borderTop: `1px solid ${C.border}` }}>
        <Container maxWidth="lg">
          <Typography variant="overline" sx={{ color: C.textTertiary, letterSpacing: 2, mb: 1.5, display: 'block' }}>
            Project Cards
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
            {[
              { name: 'api-demo-walkthrough', desc: 'Technical product demo for developer audience', date: '12 min ago', status: 'Ready', clips: 5 },
              { name: 'team-standup-highlights', desc: 'Weekly highlights from engineering standups', date: '3 hours ago', status: 'Building', clips: 11 },
              { name: 'conference-talk-edit', desc: 'ReactConf 2025 presentation trimmed to 15 min', date: 'Yesterday', status: 'Ready', clips: 7 },
            ].map((p, i) => (
              <Box
                key={i}
                sx={{
                  bgcolor: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 2,
                  p: 2.5,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: C.textTertiary },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Circle sx={{ fontSize: 8, color: p.status === 'Ready' ? C.accent : '#f59e0b' }} />
                  <Typography variant="caption" sx={{ color: C.textTertiary, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {p.status.toLowerCase()} · {p.date}
                  </Typography>
                </Box>
                <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', mb: 0.5 }}>{p.name}</Typography>
                <Typography variant="caption" sx={{ color: C.textSecondary, display: 'block', lineHeight: 1.5, mb: 2 }}>{p.desc}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: C.textTertiary, fontFamily: 'monospace' }}>{p.clips} clips</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <KeyboardArrowRight sx={{ fontSize: 16, color: C.textTertiary }} />
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ textAlign: 'center', py: 4, borderTop: `1px solid ${C.border}` }}>
        <Typography variant="caption" sx={{ color: C.textTertiary }}>
          Design 4 — Dark Elegance · Click ← to go back
        </Typography>
      </Box>
    </Box>
  );
}
