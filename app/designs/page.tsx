'use client';

import { Box, Container, Typography, Card, CardContent, CardActionArea, Grid } from '@mui/material';
import { useRouter } from 'next/navigation';

const designs = [
  {
    id: 1,
    slug: 'minimal-mono',
    title: 'Minimal Mono',
    subtitle: 'Black & white, thin borders, maximum whitespace',
    inspiration: 'Apple, Linear, Stripe',
    preview: '#000',
    accent: '#fff',
    border: '#333',
  },
  {
    id: 2,
    slug: 'slate-professional',
    title: 'Slate Professional',
    subtitle: 'Cool blue-grey corporate with structured layout',
    inspiration: 'Notion, Slack, Jira',
    preview: '#1e293b',
    accent: '#3b82f6',
    border: '#334155',
  },
  {
    id: 3,
    slug: 'warm-neutral',
    title: 'Warm Neutral',
    subtitle: 'Off-white, warm grey, amber accents, editorial feel',
    inspiration: 'Linear, Cal.com, Raycast',
    preview: '#faf9f7',
    accent: '#d97706',
    border: '#e5e2db',
  },
  {
    id: 4,
    slug: 'dark-elegance',
    title: 'Dark Elegance',
    subtitle: 'Near-black with teal accent, dense information display',
    inspiration: 'Vercel, GitHub, Arc',
    preview: '#09090b',
    accent: '#14b8a6',
    border: '#27272a',
  },
  {
    id: 5,
    slug: 'clean-airy',
    title: 'Clean Airy',
    subtitle: 'Light, soft blue-grey, rounded, generous spacing',
    inspiration: 'Figma, Loom, Pitch',
    preview: '#f8fafc',
    accent: '#6366f1',
    border: '#e2e8f0',
  },
];

export default function DesignPickerPage() {
  const router = useRouter();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa', py: 6 }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" fontWeight={800} sx={{ color: '#111', mb: 1 }}>
            Design Review
          </Typography>
          <Typography variant="h6" sx={{ color: '#666', fontWeight: 400 }}>
            5 design directions for ClipWeave — click to preview each
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {designs.map((d) => (
            <Grid key={d.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                elevation={0}
                sx={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 3,
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: d.accent,
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 24px rgba(0,0,0,0.08)`,
                  },
                }}
              >
                <CardActionArea onClick={() => router.push(`/designs/${d.slug}`)}>
                  {/* Color preview strip */}
                  <Box
                    sx={{
                      height: 120,
                      bgcolor: d.preview,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    <Box
                      sx={{
                        width: '70%',
                        height: '60%',
                        border: `1px solid ${d.border}`,
                        borderRadius: 1.5,
                        bgcolor: d.preview === '#faf9f7' || d.preview === '#f8fafc' ? '#fff' : 'rgba(255,255,255,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        p: 1.5,
                        gap: 0.5,
                      }}
                    >
                      <Box sx={{ width: '40%', height: 6, borderRadius: 1, bgcolor: d.accent }} />
                      <Box sx={{ width: '70%', height: 4, borderRadius: 1, bgcolor: d.border, opacity: 0.5 }} />
                      <Box sx={{ width: '55%', height: 4, borderRadius: 1, bgcolor: d.border, opacity: 0.3 }} />
                    </Box>
                  </Box>

                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          bgcolor: d.accent,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: d.accent === '#fff' || d.accent === '#d97706' ? '#000' : '#fff',
                        }}
                      >
                        {d.id}
                      </Box>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#111' }}>
                        {d.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                      {d.subtitle}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999' }}>
                      Inspired by: {d.inspiration}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="body2" sx={{ color: '#999' }}>
            Each design includes: Landing page, Dashboard, and Project cards
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
