'use client';

import { Box, Container, Typography, Button, Grid, Card, CardContent } from '@mui/material';
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
} from '@mui/icons-material';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: <VideoLibrary sx={{ fontSize: 48 }} />,
      title: 'Professional Video Editing',
      description: 'Advanced timeline-based editing with multiple tracks and layers',
    },
    {
      icon: <AutoAwesome sx={{ fontSize: 48 }} />,
      title: 'AI-Powered Tools',
      description: 'Automated transcription, smart cuts, and intelligent suggestions',
    },
    {
      icon: <Timeline sx={{ fontSize: 48 }} />,
      title: 'Interactive Timeline',
      description: 'Drag-and-drop interface with waveform visualization',
    },
    {
      icon: <CloudUpload sx={{ fontSize: 48 }} />,
      title: 'Cloud Storage',
      description: 'Securely store and access your projects from anywhere',
    },
    {
      icon: <Speed sx={{ fontSize: 48 }} />,
      title: 'Fast Processing',
      description: 'High-performance rendering and export capabilities',
    },
    {
      icon: <MobileFriendly sx={{ fontSize: 48 }} />,
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
        }}
      >
        {/* Hero Section */}
        <Box
          sx={{
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            py: { xs: 8, md: 12 },
            textAlign: 'center',
          }}
        >
          <Container maxWidth="md">
            <Typography
              variant="h2"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 800,
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                mb: 3,
              }}
            >
              AI-Powered Video Editing
            </Typography>
            <Typography
              variant="h5"
              sx={{
                mb: 4,
                fontWeight: 400,
                fontSize: { xs: '1.2rem', md: '1.5rem' },
                opacity: 0.95,
              }}
            >
              Create professional videos with cutting-edge AI technology
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => router.push(isAuthenticated ? '/dashboard' : '/register')}
                sx={{
                  bgcolor: 'white',
                  color: '#667eea',
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.9)',
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
                  borderColor: 'white',
                  color: 'white',
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  '&:hover': {
                    borderColor: 'white',
                    bgcolor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                Learn More
              </Button>
            </Box>
          </Container>
        </Box>

        {/* Features Section */}
        <Container maxWidth="lg" sx={{ py: 8 }}>
          <Typography
            variant="h3"
            component="h2"
            align="center"
            gutterBottom
            sx={{ mb: 6, fontWeight: 700 }}
          >
            Powerful Features
          </Typography>
          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                    },
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box sx={{ color: 'primary.main', mb: 2 }}>{feature.icon}</Box>
                    <Typography variant="h6" component="h3" gutterBottom fontWeight={600}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>

        {/* CTA Section */}
        <Box
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            py: 8,
            textAlign: 'center',
            mt: 'auto',
          }}
        >
          <Container maxWidth="md">
            <Typography variant="h4" component="h2" gutterBottom fontWeight={700}>
              Ready to Create Amazing Videos?
            </Typography>
            <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
              Join thousands of creators using EditBotics Pro
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => router.push(isAuthenticated ? '/dashboard' : '/register')}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                px: 5,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.9)',
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
