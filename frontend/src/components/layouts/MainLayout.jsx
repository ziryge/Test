import React, { useState, useRef, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  useTheme,
  useMediaQuery,
  Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Chat as ChatIcon,
  Psychology as PsychologyIcon,
  Task as TaskIcon,
  Memory as MemoryIcon,
  Settings as SettingsIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { ThemeUpdateContext } from '../../context/ThemeContext';

// Largeur de la barre latérale
const DRAWER_WIDTH = 280;
const COLLAPSED_DRAWER_WIDTH = 70;

const MainLayout = ({ children, systemStatus }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const toggleTheme = useContext(ThemeUpdateContext);

  // État pour contrôler l'ouverture du drawer sur mobile
  const [mobileOpen, setMobileOpen] = useState(false);

  // État pour contrôler si le drawer est réduit (chargé depuis localStorage)
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(() => {
    const savedSettings = localStorage.getItem('uiSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        return settings.sidebarCollapsed !== undefined ? settings.sidebarCollapsed : true;
      } catch (error) {
        console.error('Error parsing UI settings:', error);
        return true;
      }
    }
    return true;
  });

  // État pour contrôler si le drawer est visible (pour le hover)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);

  // Référence pour le timer de délai
  const hoverTimerRef = useRef(null);

  // Fonction pour basculer l'ouverture du drawer sur mobile
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Fonction pour basculer la taille du drawer
  const toggleDrawerSize = () => {
    const newValue = !isDrawerCollapsed;
    setIsDrawerCollapsed(newValue);

    // Save to localStorage
    try {
      const savedSettings = localStorage.getItem('uiSettings');
      const settings = savedSettings ? JSON.parse(savedSettings) : {};
      settings.sidebarCollapsed = newValue;
      localStorage.setItem('uiSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving sidebar setting:', error);
    }
  };

  // Fonction pour gérer le hover sur la zone sensible
  const handleHoverEnter = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    setIsDrawerVisible(true);
  };

  // Fonction pour gérer la sortie du hover
  const handleHoverLeave = () => {
    hoverTimerRef.current = setTimeout(() => {
      setIsDrawerVisible(false);
    }, 300); // Délai avant de cacher le drawer
  };

  // Fonction pour naviguer et fermer le drawer sur mobile
  const navigateTo = (path) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // Navigation items
  const navigationItems = [
    { name: 'Tableau de bord', icon: <DashboardIcon />, path: '/' },
    { name: 'Chat', icon: <ChatIcon />, path: '/chat' },
    { name: 'Tâches', icon: <TaskIcon />, path: '/tasks' },
    { name: 'Mémoire', icon: <MemoryIcon />, path: '/memory' },
    { name: 'Paramètres', icon: <SettingsIcon />, path: '/settings' }
  ];

  // Contenu de la barre latérale (drawer)
  const drawerContent = (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        {/* Logo et titre */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isDrawerCollapsed ? 'center' : 'flex-start',
            py: 2,
            px: 2,
            borderBottom: `1px solid ${theme.palette.divider}`
          }}
        >
          <Box
            component="img"
            src="/neocortex-logo.svg"
            alt="NeoCortex Logo"
            className="logo-pulse"
            sx={{
              width: 40,
              height: 40,
              mr: isDrawerCollapsed ? 0 : 2
            }}
          />
          {!isDrawerCollapsed && (
            <Box>
              <Typography
                variant="h6"
                component="div"
                fontWeight="bold"
                sx={{
                  background: theme.palette.neocortex.gradient1,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                  letterSpacing: '0.5px'
                }}
              >
                NeoMaxAI1
              </Typography>
              <Typography
                variant="caption"
                sx={{ opacity: 0.7 }}
              >
                Surpassant Manus & GenSpark
              </Typography>
            </Box>
          )}
        </Box>

        {/* Statut du système */}
        {!isDrawerCollapsed ? (
          <Box
            sx={{
              py: 2,
              px: 2,
              backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(45, 156, 219, 0.1)'
                : 'rgba(45, 156, 219, 0.05)',
              mb: 2,
              borderBottom: `1px solid ${theme.palette.divider}`,
              overflow: 'hidden',
              width: '100%'
            }}
          >
            {/* Status indicator */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                mb: 1.5
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: systemStatus?.status === 'online' ? '#68D391' : '#E53E3E',
                  mr: 1
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  color: systemStatus?.status === 'online'
                    ? theme.palette.success.main
                    : theme.palette.error.main,
                  fontWeight: 'medium'
                }}
              >
                {systemStatus?.status === 'online' ? 'En ligne' : 'Hors ligne'}
              </Typography>
            </Box>

            {/* Model info */}
            <Box sx={{ width: '100%' }}>
              <Typography
                variant="body2"
                fontWeight="medium"
                sx={{ mb: 0.5 }}
              >
                Modèle:
              </Typography>
              <Box
                sx={{
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                  borderRadius: 1,
                  p: 1,
                  width: '100%'
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                    width: '100%',
                    display: 'block'
                  }}
                >
                  {systemStatus?.components?.llama_model?.model_display_name ||
                   systemStatus?.components?.llama_model?.ollama_model ||
                   systemStatus?.components?.llama_model?.model_name ||
                   'Inconnu'}
                </Typography>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              py: 2,
              mb: 2,
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Tooltip title={`Modèle: ${systemStatus?.components?.llama_model?.model_display_name ||
                              systemStatus?.components?.llama_model?.ollama_model ||
                              systemStatus?.components?.llama_model?.model_name ||
                              'Inconnu'}`}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: systemStatus?.status === 'online' ? '#68D391' : '#E53E3E',
                }}
              />
            </Tooltip>
          </Box>
        )}

        {/* Navigation */}
        <List sx={{ flexGrow: 1 }}>
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <ListItem
                key={item.path}
                onClick={() => navigateTo(item.path)}
                sx={{
                  cursor: 'pointer',
                  mb: 0.5,
                  mx: 1,
                  borderRadius: 2,
                  backgroundColor: isActive
                    ? theme.palette.mode === 'dark'
                      ? 'rgba(45, 156, 219, 0.15)'
                      : 'rgba(45, 156, 219, 0.1)'
                    : 'transparent',
                  '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(45, 156, 219, 0.1)'
                      : 'rgba(45, 156, 219, 0.05)',
                  },
                  position: 'relative',
                  overflow: 'hidden',
                  justifyContent: isDrawerCollapsed ? 'center' : 'flex-start',
                  px: isDrawerCollapsed ? 1 : 2
                }}
              >
                {isActive && (
                  <Box
                    component={motion.div}
                    layoutId="activeNav"
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 4,
                      borderRadius: 4,
                      backgroundColor: theme.palette.primary.main,
                    }}
                  />
                )}
                <Tooltip title={isDrawerCollapsed ? item.name : ""} placement="right">
                  <ListItemIcon
                    sx={{
                      color: isActive ? theme.palette.primary.main : 'inherit',
                      minWidth: isDrawerCollapsed ? 0 : 40,
                      mr: isDrawerCollapsed ? 0 : 2,
                      justifyContent: 'center'
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                </Tooltip>
                {!isDrawerCollapsed && (
                  <ListItemText
                    primary={item.name}
                    primaryTypographyProps={{
                      fontWeight: isActive ? 600 : 'normal',
                      color: isActive ? theme.palette.primary.main : 'inherit'
                    }}
                  />
                )}
              </ListItem>
            );
          })}
        </List>

        {/* Pied de la barre latérale */}
        <Box
          sx={{
            py: 2,
            px: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            justifyContent: isDrawerCollapsed ? 'center' : 'space-between',
            alignItems: 'center'
          }}
        >
          {!isDrawerCollapsed ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar
                  sx={{
                    width: 34,
                    height: 34,
                    backgroundColor: theme.palette.primary.dark,
                    fontSize: '1rem',
                    fontWeight: 'bold'
                  }}
                >
                  NC
                </Avatar>
                <Box sx={{ ml: 1 }}>
                  <Typography variant="body2" fontWeight="medium">
                    NeoMaxAI1
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    v1.0.0
                  </Typography>
                </Box>
              </Box>

              <Tooltip title="Changer de thème">
                <IconButton onClick={toggleTheme} size="small">
                  {theme.palette.mode === 'dark' ? (
                    <LightModeIcon fontSize="small" />
                  ) : (
                    <DarkModeIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <Tooltip title="Changer de thème">
              <IconButton onClick={toggleTheme} size="small">
                {theme.palette.mode === 'dark' ? (
                  <LightModeIcon fontSize="small" />
                ) : (
                  <DarkModeIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100vh' }}>
      {/* AppBar pour mobile */}
      <AppBar
        position="fixed"
        color="default"
        elevation={1}
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          display: { sm: 'none' },
          backdropFilter: 'blur(20px)',
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(26, 32, 44, 0.8)'
            : 'rgba(255, 255, 255, 0.8)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Box
            component="img"
            src="/neocortex-logo.svg"
            alt="NeoCortex Logo"
            sx={{ width: 32, height: 32, mr: 1 }}
          />
          <Typography
            variant="h6"
            component="div"
            fontWeight="bold"
            sx={{
              background: theme.palette.neocortex.gradient1,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent'
            }}
          >
            NeoMaxAI1
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Drawer temporaire pour mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            borderRight: `1px solid ${theme.palette.divider}`
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Hover zone for sidebar with indicator */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 20,
          height: '100%',
          zIndex: 1200,
          display: { xs: 'none', sm: 'block' }
        }}
        onMouseEnter={handleHoverEnter}
      >
        {/* Small indicator when sidebar is hidden */}
        {!isDrawerVisible && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: 5,
              width: 5,
              height: 50,
              backgroundColor: theme.palette.primary.main,
              borderRadius: '0 4px 4px 0',
              transform: 'translateY(-50%)',
              opacity: 0.7,
              '&:hover': {
                opacity: 1,
                width: 8,
                left: 4
              },
              transition: 'all 0.2s ease'
            }}
          />
        )}
      </Box>

      {/* Drawer permanent pour desktop */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: isDrawerCollapsed ? COLLAPSED_DRAWER_WIDTH : DRAWER_WIDTH,
            borderRight: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.neocortex.sidebar.background,
            transition: theme.transitions.create(['width', 'transform', 'box-shadow', 'opacity'], {
              easing: theme.transitions.easing.easeOut,
              duration: theme.transitions.duration.standard,
            }),
            overflowX: 'hidden',
            transform: isDrawerVisible ? 'translateX(0)' : 'translateX(-100%)',
            visibility: 'visible', // Always keep it in the DOM
            opacity: isDrawerVisible ? 1 : 0.95,
            // Only show box-shadow when visible
            boxShadow: isDrawerVisible ? theme.shadows[8] : 'none',
          },
        }}
        open
        onMouseEnter={handleHoverEnter}
        onMouseLeave={handleHoverLeave}
      >
        {drawerContent}

        {/* Toggle drawer size button */}
        <Box
          sx={{
            position: 'absolute',
            right: -12,
            top: '50%',
            zIndex: 1300,
            transform: 'translateY(-50%)',
            backgroundColor: theme.palette.background.paper,
            borderRadius: '50%',
            boxShadow: theme.shadows[3],
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          onClick={toggleDrawerSize}
        >
          <Box
            component="span"
            sx={{
              fontSize: '14px',
              transform: isDrawerCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 0.3s ease',
              display: 'flex'
            }}
          >
            {'❯'}
          </Box>
        </Box>
      </Drawer>

      {/* Zone de contenu principal */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: {
            xs: '100%',
            sm: isDrawerVisible
              ? (isDrawerCollapsed
                ? `calc(100% - ${COLLAPSED_DRAWER_WIDTH}px)`
                : `calc(100% - ${DRAWER_WIDTH}px)`)
              : '100%'
          },
          height: '100vh',
          overflow: 'auto',
          bgcolor: theme.palette.neocortex.mainContent.background,
          pt: { xs: 7, sm: 2 },  // Added padding-top for desktop view
          pl: { sm: 2 },         // Added left padding for better spacing
          pr: { xs: 2, sm: 3 },  // Added right padding
          boxSizing: 'border-box',// Ensure padding is included in width calculations
          transition: theme.transitions.create(['width', 'margin', 'padding', 'left'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.standard,
          }),
          ml: {
            xs: 0,
            sm: isDrawerVisible
              ? (isDrawerCollapsed ? COLLAPSED_DRAWER_WIDTH : DRAWER_WIDTH)
              : 0
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;