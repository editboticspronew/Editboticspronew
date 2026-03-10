'use client';

import { ReactNode, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useAppSelector } from '@/store/hooks';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useAppSelector((state) => state.theme.mode);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === 'light'
            ? {
                primary: {
                  main: '#0d9488',
                  light: '#14b8a6',
                  dark: '#0f766e',
                },
                secondary: {
                  main: '#6366f1',
                  light: '#818cf8',
                  dark: '#4f46e5',
                },
                background: {
                  default: '#f4f4f5',
                  paper: '#ffffff',
                },
                text: {
                  primary: '#09090b',
                  secondary: '#52525b',
                },
                divider: '#e4e4e7',
                action: {
                  hover: 'rgba(13, 148, 136, 0.04)',
                  selected: 'rgba(13, 148, 136, 0.08)',
                },
              }
            : {
                primary: {
                  main: '#14b8a6',
                  light: '#2dd4bf',
                  dark: '#0d9488',
                },
                secondary: {
                  main: '#6366f1',
                  light: '#818cf8',
                  dark: '#4f46e5',
                },
                background: {
                  default: '#09090b',
                  paper: '#111113',
                },
                text: {
                  primary: '#fafafa',
                  secondary: '#a1a1aa',
                },
                divider: '#27272a',
                action: {
                  hover: 'rgba(20, 184, 166, 0.08)',
                  selected: 'rgba(20, 184, 166, 0.12)',
                },
              }),
        },
        typography: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
          h4: { fontWeight: 700, letterSpacing: '-0.02em' },
          h5: { fontWeight: 700, letterSpacing: '-0.01em' },
          h6: { fontWeight: 700, letterSpacing: '-0.01em' },
        },
        shape: {
          borderRadius: 10,
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                scrollbarColor: mode === 'dark' ? '#27272a #09090b' : undefined,
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 10,
              },
              contained: {
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                boxShadow: mode === 'light'
                  ? '0 1px 3px rgba(0,0,0,0.04)'
                  : 'none',
                border: `1px solid ${mode === 'dark' ? '#27272a' : '#e4e4e7'}`,
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                boxShadow: 'none',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                backgroundImage: 'none',
                border: `1px solid ${mode === 'dark' ? '#27272a' : '#e4e4e7'}`,
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                fontWeight: 500,
              },
            },
          },
          MuiTab: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 600,
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: 10,
                },
              },
            },
          },
          MuiFab: {
            styleOverrides: {
              root: {
                boxShadow: mode === 'dark'
                  ? '0 8px 24px rgba(20, 184, 166, 0.25)'
                  : '0 8px 24px rgba(13, 148, 136, 0.3)',
              },
            },
          },
          MuiSwitch: {
            styleOverrides: {
              switchBase: {
                '&.Mui-checked': {
                  color: mode === 'dark' ? '#14b8a6' : '#0d9488',
                },
                '&.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: mode === 'dark' ? '#14b8a6' : '#0d9488',
                },
              },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
