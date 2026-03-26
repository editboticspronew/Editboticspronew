'use client';

import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme as useMuiTheme,
  Divider,
  ListItemIcon,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4,
  Brightness7,
  AccountCircle,
  Circle,
  Person,
  Settings,
  Logout,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutUser } from '@/store/authSlice';
import { toggleTheme } from '@/store/themeSlice';

export function Navbar() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((state) => state.theme.mode);
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const isDark = muiTheme.palette.mode === 'dark';

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    dispatch(logoutUser());
    handleMenuClose();
    router.push('/');
  };

  const handleThemeToggle = () => {
    dispatch(toggleTheme());
  };

  const navItems = isAuthenticated
    ? [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Projects', path: '/projects' },
        { label: 'Files', path: '/files' },
      ]
    : [
        { label: 'Home', path: '/' },
        { label: 'About', path: '/about' },
      ];

  const drawer = (
    <Box sx={{ textAlign: 'center', bgcolor: 'background.paper', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 2.5 }}>
        <Circle sx={{ fontSize: 8, color: 'primary.main' }} />
        <Typography variant="body1" fontWeight={700}>ClipWeave</Typography>
      </Box>
      <Divider />
      <List>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              sx={{ py: 1.5, '&:hover': { bgcolor: 'action.hover' } }}
              onClick={() => { router.push(item.path); handleDrawerToggle(); }}
            >
              <ListItemText primary={item.label} sx={{ textAlign: 'center' }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <ListItem disablePadding>
        <ListItemButton onClick={() => { handleThemeToggle(); handleDrawerToggle(); }} sx={{ py: 1.5 }}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            {themeMode === 'dark' ? <Brightness7 fontSize="small" /> : <Brightness4 fontSize="small" />}
          </ListItemIcon>
          <ListItemText primary={themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'} />
        </ListItemButton>
      </ListItem>
    </Box>
  );

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          color: 'text.primary',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          {isMobile && (
            <IconButton
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 1.5, color: 'text.secondary' }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
            }}
            onClick={() => router.push('/')}
          >
            <Circle sx={{ fontSize: 8, color: 'primary.main' }} />
            <Typography
              variant="body1"
              sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}
            >
              ClipWeave
            </Typography>
          </Box>

          {!isMobile && (
            <Box sx={{ display: 'flex', ml: 4, gap: 0.5 }}>
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    px: 1.5,
                    '&:hover': {
                      color: 'text.primary',
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
          )}

          <Box sx={{ flexGrow: 1 }} />

          <IconButton onClick={handleThemeToggle} sx={{ mr: 0.5, color: 'text.secondary' }}>
            {themeMode === 'dark' ? <Brightness7 fontSize="small" /> : <Brightness4 fontSize="small" />}
          </IconButton>

          {isAuthenticated ? (
            <>
              <IconButton
                onClick={handleProfileMenuOpen}
                sx={{ ml: 0.5 }}
              >
                {user?.photoURL ? (
                  <Avatar src={user.photoURL} sx={{ width: 32, height: 32 }} />
                ) : (
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: 'primary.main',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    {user?.displayName?.[0] || user?.email?.[0] || 'U'}
                  </Avatar>
                )}
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                slotProps={{
                  paper: {
                    sx: {
                      minWidth: 180,
                      mt: 1,
                    },
                  },
                }}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="body2" fontWeight={600}>{user?.displayName || 'User'}</Typography>
                  <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
                </Box>
                <Divider />
                <MenuItem onClick={() => { handleMenuClose(); router.push('/profile'); }}>
                  <ListItemIcon><Person fontSize="small" /></ListItemIcon>
                  Profile
                </MenuItem>
                <MenuItem onClick={() => { handleMenuClose(); router.push('/settings'); }}>
                  <ListItemIcon><Settings fontSize="small" /></ListItemIcon>
                  Settings
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                  <ListItemIcon><Logout fontSize="small" color="error" /></ListItemIcon>
                  Sign Out
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                onClick={() => router.push('/login')}
                sx={{ color: 'text.secondary', fontWeight: 500 }}
              >
                Log in
              </Button>
              <Button
                variant="contained"
                onClick={() => router.push('/register')}
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
              >
                Sign Up
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: 260,
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
}
