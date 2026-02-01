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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
} from '@mui/material';
import {
  ArrowBack,
  Brightness4,
  Brightness7,
  Notifications,
  Language,
  Security,
  Storage,
  DeleteForever,
  Logout,
} from '@mui/icons-material';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleTheme } from '@/store/themeSlice';
import { logoutUser } from '@/store/authSlice';

export default function SettingsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const themeMode = useAppSelector((state) => state.theme.mode);
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logoutUser());
    router.push('/');
  };

  const handleDeleteAccount = () => {
    // TODO: Implement account deletion
    setDeleteDialogOpen(false);
    alert('Account deletion will be implemented soon');
  };

  return (
    <ProtectedRoute>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 4 }}>
        {/* Header */}
        <AppBar 
          position="sticky" 
          elevation={0}
          sx={{ 
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Toolbar>
            <IconButton edge="start" onClick={() => router.push('/dashboard')} sx={{ mr: 2 }}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h6" fontWeight={700}>
              Settings
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="md" sx={{ mt: 3 }}>
          {/* Account Information */}
          <Card elevation={0} sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Account
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {user?.email}
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Display Name
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {user?.displayName || 'Not set'}
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Email Verified
                </Typography>
                <Typography 
                  variant="body1" 
                  fontWeight={600}
                  color={user?.emailVerified ? 'success.main' : 'warning.main'}
                >
                  {user?.emailVerified ? 'Verified ✓' : 'Not Verified'}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card elevation={0} sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Appearance
              </Typography>
              <List disablePadding>
                <ListItem>
                  <ListItemIcon>
                    {themeMode === 'dark' ? <Brightness7 /> : <Brightness4 />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Dark Mode"
                    secondary="Toggle dark/light theme"
                  />
                  <Switch
                    edge="end"
                    checked={themeMode === 'dark'}
                    onChange={() => dispatch(toggleTheme())}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card elevation={0} sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Preferences
              </Typography>
              <List disablePadding>
                <ListItem>
                  <ListItemIcon>
                    <Notifications />
                  </ListItemIcon>
                  <ListItemText
                    primary="Notifications"
                    secondary="Receive project updates"
                  />
                  <Switch
                    edge="end"
                    checked={notifications}
                    onChange={(e) => setNotifications(e.target.checked)}
                  />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemIcon>
                    <Storage />
                  </ListItemIcon>
                  <ListItemText
                    primary="Auto-Save"
                    secondary="Automatically save changes"
                  />
                  <Switch
                    edge="end"
                    checked={autoSave}
                    onChange={(e) => setAutoSave(e.target.checked)}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Additional Settings */}
          <Card elevation={0} sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                More
              </Typography>
              <List disablePadding>
                <ListItem button onClick={() => router.push('/profile')}>
                  <ListItemIcon>
                    <Security />
                  </ListItemIcon>
                  <ListItemText
                    primary="Privacy & Security"
                    secondary="Manage your data and privacy"
                  />
                </ListItem>
                <Divider component="li" />
                <ListItem button>
                  <ListItemIcon>
                    <Language />
                  </ListItemIcon>
                  <ListItemText
                    primary="Language"
                    secondary="English (US)"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card elevation={0} sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Actions
              </Typography>
              <List disablePadding>
                <ListItem 
                  button 
                  onClick={handleLogout}
                  sx={{ 
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <ListItemIcon>
                    <Logout color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Sign Out"
                    secondary="Sign out of your account"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card 
            elevation={0} 
            sx={{ 
              mb: 3, 
              border: 1, 
              borderColor: 'error.main',
              bgcolor: (theme) => theme.palette.mode === 'dark' 
                ? 'rgba(211, 47, 47, 0.05)' 
                : 'rgba(211, 47, 47, 0.02)'
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="error" gutterBottom>
                Danger Zone
              </Typography>
              <Alert severity="warning" sx={{ mb: 2 }}>
                These actions are irreversible. Please be careful.
              </Alert>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteForever />}
                onClick={() => setDeleteDialogOpen(true)}
                fullWidth
              >
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </Container>

        {/* Delete Account Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Delete Account?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete your account? This action cannot be undone.
              All your projects, files, and data will be permanently deleted.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeleteAccount} color="error" variant="contained">
              Delete Account
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ProtectedRoute>
  );
}
