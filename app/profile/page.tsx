'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Card,
  CardContent,
  TextField,
  Button,
  Avatar,
  Divider,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  ArrowBack,
  Person,
  Lock,
  Email,
  CalendarToday,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { updateProfile, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase/init';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch } from '@/store/hooks';
import { setUser } from '@/store/authSlice';

export default function ProfilePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleUpdateProfile = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      // Sync redux state
      dispatch(
        setUser({
          uid: auth.currentUser.uid,
          email: auth.currentUser.email,
          displayName: displayName.trim(),
          photoURL: auth.currentUser.photoURL,
          emailVerified: auth.currentUser.emailVerified,
        }),
      );
      setSuccess('Profile updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setError('');
    setSuccess('');
    try {
      await sendPasswordResetEmail(auth, user.email);
      setSuccess('Password reset email sent. Check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser || user?.emailVerified) return;
    setError('');
    setSuccess('');
    try {
      await sendEmailVerification(auth.currentUser);
      setSuccess('Verification email sent. Check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification email.');
    }
  };

  const initials = (user?.displayName || user?.email || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const createdAt = auth.currentUser?.metadata?.creationTime
    ? new Date(auth.currentUser.metadata.creationTime).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  const lastSignIn = auth.currentUser?.metadata?.lastSignInTime
    ? new Date(auth.currentUser.metadata.lastSignInTime).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  return (
    <ProtectedRoute>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 4 }}>
        {/* Header */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
        >
          <Toolbar>
            <IconButton edge="start" onClick={() => router.push('/settings')} sx={{ mr: 2 }}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h6" fontWeight={700}>
              Profile
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="md" sx={{ mt: 3 }}>
          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Avatar & Name */}
          <Card elevation={0} sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
            <CardContent
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'center', sm: 'flex-start' },
                gap: 3,
                p: { xs: 3, sm: 4 },
              }}
            >
              <Avatar
                src={user?.photoURL || undefined}
                sx={{
                  width: 80,
                  height: 80,
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  bgcolor: 'primary.main',
                }}
              >
                {initials}
              </Avatar>
              <Box sx={{ flex: 1, width: '100%' }}>
                <TextField
                  label="Display Name"
                  fullWidth
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  margin="normal"
                  size="small"
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                  {user?.email}
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  disabled={saving || displayName.trim() === (user?.displayName || '')}
                  onClick={handleUpdateProfile}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                    },
                  }}
                >
                  {saving ? 'Saving…' : 'Update Profile'}
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card elevation={0} sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Privacy &amp; Security
              </Typography>
              <List disablePadding>
                <ListItem>
                  <ListItemIcon>
                    <Email />
                  </ListItemIcon>
                  <ListItemText
                    primary="Email Verification"
                    secondary={user?.email}
                  />
                  {user?.emailVerified ? (
                    <Chip
                      icon={<CheckCircle sx={{ fontSize: 16 }} />}
                      label="Verified"
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  ) : (
                    <Button size="small" variant="outlined" color="warning" onClick={handleResendVerification}>
                      Verify
                    </Button>
                  )}
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemIcon>
                    <Lock />
                  </ListItemIcon>
                  <ListItemText
                    primary="Password"
                    secondary="Send a password reset link to your email"
                  />
                  <Button size="small" variant="outlined" onClick={handlePasswordReset}>
                    Reset
                  </Button>
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card elevation={0} sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Account Info
              </Typography>
              <List disablePadding>
                <ListItem>
                  <ListItemIcon>
                    <Person />
                  </ListItemIcon>
                  <ListItemText primary="User ID" secondary={user?.uid} />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemIcon>
                    <CalendarToday />
                  </ListItemIcon>
                  <ListItemText primary="Account Created" secondary={createdAt} />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemIcon>
                    <CalendarToday />
                  </ListItemIcon>
                  <ListItemText primary="Last Sign-In" secondary={lastSignIn} />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </ProtectedRoute>
  );
}
