'use client';

/**
 * Design 1: Minimal Mono
 * Pure black/white/grey. Thin 1px borders. Maximum whitespace.
 * Typography-driven. No color except hover states.
 * Inspired by: Apple, Stripe, Linear
 */

import { Box, Container, Typography, Button, IconButton, Avatar, Chip } from '@mui/material';
import { useRouter } from 'next/navigation';
import {
  ArrowBack,
  PlayArrow,
  Add,
  MoreHoriz,
  VideoLibrary,
  AutoAwesome,
  Speed,
  KeyboardArrowRight,
  Search,
  Notifications,
} from '@mui/icons-material';

const COLORS = {
  bg: '#ffffff',
  surface: '#fafafa',
  border: '#e5e5e5',
  text: '#0a0a0a',
  textSecondary: '#737373',
  textTertiary: '#a3a3a3',
  hover: '#f5f5f5',
  accent: '#0a0a0a',
};

export default function MinimalMonoDesign() {
  const router = useRouter();

  return (
    <Box sx={{ bgcolor: COLORS.bg, minHeight: '100vh', color: COLORS.text }}>

      {/* Back to picker */}
      <Box sx={{ position: 'fixed', top: 16, left: 16, zIndex: 100 }}>
        <IconButton onClick={() => router.push('/designs')} size="small" sx={{ color: COLORS.textSecondary }}>
          <ArrowBack fontSize="small" />
        </IconButton>
      </Box>

      {/* ═══════════════════════════════════════════
          SECTION 1: LANDING / HERO
          ═══════════════════════════════════════════ */}
      <Box sx={{ borderBottom: `1px solid ${COLORS.border}` }}>
        {/* Nav */}
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', height: 56, gap: 4 }}>
            <Typography variant="body1" fontWeight={700} letterSpacing="-0.02em">
              EditBotics
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            {['Product', 'Pricing', 'Docs'].map((item) => (
              <Typography
                key={item}
                variant="body2"
                sx={{ color: COLORS.textSecondary, cursor: 'pointer', '&:hover': { color: COLORS.text } }}
              >
                {item}
              </Typography>
            ))}
            <Button
              size="small"
              sx={{
                color: COLORS.text,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 500,
                px: 2,
                '&:hover': { bgcolor: COLORS.hover, borderColor: COLORS.textSecondary },
              }}
            >
              Sign in
            </Button>
            <Button
              size="small"
              sx={{
                bgcolor: COLORS.accent,
                color: '#fff',
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 500,
                px: 2,
                '&:hover': { bgcolor: '#333' },
              }}
            >
              Get Started
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Hero */}
      <Container maxWidth="md" sx={{ pt: 12, pb: 14, textAlign: 'center' }}>
        <Chip
          label="v2.0 — AI-powered editing"
          size="small"
          sx={{
            bgcolor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            color: COLORS.textSecondary,
            fontWeight: 500,
            fontSize: '0.75rem',
            mb: 3,
          }}
        />
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '2.5rem', md: '4rem' },
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            mb: 2.5,
          }}
        >
          Video editing,
          <br />
          simplified.
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: COLORS.textSecondary,
            fontSize: '1.125rem',
            maxWidth: 480,
            mx: 'auto',
            mb: 5,
            lineHeight: 1.6,
          }}
        >
          Professional AI-powered tools that turn hours of editing into minutes. No complexity, just results.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
          <Button
            sx={{
              bgcolor: COLORS.accent,
              color: '#fff',
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              py: 1.2,
              fontSize: '0.95rem',
              '&:hover': { bgcolor: '#333' },
            }}
          >
            Start for free
          </Button>
          <Button
            sx={{
              color: COLORS.textSecondary,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              px: 3,
              py: 1.2,
              '&:hover': { bgcolor: COLORS.hover },
            }}
          >
            Watch demo
          </Button>
        </Box>
      </Container>

      {/* Feature list — minimal horizontal */}
      <Box sx={{ borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', py: 5, gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { icon: <AutoAwesome sx={{ fontSize: 20 }} />, title: 'AI Editing', desc: 'Smart cuts & transcription' },
              { icon: <VideoLibrary sx={{ fontSize: 20 }} />, title: 'Multi-track Timeline', desc: 'Professional NLE workflow' },
              { icon: <Speed sx={{ fontSize: 20 }} />, title: 'Instant Export', desc: 'Browser-based rendering' },
            ].map((f, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, maxWidth: 240 }}>
                <Box sx={{ color: COLORS.textSecondary, mt: 0.3 }}>{f.icon}</Box>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{f.title}</Typography>
                  <Typography variant="caption" sx={{ color: COLORS.textSecondary }}>{f.desc}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ═══════════════════════════════════════════
          SECTION 2: DASHBOARD PREVIEW
          ═══════════════════════════════════════════ */}
      <Box sx={{ bgcolor: COLORS.surface, py: 8, borderBottom: `1px solid ${COLORS.border}` }}>
        <Container maxWidth="lg">
          <Typography variant="overline" sx={{ color: COLORS.textTertiary, letterSpacing: 2, mb: 1, display: 'block' }}>
            Dashboard
          </Typography>

          <Box sx={{ bgcolor: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 2, overflow: 'hidden' }}>
            {/* Dashboard Top Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2, borderBottom: `1px solid ${COLORS.border}` }}>
              <Typography variant="body1" fontWeight={600}>Dashboard</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 1.5,
                    px: 1.5,
                    py: 0.5,
                    gap: 1,
                  }}
                >
                  <Search sx={{ fontSize: 16, color: COLORS.textTertiary }} />
                  <Typography variant="caption" sx={{ color: COLORS.textTertiary }}>Search...</Typography>
                  <Typography variant="caption" sx={{ color: COLORS.textTertiary, border: `1px solid ${COLORS.border}`, borderRadius: 0.5, px: 0.5, fontSize: '0.65rem' }}>⌘K</Typography>
                </Box>
                <IconButton size="small"><Notifications sx={{ fontSize: 18, color: COLORS.textSecondary }} /></IconButton>
                <Avatar sx={{ width: 28, height: 28, bgcolor: COLORS.text, fontSize: '0.75rem' }}>J</Avatar>
              </Box>
            </Box>

            {/* Stats Row */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `1px solid ${COLORS.border}` }}>
              {[
                { label: 'Total Projects', value: '12' },
                { label: 'Videos Processed', value: '47' },
                { label: 'Hours Saved', value: '86' },
                { label: 'Storage Used', value: '2.4 GB' },
              ].map((stat, i) => (
                <Box
                  key={i}
                  sx={{
                    px: 3,
                    py: 2.5,
                    borderRight: i < 3 ? `1px solid ${COLORS.border}` : 'none',
                  }}
                >
                  <Typography variant="caption" sx={{ color: COLORS.textTertiary, display: 'block', mb: 0.5 }}>
                    {stat.label}
                  </Typography>
                  <Typography variant="h5" fontWeight={600} letterSpacing="-0.02em">
                    {stat.value}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Recent Projects */}
            <Box sx={{ px: 3, py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" fontWeight={600}>Recent Projects</Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                  size="small"
                  startIcon={<Add sx={{ fontSize: 16 }} />}
                  sx={{
                    color: COLORS.text,
                    bgcolor: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 1.5,
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.8rem',
                    '&:hover': { bgcolor: COLORS.hover },
                  }}
                >
                  New Project
                </Button>
              </Box>

              {[
                { name: 'Product Launch Video', status: 'In Progress', date: 'Mar 4', clips: 8 },
                { name: 'Quarterly Review', status: 'Completed', date: 'Mar 2', clips: 14 },
                { name: 'Tutorial: Getting Started', status: 'Draft', date: 'Feb 28', clips: 5 },
                { name: 'Customer Testimonial', status: 'In Progress', date: 'Feb 25', clips: 11 },
              ].map((p, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    py: 1.5,
                    borderBottom: i < 3 ? `1px solid ${COLORS.border}` : 'none',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: COLORS.hover },
                    mx: -1,
                    px: 1,
                    borderRadius: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1,
                      border: `1px solid ${COLORS.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                    }}
                  >
                    <PlayArrow sx={{ fontSize: 16, color: COLORS.textSecondary }} />
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={500}>{p.name}</Typography>
                    <Typography variant="caption" sx={{ color: COLORS.textTertiary }}>{p.clips} clips · {p.date}</Typography>
                  </Box>
                  <Chip
                    label={p.status}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      bgcolor: p.status === 'Completed' ? '#f0fdf4' : p.status === 'In Progress' ? '#fefce8' : COLORS.surface,
                      color: p.status === 'Completed' ? '#166534' : p.status === 'In Progress' ? '#854d0e' : COLORS.textSecondary,
                      border: `1px solid ${p.status === 'Completed' ? '#bbf7d0' : p.status === 'In Progress' ? '#fef08a' : COLORS.border}`,
                    }}
                  />
                  <IconButton size="small" sx={{ ml: 1 }}>
                    <MoreHoriz sx={{ fontSize: 16, color: COLORS.textTertiary }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ═══════════════════════════════════════════
          SECTION 3: PROJECT CARDS PREVIEW
          ═══════════════════════════════════════════ */}
      <Box sx={{ py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="overline" sx={{ color: COLORS.textTertiary, letterSpacing: 2, mb: 1, display: 'block' }}>
            Project Cards
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
            {[
              { name: 'Brand Campaign', desc: 'Social media cuts for Q2 launch campaign', date: '2 hours ago', clips: 6, status: 'active' },
              { name: 'Interview Series', desc: 'Episode 3 — CEO roundtable discussion', date: 'Yesterday', clips: 12, status: 'active' },
              { name: 'Onboarding Video', desc: 'New employee orientation walkthrough', date: '3 days ago', clips: 9, status: 'done' },
            ].map((p, i) => (
              <Box
                key={i}
                sx={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 2,
                  p: 3,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: COLORS.textSecondary, bgcolor: COLORS.surface },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: p.status === 'active' ? '#22c55e' : COLORS.textTertiary,
                      mr: 1,
                    }}
                  />
                  <Typography variant="caption" sx={{ color: COLORS.textTertiary }}>
                    {p.date}
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight={600} sx={{ mb: 0.5 }}>{p.name}</Typography>
                <Typography variant="body2" sx={{ color: COLORS.textSecondary, mb: 2 }}>{p.desc}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: COLORS.textTertiary }}>{p.clips} clips</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <KeyboardArrowRight sx={{ fontSize: 16, color: COLORS.textTertiary }} />
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Footer label */}
      <Box sx={{ textAlign: 'center', py: 4, borderTop: `1px solid ${COLORS.border}` }}>
        <Typography variant="caption" sx={{ color: COLORS.textTertiary }}>
          Design 1 — Minimal Mono · Click ← to go back
        </Typography>
      </Box>
    </Box>
  );
}
