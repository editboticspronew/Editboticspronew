'use client';

import { Box, Container, Typography, Button, Card, CardContent, useTheme, alpha } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/Navbar';
import {
  VideoLibrary,
  AutoAwesome,
  Timeline,
  CloudUpload,
  Speed,
  MobileFriendly,
  Circle,
  ArrowForward,
} from '@mui/icons-material';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const features = [
    {
      icon: <VideoLibrary sx={{ fontSize: 32 }} />,
      title: 'Professional Video Editing',
      description: 'Advanced timeline-based editing with multiple tracks and layers',
    },
    {
      icon: <AutoAwesome sx={{ fontSize: 32 }} />,
      title: 'AI-Powered Tools',
      description: 'Automated transcription, smart cuts, and intelligent suggestions',
    },
    {
      icon: <Timeline sx={{ fontSize: 32 }} />,
      title: 'Interactive Timeline',
      description: 'Drag-and-drop interface with waveform visualization',
    },
    {
      icon: <CloudUpload sx={{ fontSize: 32 }} />,
      title: 'Cloud Storage',
      description: 'Securely store and access your projects from anywhere',
    },
    {
      icon: <Speed sx={{ fontSize: 32 }} />,
      title: 'Fast Processing',
      description: 'High-performance rendering and export capabilities',
    },
    {
      icon: <MobileFriendly sx={{ fontSize: 32 }} />,
      title: 'Mobile Responsive',
      description: 'Work on any device with our responsive design',
    },
  ];

  return (
    <>
      <Navbar />
      <Box
        sx={{
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
        }}
      >
        {/* Hero Section */}
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            py: { xs: 10, md: 16 },
            textAlign: 'center',
          }}
        >
          {/* Gradient background glow */}
          <Box
            sx={{
              position: 'absolute',
              top: '-40%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: { xs: '150%', md: '80%' },
              height: '120%',
              background: isDark
                ? 'radial-gradient(ellipse at center, rgba(20,184,166,0.15) 0%, transparent 70%)'
                : 'radial-gradient(ellipse at center, rgba(13,148,136,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 0.75,
                  borderRadius: 10,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: isDark ? alpha('#14b8a6', 0.08) : alpha('#0d9488', 0.06),
                }}
              >
                <Circle sx={{ fontSize: 6, color: '#14b8a6' }} />
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  AI-Powered Video Platform
                </Typography>
              </Box>
            </Box>
            <Typography
              variant="h2"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 800,
                fontSize: { xs: '2.25rem', sm: '3rem', md: '3.75rem' },
                mb: 3,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: 'text.primary',
              }}
            >
              Edit Videos with{' '}
              <Box component="span" sx={{ color: 'primary.main' }}>
                Intelligence
              </Box>
            </Typography>
            <Typography
              variant="h6"
              sx={{
                mb: 5,
                fontWeight: 400,
                fontSize: { xs: '1rem', md: '1.2rem' },
                color: 'text.secondary',
                maxWidth: 560,
                mx: 'auto',
                lineHeight: 1.6,
              }}
            >
              Create professional videos with cutting-edge AI technology.
              Transcription, smart cuts, and intelligent editing — all in one place.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
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
              <Button
                variant="outlined"
                size="large"
                onClick={() => router.push('/about')}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                  borderRadius: 2,
                  borderColor: 'divider',
                  color: 'text.primary',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                  },
                }}
              >
                Learn More
              </Button>
            </Box>
          </Container>
        </Box>

        {/* Features Section */}
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          <Typography
            variant="h4"
            component="h2"
            align="center"
            gutterBottom
            sx={{ mb: 1, fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            Powerful Features
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            align="center"
            sx={{ mb: 6, maxWidth: 480, mx: 'auto' }}
          >
            Everything you need to create professional video content
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 3,
            }}
          >
            {features.map((feature, index) => (
              <Card
                key={index}
                elevation={0}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 3,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-2px)',
                  },
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
                      bgcolor: isDark ? alpha('#14b8a6', 0.12) : alpha('#0d9488', 0.08),
                      color: 'primary.main',
                      mb: 2,
                    }}
                  >
                    {feature.icon}
                  </Box>
                  <Typography variant="body1" component="h3" gutterBottom fontWeight={700}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Container>

        {/* CTA Section */}
        <Box
          sx={{
            py: { xs: 6, md: 8 },
            textAlign: 'center',
            mt: 'auto',
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Container maxWidth="sm">
            <Typography variant="h4" component="h2" gutterBottom fontWeight={700} letterSpacing="-0.01em">
              Ready to Create?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Join thousands of creators using EditBotics Pro
            </Typography>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              onClick={() => router.push(isAuthenticated ? '/dashboard' : '/register')}
              sx={{
                px: 5,
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                boxShadow: '0 4px 16px rgba(20,184,166,0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                },
              }}
            >
              Start Editing Now
            </Button>
          </Container>
        </Box>
      </Box>
    </>
  );
}
