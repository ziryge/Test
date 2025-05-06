import React, { createContext, useState, useMemo, useEffect } from 'react';
import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Création du contexte
export const ThemeContext = createTheme();
export const ThemeUpdateContext = createContext();

export const ThemeProvider = ({ children }) => {
  // État pour le mode thème (light/dark)
  const [mode, setMode] = useState('dark');
  
  // Charger la préférence de thème depuis le stockage local
  useEffect(() => {
    const savedMode = localStorage.getItem('themeMode');
    if (savedMode) {
      setMode(savedMode);
    } else {
      // Détecter la préférence du système
      const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(prefersDarkMode ? 'dark' : 'light');
    }
  }, []);
  
  // Sauvegarder la préférence de thème dans le stockage local
  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);
  
  // Fonction pour basculer entre les modes
  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };
  
  // Générer le thème en fonction du mode
  const theme = useMemo(() => {
    const baseTheme = {
      typography: {
        fontFamily: "'Inter', sans-serif",
        h1: {
          fontSize: '2.5rem',
          fontWeight: 700,
        },
        h2: {
          fontSize: '2rem',
          fontWeight: 700,
        },
        h3: {
          fontSize: '1.75rem',
          fontWeight: 600,
        },
        h4: {
          fontSize: '1.5rem',
          fontWeight: 600,
        },
        h5: {
          fontSize: '1.25rem',
          fontWeight: 600,
        },
        h6: {
          fontSize: '1rem',
          fontWeight: 600,
        },
        body1: {
          fontSize: '1rem',
        },
        body2: {
          fontSize: '0.875rem',
        },
        fontWeightLight: 300,
        fontWeightRegular: 400,
        fontWeightMedium: 500,
        fontWeightBold: 700,
      },
      shape: {
        borderRadius: 10,
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              transition: 'background-color 0.3s, color 0.3s',
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
              },
              '&::-webkit-scrollbar-thumb': {
                borderRadius: '4px',
              }
            },
            code: {
              fontFamily: "'JetBrains Mono', monospace",
            },
          },
        },
      },
    };
    
    // Palette pour le mode sombre
    if (mode === 'dark') {
      return createTheme({
        ...baseTheme,
        palette: {
          mode: 'dark',
          primary: {
            main: '#2D9CDB',
            light: '#56CCF2',
            dark: '#2171B5',
            contrastText: '#FFFFFF',
          },
          secondary: {
            main: '#BB6BD9',
            light: '#F2C94C',
            dark: '#9B51E0',
            contrastText: '#FFFFFF',
          },
          background: {
            paper: '#1A202C',
            default: '#171923',
          },
          text: {
            primary: '#E2E8F0',
            secondary: '#A0AEC0',
          },
          error: {
            main: '#E53E3E',
          },
          warning: {
            main: '#F6AD55',
          },
          info: {
            main: '#63B3ED',
          },
          success: {
            main: '#68D391',
          },
          divider: 'rgba(255, 255, 255, 0.08)',
          // Couleurs personnalisées pour l'interface NeoCortex
          neocortex: {
            gradient1: 'linear-gradient(90deg, #2D9CDB 0%, #BB6BD9 100%)',
            gradient2: 'linear-gradient(90deg, #56CCF2 0%, #2D9CDB 50%, #9B51E0 100%)',
            highlight: '#F2C94C',
            code: {
              background: '#2D3748',
              text: '#E2E8F0',
            },
            sidebar: {
              background: '#1A202C',
              hover: '#2D3748',
            },
            mainContent: {
              background: '#171923',
            },
            card: {
              background: '#2D3748',
            },
            border: 'rgba(255, 255, 255, 0.1)',
            shadow: '0px 4px 20px rgba(0, 0, 0, 0.25)',
          },
        },
        components: {
          ...baseTheme.components,
          MuiCssBaseline: {
            styleOverrides: {
              ...baseTheme.components.MuiCssBaseline.styleOverrides,
              body: {
                ...baseTheme.components.MuiCssBaseline.styleOverrides.body,
                backgroundColor: '#171923',
                color: '#E2E8F0',
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(160, 174, 192, 0.3)',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: '#171923',
                },
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                borderRadius: '8px',
                fontWeight: 500,
              },
            },
          },
        },
      });
    }
    
    // Palette pour le mode clair
    return createTheme({
      ...baseTheme,
      palette: {
        mode: 'light',
        primary: {
          main: '#2D9CDB',
          light: '#56CCF2',
          dark: '#2171B5',
          contrastText: '#FFFFFF',
        },
        secondary: {
          main: '#BB6BD9',
          light: '#F2C94C',
          dark: '#9B51E0',
          contrastText: '#FFFFFF',
        },
        background: {
          paper: '#FFFFFF',
          default: '#F7FAFC',
        },
        text: {
          primary: '#2D3748',
          secondary: '#4A5568',
        },
        error: {
          main: '#E53E3E',
        },
        warning: {
          main: '#ED8936',
        },
        info: {
          main: '#4299E1',
        },
        success: {
          main: '#48BB78',
        },
        divider: 'rgba(0, 0, 0, 0.08)',
        // Couleurs personnalisées pour l'interface NeoCortex
        neocortex: {
          gradient1: 'linear-gradient(90deg, #2D9CDB 0%, #BB6BD9 100%)',
          gradient2: 'linear-gradient(90deg, #56CCF2 0%, #2D9CDB 50%, #9B51E0 100%)',
          highlight: '#F2C94C',
          code: {
            background: '#EDF2F7',
            text: '#2D3748',
          },
          sidebar: {
            background: '#FFFFFF',
            hover: '#EDF2F7',
          },
          mainContent: {
            background: '#F7FAFC',
          },
          card: {
            background: '#FFFFFF',
          },
          border: 'rgba(0, 0, 0, 0.1)',
          shadow: '0px 4px 20px rgba(0, 0, 0, 0.05)',
        },
      },
      components: {
        ...baseTheme.components,
        MuiCssBaseline: {
          styleOverrides: {
            ...baseTheme.components.MuiCssBaseline.styleOverrides,
            body: {
              ...baseTheme.components.MuiCssBaseline.styleOverrides.body,
              backgroundColor: '#F7FAFC',
              color: '#2D3748',
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(74, 85, 104, 0.3)',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: '#F7FAFC',
              },
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              borderRadius: '8px',
              fontWeight: 500,
            },
          },
        },
      },
    });
  }, [mode]);
  
  return (
    <ThemeUpdateContext.Provider value={toggleTheme}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeUpdateContext.Provider>
  );
};