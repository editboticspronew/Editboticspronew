'use client';

/**
 * Design 2: Slate Professional
 * Cool blue-grey corporate palette. Structured panels.
 * Sidebar navigation. Dense but organized information.
 * Inspired by: Slack, Jira, Asana
 */

import { Box, Container, Typography, Button, IconButton, Avatar, Chip, LinearProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import {
  ArrowBack,
  Dashboard,
  VideoLibrary,
  Folder,
  Settings,
  Add,
  Search,
  Notifications,
  PlayArrow,
  Schedule,
  TrendingUp,
  MoreVert,
  CalendarToday,
  KeyboardArrowRight,
} from '@mui/icons-material';

const C = {
  bg: '#f1f5f9',
  sidebar: '#0f172a',
  sidebarHover: '#1e293b',
  sidebarActive: '#334155',
  sidebarText: '#94a3b8',
  sidebarTextActive: '#f1f5f9',
  surface: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  accent: '#3b82f6',
  accentLight: '#eff6ff',
  success: '#10b981',
  warning: '#f59e0b',
};

export default function SlateProfessionalDesign() {
  const router = useRouter();

  const sidebarItems = [
    { icon: <Dashboard sx={{ fontSize: 20 }} />, label: 'Dashboard', active: true },
    { icon: <VideoLibrary sx={{ fontSize: 20 }} />, label: 'Projects', active: false },
    { icon: <Folder sx={{ fontSize: 20 }} />, label: 'Files', active: false },
    { icon: <Settings sx={{ fontSize: 20 }} />, label: 'Settings', active: false },
  ];

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh', color: C.text }}>

      {/* Back to picker */}
      <Box sx={{ position: 'fixed', top: 16, left: 16, zIndex: 100 }}>
        <IconButton onClick={() => router.push('/designs')} size="small" sx={{ color: '#fff', bgcolor: 'rgba(0,0,0,0.3)', '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' } }}>
          <ArrowBack fontSize="small" />
        </IconButton>
      </Box>

      {/* ═══════════════════════════════════════════
          SECTION 1: LANDING / HERO
          ═══════════════════════════════════════════ */}
      <Box sx={{ bgcolor: C.sidebar }}>
        {/* Nav */}
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', height: 60, gap: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PlayArrow sx={{ fontSize: 16, color: '#fff' }} />
              </Box>
              <Typography variant="body1" fontWeight={700} color="#fff" letterSpacing="-0.01em">
                ClipWeave
              </Typography>
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            {['Features', 'Pricing', 'Enterprise'].map((t) => (
              <Typography key={t} variant="body2" sx={{ color: C.sidebarText, cursor: 'pointer', '&:hover': { color: '#fff' } }}>
                {t}
              </Typography>
            ))}
            <Button size="small" sx={{ color: '#fff', textTransform: 'none', fontWeight: 500 }}>Log in</Button>
            <Button
              size="small"
              sx={{
                bgcolor: C.accent,
                color: '#fff',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 1.5,
                px: 2.5,
                '&:hover': { bgcolor: '#2563eb' },
              }}
            >
              Start Free Trial
            </Button>
          </Box>
        </Container>

        {/* Hero */}
        <Container maxWidth="md" sx={{ pt: 10, pb: 12, textAlign: 'center' }}>
          <Typography
            sx={{
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              mb: 2,
            }}
          >
            The professional video
            <br />
            editing workspace
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: C.sidebarText, fontSize: '1.1rem', maxWidth: 500, mx: 'auto', mb: 5, lineHeight: 1.6 }}
          >
            AI-powered editing tools built for teams. Organize, edit, and ship video content from one place.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            <Button
              sx={{
                bgcolor: C.accent,
                color: '#fff',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 1.5,
                px: 4,
                py: 1.2,
                '&:hover': { bgcolor: '#2563eb' },
              }}
            >
              Get started free
            </Button>
            <Button
              sx={{
                color: C.sidebarText,
                border: `1px solid ${C.sidebarActive}`,
                textTransform: 'none',
                fontWeight: 500,
                borderRadius: 1.5,
                px: 3,
                '&:hover': { bgcolor: C.sidebarHover, color: '#fff' },
              }}
            >
              Book a demo
            </Button>
          </Box>
        </Container>
      </Box>

      {/* ═══════════════════════════════════════════
          SECTION 2: DASHBOARD WITH SIDEBAR
          ═══════════════════════════════════════════ */}
      <Box sx={{ py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="overline" sx={{ color: C.textTertiary, letterSpacing: 2, mb: 1.5, display: 'block' }}>
            Dashboard Layout (with sidebar)
          </Typography>

          <Box sx={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 2.5, overflow: 'hidden', bgcolor: C.surface, minHeight: 500 }}>
            {/* Sidebar */}
            <Box sx={{ width: 220, bgcolor: C.sidebar, flexShrink: 0, p: 2, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, px: 1 }}>
                <Box sx={{ width: 24, height: 24, borderRadius: 1, bgcolor: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlayArrow sx={{ fontSize: 14, color: '#fff' }} />
                </Box>
                <Typography variant="body2" fontWeight={700} color="#fff">ClipWeave</Typography>
              </Box>

              {sidebarItems.map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    bgcolor: item.active ? C.sidebarActive : 'transparent',
                    color: item.active ? C.sidebarTextActive : C.sidebarText,
                    cursor: 'pointer',
                    mb: 0.5,
                    '&:hover': { bgcolor: C.sidebarHover, color: C.sidebarTextActive },
                  }}
                >
                  {item.icon}
                  <Typography variant="body2" fontWeight={item.active ? 600 : 400}>{item.label}</Typography>
                </Box>
              ))}

              <Box sx={{ flexGrow: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderTop: `1px solid ${C.sidebarActive}`, pt: 2 }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: C.accent }}>J</Avatar>
                <Box>
                  <Typography variant="caption" color="#fff" fontWeight={600} sx={{ display: 'block', lineHeight: 1.2 }}>John D.</Typography>
                  <Typography variant="caption" sx={{ color: C.sidebarText, fontSize: '0.65rem' }}>Pro Plan</Typography>
                </Box>
              </Box>
            </Box>

            {/* Main content */}
            <Box sx={{ flexGrow: 1, p: 3 }}>
              {/* Top bar */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>Good morning, John</Typography>
                  <Typography variant="body2" sx={{ color: C.textSecondary }}>Here&apos;s what&apos;s happening with your projects</Typography>
                </Box>
                <Box sx={{ flexGrow: 1 }} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton size="small"><Search sx={{ fontSize: 20, color: C.textSecondary }} /></IconButton>
                  <IconButton size="small"><Notifications sx={{ fontSize: 20, color: C.textSecondary }} /></IconButton>
                </Box>
              </Box>

              {/* Stats grid */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
                {[
                  { icon: <VideoLibrary sx={{ fontSize: 20, color: C.accent }} />, label: 'Active Projects', value: '8', change: '+2 this week', color: C.accent },
                  { icon: <Schedule sx={{ fontSize: 20, color: C.success }} />, label: 'Hours Saved', value: '124', change: '+18 this month', color: C.success },
                  { icon: <TrendingUp sx={{ fontSize: 20, color: C.warning }} />, label: 'Videos Exported', value: '36', change: '+5 this week', color: C.warning },
                ].map((s, i) => (
                  <Box
                    key={i}
                    sx={{
                      p: 2.5,
                      border: `1px solid ${C.border}`,
                      borderRadius: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      {s.icon}
                      <Typography variant="caption" sx={{ color: C.textSecondary }}>{s.label}</Typography>
                    </Box>
                    <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
                    <Typography variant="caption" sx={{ color: s.color }}>{s.change}</Typography>
                  </Box>
                ))}
              </Box>

              {/* Project list */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" fontWeight={600}>Recent Activity</Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                  size="small"
                  startIcon={<Add sx={{ fontSize: 14 }} />}
                  sx={{
                    bgcolor: C.accent,
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 1.5,
                    fontSize: '0.8rem',
                    '&:hover': { bgcolor: '#2563eb' },
                  }}
                >
                  New Project
                </Button>
              </Box>

              {[
                { name: 'Product Demo v3', progress: 85, date: 'Today', team: ['J', 'A'] },
                { name: 'Q1 Marketing Reel', progress: 100, date: 'Yesterday', team: ['M'] },
                { name: 'Webinar Recording', progress: 40, date: 'Mar 1', team: ['J', 'S', 'A'] },
              ].map((p, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 2,
                    border: `1px solid ${C.border}`,
                    borderRadius: 1.5,
                    mb: 1,
                    cursor: 'pointer',
                    '&:hover': { borderColor: C.accent, bgcolor: C.accentLight },
                  }}
                >
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                      <Box sx={{ flexGrow: 1, maxWidth: 200 }}>
                        <LinearProgress
                          variant="determinate"
                          value={p.progress}
                          sx={{
                            height: 4,
                            borderRadius: 2,
                            bgcolor: C.border,
                            '& .MuiLinearProgress-bar': { bgcolor: p.progress === 100 ? C.success : C.accent, borderRadius: 2 },
                          }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ color: C.textSecondary }}>{p.progress}%</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
                    <Box sx={{ display: 'flex', mr: 1 }}>
                      {p.team.map((t, j) => (
                        <Avatar key={j} sx={{ width: 24, height: 24, fontSize: '0.65rem', bgcolor: C.accent, ml: j > 0 ? -0.5 : 0, border: `2px solid ${C.surface}` }}>{t}</Avatar>
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarToday sx={{ fontSize: 12, color: C.textTertiary }} />
                      <Typography variant="caption" sx={{ color: C.textTertiary }}>{p.date}</Typography>
                    </Box>
                    <IconButton size="small"><MoreVert sx={{ fontSize: 16, color: C.textTertiary }} /></IconButton>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ═══════════════════════════════════════════
          SECTION 3: PROJECT CARDS
          ═══════════════════════════════════════════ */}
      <Box sx={{ py: 8, bgcolor: C.surface }}>
        <Container maxWidth="lg">
          <Typography variant="overline" sx={{ color: C.textTertiary, letterSpacing: 2, mb: 1.5, display: 'block' }}>
            Project Cards
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2.5 }}>
            {[
              { name: 'Social Content Pack', desc: '12 short-form videos for Instagram & TikTok', date: 'Updated 2h ago', clips: 12, progress: 75 },
              { name: 'Annual Report Video', desc: 'Corporate highlights reel for stakeholders', date: 'Updated yesterday', clips: 8, progress: 100 },
              { name: 'Training Module 4', desc: 'Employee safety procedures walkthrough', date: 'Updated 3d ago', clips: 15, progress: 55 },
            ].map((p, i) => (
              <Box
                key={i}
                sx={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 2,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: C.accent, boxShadow: '0 4px 12px rgba(59,130,246,0.1)' },
                }}
              >
                {/* Card header with accent strip */}
                <Box sx={{ height: 4, bgcolor: p.progress === 100 ? C.success : C.accent }} />
                <Box sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="body1" fontWeight={600} sx={{ flexGrow: 1 }}>{p.name}</Typography>
                    <IconButton size="small"><MoreVert sx={{ fontSize: 16, color: C.textTertiary }} /></IconButton>
                  </Box>
                  <Typography variant="body2" sx={{ color: C.textSecondary, mb: 2 }}>{p.desc}</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: C.textTertiary }}>Progress</Typography>
                      <Typography variant="caption" fontWeight={600}>{p.progress}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={p.progress}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        bgcolor: C.border,
                        '& .MuiLinearProgress-bar': { bgcolor: p.progress === 100 ? C.success : C.accent, borderRadius: 2 },
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" sx={{ color: C.textTertiary }}>{p.clips} clips</Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Typography variant="caption" sx={{ color: C.textTertiary }}>{p.date}</Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Footer label */}
      <Box sx={{ textAlign: 'center', py: 4, borderTop: `1px solid ${C.border}` }}>
        <Typography variant="caption" sx={{ color: C.textTertiary }}>
          Design 2 — Slate Professional · Click ← to go back
        </Typography>
      </Box>
    </Box>
  );
}
