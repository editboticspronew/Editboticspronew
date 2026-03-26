'use client';

/**
 * Design 3: Warm Neutral
 * Off-white, warm grey, subtle amber/honey accents.
 * Editorial feel, serif headings, generous typography.
 * Inspired by: Linear, Cal.com, Raycast, Medium
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
} from '@mui/icons-material';

const C = {
  bg: '#faf9f7',
  surface: '#ffffff',
  surfaceAlt: '#f5f3ef',
  border: '#e8e4dd',
  borderSubtle: '#eee9e2',
  text: '#1c1917',
  textSecondary: '#78716c',
  textTertiary: '#a8a29e',
  accent: '#b45309',
  accentLight: '#fef3c7',
  accentMuted: '#d97706',
  warm: '#292524',
};

export default function WarmNeutralDesign() {
  const router = useRouter();

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh', color: C.text }}>

      {/* Back to picker */}
      <Box sx={{ position: 'fixed', top: 16, left: 16, zIndex: 100 }}>
        <IconButton onClick={() => router.push('/designs')} size="small" sx={{ color: C.textSecondary }}>
          <ArrowBack fontSize="small" />
        </IconButton>
      </Box>

      {/* ═══════════════════════════════════════════
          SECTION 1: LANDING / HERO
          ═══════════════════════════════════════════ */}
      <Box sx={{ borderBottom: `1px solid ${C.border}` }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', height: 60, gap: 4 }}>
            <Typography variant="body1" fontWeight={700} sx={{ letterSpacing: '-0.01em' }}>
              ClipWeave
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            {['Features', 'Pricing', 'Blog'].map((t) => (
              <Typography key={t} variant="body2" sx={{ color: C.textSecondary, cursor: 'pointer', '&:hover': { color: C.text } }}>
                {t}
              </Typography>
            ))}
            <Button size="small" sx={{ color: C.text, textTransform: 'none', fontWeight: 500 }}>Sign in</Button>
            <Button
              size="small"
              sx={{
                bgcolor: C.warm,
                color: '#fff',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 100,
                px: 2.5,
                '&:hover': { bgcolor: '#44403c' },
              }}
            >
              Get Started
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Hero */}
      <Container maxWidth="md" sx={{ pt: 12, pb: 14, textAlign: 'center' }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: C.accentLight, border: `1px solid #fde68a`, borderRadius: 100, px: 2, py: 0.5, mb: 3 }}>
          <AutoAwesome sx={{ fontSize: 14, color: C.accent }} />
          <Typography variant="caption" sx={{ color: C.accent, fontWeight: 600 }}>Powered by AI</Typography>
        </Box>
        <Typography
          sx={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: { xs: '2.5rem', md: '3.75rem' },
            fontWeight: 400,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            mb: 2.5,
          }}
        >
          Beautiful video editing,
          <br />
          <span style={{ fontStyle: 'italic' }}>effortlessly.</span>
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: C.textSecondary, fontSize: '1.1rem', maxWidth: 460, mx: 'auto', mb: 5, lineHeight: 1.7 }}
        >
          An elegant workspace where AI handles the tedious work, so you can focus on the creative vision.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
          <Button
            endIcon={<East sx={{ fontSize: 16 }} />}
            sx={{
              bgcolor: C.warm,
              color: '#fff',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 100,
              px: 3.5,
              py: 1.2,
              '&:hover': { bgcolor: '#44403c' },
            }}
          >
            Start creating
          </Button>
          <Button
            sx={{
              color: C.textSecondary,
              border: `1px solid ${C.border}`,
              textTransform: 'none',
              fontWeight: 500,
              borderRadius: 100,
              px: 3,
              py: 1.2,
              '&:hover': { bgcolor: C.surfaceAlt },
            }}
          >
            See how it works
          </Button>
        </Box>
      </Container>

      {/* Features — editorial style */}
      <Box sx={{ borderTop: `1px solid ${C.border}`, bgcolor: C.surface }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' } }}>
            {[
              { num: '01', title: 'Transcribe & Analyze', desc: 'Upload your video and let AI break it down — speech-to-text, scene detection, and content analysis in seconds.' },
              { num: '02', title: 'Intelligent Editing', desc: 'AI identifies the best moments, removes filler, and suggests cuts that maintain flow and pacing.' },
              { num: '03', title: 'Export Anywhere', desc: 'Render in the browser, no upload required. Download or share your polished video instantly.' },
            ].map((f, i) => (
              <Box
                key={i}
                sx={{
                  p: 4,
                  borderRight: { xs: 'none', md: i < 2 ? `1px solid ${C.border}` : 'none' },
                  borderBottom: { xs: `1px solid ${C.border}`, md: 'none' },
                }}
              >
                <Typography variant="caption" sx={{ color: C.accentMuted, fontWeight: 700, letterSpacing: 1, mb: 1.5, display: 'block' }}>
                  {f.num}
                </Typography>
                <Typography variant="body1" fontWeight={600} sx={{ mb: 1 }}>{f.title}</Typography>
                <Typography variant="body2" sx={{ color: C.textSecondary, lineHeight: 1.6 }}>{f.desc}</Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ═══════════════════════════════════════════
          SECTION 2: DASHBOARD PREVIEW
          ═══════════════════════════════════════════ */}
      <Box sx={{ py: 8, bgcolor: C.surfaceAlt }}>
        <Container maxWidth="lg">
          <Typography variant="overline" sx={{ color: C.textTertiary, letterSpacing: 2, mb: 1.5, display: 'block' }}>
            Dashboard
          </Typography>

          <Box sx={{ bgcolor: C.surface, border: `1px solid ${C.border}`, borderRadius: 3, overflow: 'hidden' }}>
            {/* Dashboard header */}
            <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2.5, borderBottom: `1px solid ${C.borderSubtle}` }}>
              <Box>
                <Typography sx={{ fontFamily: 'Georgia, serif', fontSize: '1.25rem', fontWeight: 400 }}>Welcome back</Typography>
                <Typography variant="caption" sx={{ color: C.textTertiary }}>Wednesday, March 5</Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                startIcon={<Add sx={{ fontSize: 16 }} />}
                sx={{
                  bgcolor: C.warm,
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 100,
                  px: 2.5,
                  fontSize: '0.85rem',
                  '&:hover': { bgcolor: '#44403c' },
                }}
              >
                New Project
              </Button>
            </Box>

            {/* Stats */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `1px solid ${C.borderSubtle}` }}>
              {[
                { label: 'Projects', value: '7', icon: <VideoLibrary sx={{ fontSize: 16 }} /> },
                { label: 'In Progress', value: '3', icon: <PlayArrow sx={{ fontSize: 16 }} /> },
                { label: 'Hours Saved', value: '52', icon: <Schedule sx={{ fontSize: 16 }} /> },
                { label: 'This Week', value: '+4', icon: <AutoAwesome sx={{ fontSize: 16 }} /> },
              ].map((s, i) => (
                <Box
                  key={i}
                  sx={{
                    p: 2.5,
                    borderRight: i < 3 ? `1px solid ${C.borderSubtle}` : 'none',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, color: C.textTertiary }}>
                    {s.icon}
                    <Typography variant="caption" sx={{ color: C.textTertiary }}>{s.label}</Typography>
                  </Box>
                  <Typography variant="h5" sx={{ fontFamily: 'Georgia, serif', fontWeight: 400 }}>{s.value}</Typography>
                </Box>
              ))}
            </Box>

            {/* Project list */}
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 2 }}>Recent</Typography>
              {[
                { name: 'Brand Story Documentary', desc: 'Final cut review pending', date: '2h ago', tag: 'Edit' },
                { name: 'Product Launch Teaser', desc: '30s social cutdown', date: 'Yesterday', tag: 'Short-form' },
                { name: 'Customer Interview #7', desc: 'Needs transcription review', date: '3 days ago', tag: 'Interview' },
                { name: 'How-to: Dashboard Setup', desc: 'Tutorial series ep. 4', date: 'Last week', tag: 'Tutorial' },
              ].map((p, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    py: 2,
                    borderBottom: i < 3 ? `1px solid ${C.borderSubtle}` : 'none',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: C.surfaceAlt },
                    mx: -1.5,
                    px: 1.5,
                    borderRadius: 2,
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: C.surfaceAlt,
                      border: `1px solid ${C.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                    }}
                  >
                    <PlayArrow sx={{ fontSize: 18, color: C.textSecondary }} />
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={500}>{p.name}</Typography>
                    <Typography variant="caption" sx={{ color: C.textTertiary }}>{p.desc}</Typography>
                  </Box>
                  <Chip
                    label={p.tag}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      bgcolor: C.surfaceAlt,
                      color: C.textSecondary,
                      border: `1px solid ${C.border}`,
                      mr: 1.5,
                    }}
                  />
                  <Typography variant="caption" sx={{ color: C.textTertiary, mr: 1 }}>{p.date}</Typography>
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
              { name: 'Podcast Highlights', desc: 'Best moments from Ep. 24 — condensed to 3 minutes', emoji: '🎙️', date: 'Today', clips: 8 },
              { name: 'Investor Pitch', desc: '60-second cut for the Series B deck presentation', emoji: '📊', date: 'Yesterday', clips: 4 },
              { name: 'Event Recap', desc: 'Highlight reel from the annual company summit', emoji: '🎪', date: '4 days ago', clips: 16 },
            ].map((p, i) => (
              <Box
                key={i}
                sx={{
                  bgcolor: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  p: 3,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: C.textTertiary, transform: 'translateY(-1px)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: C.surfaceAlt,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                    }}
                  >
                    {p.emoji}
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                    <Typography variant="caption" sx={{ color: C.textTertiary }}>{p.clips} clips</Typography>
                  </Box>
                </Box>
                <Typography variant="body2" sx={{ color: C.textSecondary, lineHeight: 1.6, mb: 2 }}>{p.desc}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: C.textTertiary }}>{p.date}</Typography>
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
          Design 3 — Warm Neutral · Click ← to go back
        </Typography>
      </Box>
    </Box>
  );
}
