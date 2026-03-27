'use client';

import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  useTheme,
  alpha,
} from '@mui/material';
import {
  AutoAwesome,
  VideoLibrary,
  Timeline,
  CloudUpload,
  Visibility,
  Speed,
  ArrowForward,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/Navbar';

const features = [
  {
    icon: <AutoAwesome sx={{ fontSize: 32 }} />,
    title: 'AI-Powered Clip Generation',
    description:
      'Describe what you want and our LLM identifies the best segments from your video automatically.',
  },
  {
    icon: VideoLibrary,
    title: 'Cloud Transcription',
    description:
      'Google Video Intelligence transcribes speech in 50+ languages with word-level timestamps.',
  },
  {
    icon: <Timeline sx={{ fontSize: 32 }} />,
    title: 'Professional Timeline Editor',
    description:
      'Multi-track timeline with drag-and-drop clips, transitions, text overlays, and keyframe animation.',
  },
  {
    icon: <Speed sx={{ fontSize: 32 }} />,
    title: 'Client-Side Export',
    description:
      'FFmpeg WASM renders your final video entirely in the browser — no server upload required.',
  },
  {
    icon: <Visibility sx={{ fontSize: 32 }} />,
    title: 'Multimodal Vision Analysis',
    description:
      'Scene detection, object tracking, and label analysis give the AI eyes — not just ears.',
  },
  {
    icon: <CloudUpload sx={{ fontSize: 32 }} />,
    title: 'Firebase Cloud Storage',
    description:
      'Projects, media files, and metadata sync securely to the cloud across all your devices.',
  },
];

export default function AboutPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Navbar />

      {/* Hero */}
      <Box
        sx={{
          pt: { xs: 10, md: 14 },
          pb: { xs: 6, md: 10 },
          textAlign: 'center',
          background: isDark
            ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 100%)`
            : `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, transparent 100%)`,
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h2"
            fontWeight={800}
            sx={{
              fontSize: { xs: '2rem', sm: '2.75rem', md: '3.25rem' },
              letterSpacing: '-0.02em',
              mb: 2,
            }}
          >
            About ClipWeave
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{
              maxWidth: 640,
              mx: 'auto',
              fontWeight: 400,
              lineHeight: 1.6,
              fontSize: { xs: '1rem', md: '1.15rem' },
            }}
          >
            A fully browser-based video editing platform built around one core idea:
            let AI handle the tedious parts so you can focus on the creative ones.
          </Typography>
        </Container>
      </Box>

      {/* Mission */}
      <Container maxWidth="md" sx={{ mb: { xs: 6, md: 8 } }}>
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              What is ClipWeave?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              ClipWeave is an AI-powered video editing platform that runs entirely in your browser.
              Upload a long-form video, provide a text prompt describing the clips you need, and the
              system combines speech transcription with multimodal scene analysis to intelligently
              extract the right moments. From there you can refine clips on a professional
              multi-track timeline, add text overlays with keyframe animation, apply filters, and
              export the final result — all without leaving the browser.
            </Typography>
          </CardContent>
        </Card>
      </Container>

      {/* Features Grid */}
      <Container maxWidth="lg" sx={{ mb: { xs: 6, md: 10 } }}>
        <Typography
          variant="h4"
          fontWeight={700}
          textAlign="center"
          sx={{ mb: { xs: 3, md: 5 }, fontSize: { xs: '1.5rem', md: '2rem' } }}
        >
          What&apos;s Inside
        </Typography>
        <Grid container spacing={3}>
          {features.map((feature) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={feature.title}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 3,
                  transition: 'border-color 0.2s',
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                    }}
                  >
                    {typeof feature.icon === 'function' ? (
                      <feature.icon sx={{ fontSize: 32 }} />
                    ) : (
                      feature.icon
                    )}
                  </Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA */}
      <Box
        sx={{
          py: { xs: 6, md: 8 },
          textAlign: 'center',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="sm">
          <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
            Ready to try it?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Create a free account and start editing in minutes.
          </Typography>
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForward />}
            onClick={() => router.push(isAuthenticated ? '/dashboard' : '/register')}
            sx={{
              px: 4,
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              boxShadow: '0 4px 16px rgba(20,184,166,0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                boxShadow: '0 6px 20px rgba(20,184,166,0.4)',
              },
            }}
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
          </Button>
        </Container>
      </Box>
    </Box>
  );
}
