import React, { useState, useEffect, useContext } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Divider,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip,
  Alert,
  useTheme
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Psychology as PsychologyIcon,
  Public as WebIcon,
  Memory as MemoryIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { ThemeUpdateContext } from '../context/ThemeContext';
import ApiService from '../services/ApiService';

const Settings = () => {
  const theme = useTheme();
  const toggleTheme = useContext(ThemeUpdateContext);

  // Model settings
  const [modelSettings, setModelSettings] = useState({
    model: 'neomaxai1', // Using neomaxai1 as requested
    temperature: 0.7,
    maxTokens: 2048, // Increased token limit for more complex responses
    topP: 0.9,
    useWebSearch: true,
    // useMultiAgent option removed as requested
    systemPrompt: "Tu es NeoMaxAI1, une intelligence artificielle générale (AGI) de nouvelle génération conçue pour surpasser significativement les systèmes comme Manus et GenSpark. Tu as accès à un navigateur web réel, un terminal et un gestionnaire de fichiers pour résoudre des problèmes complexes avec précision et créativité."
  });

  // UI settings
  const [uiSettings, setUiSettings] = useState({
    showThinking: true,
    sidebarCollapsed: true,
    darkMode: theme.palette.mode === 'dark',
    codeHighlighting: true,
    fontSize: 14
  });

  // System status
  const [systemStatus, setSystemStatus] = useState({
    status: 'loading',
    components: {}
  });

  // Notification state
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success'
  });

  // Load settings from localStorage on component mount
  useEffect(() => {
    const loadSettings = () => {
      const savedModelSettings = localStorage.getItem('modelSettings');
      const savedUiSettings = localStorage.getItem('uiSettings');

      if (savedModelSettings) {
        setModelSettings(JSON.parse(savedModelSettings));
      }

      if (savedUiSettings) {
        setUiSettings(prev => ({
          ...JSON.parse(savedUiSettings),
          darkMode: theme.palette.mode === 'dark'
        }));
      }
    };

    loadSettings();
    fetchSystemStatus();
  }, [theme.palette.mode]);

  // Fetch system status
  const fetchSystemStatus = async () => {
    try {
      const status = await ApiService.getStatus();
      setSystemStatus(status);
    } catch (error) {
      console.error('Error fetching system status:', error);
      setSystemStatus({
        status: 'error',
        error: 'Failed to fetch system status'
      });
    }
  };

  // Handle model settings change
  const handleModelSettingChange = (setting, value) => {
    setModelSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  // Handle UI settings change
  const handleUiSettingChange = (setting, value) => {
    setUiSettings(prev => ({
      ...prev,
      [setting]: value
    }));

    // Handle theme toggle
    if (setting === 'darkMode') {
      toggleTheme();
    }
  };

  // Save settings
  const saveSettings = () => {
    localStorage.setItem('modelSettings', JSON.stringify(modelSettings));
    localStorage.setItem('uiSettings', JSON.stringify(uiSettings));

    setNotification({
      show: true,
      message: 'Paramètres sauvegardés avec succès',
      type: 'success'
    });

    // Hide notification after 3 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // Reset settings to defaults
  const resetSettings = () => {
    const defaultModelSettings = {
      model: 'neomaxai1',
      temperature: 0.7,
      maxTokens: 1024,
      topP: 0.9,
      useWebSearch: true,
      useMultiAgent: true,
      systemPrompt: "Tu es NeoCortex, un agent IA surpuissant conçu pour surpasser les limites des systèmes actuels comme Manus et GenSpark. Tu vises à résoudre des problèmes complexes avec précision et créativité."
    };

    const defaultUiSettings = {
      showThinking: true,
      sidebarCollapsed: true,
      darkMode: theme.palette.mode === 'dark',
      codeHighlighting: true,
      fontSize: 14
    };

    setModelSettings(defaultModelSettings);
    setUiSettings(defaultUiSettings);

    setNotification({
      show: true,
      message: 'Paramètres réinitialisés aux valeurs par défaut',
      type: 'info'
    });

    // Hide notification after 3 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ mb: 4 }}>
        Paramètres
      </Typography>

      {/* Notification */}
      {notification.show && (
        <Alert
          severity={notification.type}
          sx={{ mb: 3 }}
          onClose={() => setNotification(prev => ({ ...prev, show: false }))}
        >
          {notification.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Model Settings */}
        <Grid item xs={12} md={6}>
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PsychologyIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Paramètres du modèle</Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Modèle actif
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="primary.main">
                  NeoMaxAI1
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Modèle de pointe optimisé pour les performances
                </Typography>
              </Box>

              <Typography gutterBottom>Température: {modelSettings.temperature}</Typography>
              <Slider
                value={modelSettings.temperature}
                min={0}
                max={1}
                step={0.1}
                onChange={(_, value) => handleModelSettingChange('temperature', value)}
                sx={{ mb: 3 }}
              />

              <Typography gutterBottom>Top P: {modelSettings.topP}</Typography>
              <Slider
                value={modelSettings.topP}
                min={0}
                max={1}
                step={0.1}
                onChange={(_, value) => handleModelSettingChange('topP', value)}
                sx={{ mb: 3 }}
              />

              <TextField
                fullWidth
                type="number"
                label="Tokens maximum"
                value={modelSettings.maxTokens}
                onChange={(e) => handleModelSettingChange('maxTokens', parseInt(e.target.value))}
                sx={{ mb: 3 }}
              />

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Prompt système"
                value={modelSettings.systemPrompt}
                onChange={(e) => handleModelSettingChange('systemPrompt', e.target.value)}
                sx={{ mb: 3 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={modelSettings.useWebSearch}
                    onChange={(e) => handleModelSettingChange('useWebSearch', e.target.checked)}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <WebIcon fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography>Recherche Web</Typography>
                  </Box>
                }
              />

              {/* Multi-Agent functionality completely removed as requested */}
            </CardContent>
          </Card>
        </Grid>

        {/* UI Settings */}
        <Grid item xs={12} md={6}>
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CodeIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Paramètres d'interface</Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={uiSettings.darkMode}
                    onChange={(e) => handleUiSettingChange('darkMode', e.target.checked)}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {uiSettings.darkMode ?
                      <LightModeIcon fontSize="small" sx={{ mr: 0.5 }} /> :
                      <DarkModeIcon fontSize="small" sx={{ mr: 0.5 }} />
                    }
                    <Typography>Mode sombre</Typography>
                  </Box>
                }
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={uiSettings.showThinking}
                    onChange={(e) => handleUiSettingChange('showThinking', e.target.checked)}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <MemoryIcon fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography>Afficher le processus de réflexion</Typography>
                  </Box>
                }
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={uiSettings.sidebarCollapsed}
                    onChange={(e) => handleUiSettingChange('sidebarCollapsed', e.target.checked)}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography>Barre latérale réduite par défaut</Typography>
                  </Box>
                }
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={uiSettings.codeHighlighting}
                    onChange={(e) => handleUiSettingChange('codeHighlighting', e.target.checked)}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CodeIcon fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography>Coloration syntaxique du code</Typography>
                  </Box>
                }
                sx={{ mb: 3 }}
              />

              <Typography gutterBottom>Taille de police: {uiSettings.fontSize}px</Typography>
              <Slider
                value={uiSettings.fontSize}
                min={12}
                max={20}
                step={1}
                onChange={(_, value) => handleUiSettingChange('fontSize', value)}
                sx={{ mb: 2 }}
              />
            </CardContent>
          </Card>

          {/* System Status */}
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Statut du système</Typography>
                <Tooltip title="Rafraîchir">
                  <IconButton size="small" onClick={fetchSystemStatus} sx={{ ml: 1 }}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="medium">
                  Statut:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: systemStatus.status === 'online' || systemStatus.status === 'ok'
                      ? 'success.main'
                      : systemStatus.status === 'loading'
                        ? 'info.main'
                        : 'error.main',
                  }}
                >
                  {systemStatus.status === 'online' || systemStatus.status === 'ok'
                    ? 'En ligne'
                    : systemStatus.status === 'loading'
                      ? 'Chargement...'
                      : 'Hors ligne'}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="medium">
                  Modèle actif:
                </Typography>
                <Typography variant="body2" fontFamily="monospace" fontWeight="bold" color="primary.main">
                  NeoMaxAI1
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={resetSettings}
        >
          Réinitialiser
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={saveSettings}
        >
          Sauvegarder
        </Button>
      </Box>
    </Box>
  );
};

export default Settings;
