import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Box, useTheme } from '@mui/material';
import { AnimatePresence } from 'framer-motion';

// Context
import ChatProvider from './context/ChatContext';

// Layouts
import MainLayout from './components/layouts/MainLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import MultiAgent from './pages/MultiAgent';
import TasksPage from './pages/Tasks';
import Settings from './pages/Settings';

// Components
import LoadingScreen from './components/common/LoadingScreen';

// Services
import ApiService from './services/ApiService';

const App = () => {
  const theme = useTheme();
  const location = useLocation();

  // État pour les paramètres système
  const [systemStatus, setSystemStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Vérifier l'état du système au démarrage
  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        setIsLoading(true);
        const status = await ApiService.getStatus();
        setSystemStatus(status);
        setError(null);
      } catch (err) {
        console.error('Erreur lors de la vérification du statut système:', err);
        setError("Impossible de se connecter au serveur NeoCortex. Veuillez vérifier que le backend est en cours d'exécution.");
      } finally {
        setIsLoading(false);
      }
    };

    checkSystemStatus();

    // Vérifier périodiquement le statut du système
    const intervalId = setInterval(checkSystemStatus, 60000);

    return () => clearInterval(intervalId);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          p: 3,
          textAlign: 'center',
          bgcolor: theme.palette.background.default,
          color: theme.palette.text.primary,
        }}
      >
        <Box
          component="img"
          src="/neocortex-logo.svg"
          alt="NeoCortex Logo"
          sx={{ width: 80, height: 80, mb: 2, opacity: 0.5 }}
        />
        <Box sx={{ typography: 'h4', mb: 2, fontWeight: 'bold' }}>Erreur de connexion</Box>
        <Box sx={{ typography: 'body1', mb: 4, maxWidth: 500 }}>{error}</Box>
        <Box
          sx={{
            bgcolor: 'background.paper',
            p: 3,
            borderRadius: 2,
            maxWidth: 500,
            width: '100%',
          }}
        >
          <Box sx={{ typography: 'h6', mb: 1 }}>Conseils de dépannage:</Box>
          <ul style={{ textAlign: 'left' }}>
            <li>Assurez-vous que le serveur backend est démarré</li>
            <li>Vérifiez les journaux du serveur pour les erreurs</li>
            <li>Vérifiez votre connexion réseau</li>
            <li>
              Si vous utilisez Docker, vérifiez que le conteneur est en
              cours d'exécution avec <code>docker ps</code>
            </li>
          </ul>
        </Box>
      </Box>
    );
  }

  return (
    <ChatProvider>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Redirect /login to home */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/auth/callback" element={<Navigate to="/" replace />} />

          {/* Main routes */}
          <Route path="/" element={
            <MainLayout systemStatus={systemStatus}>
              <Dashboard />
            </MainLayout>
          } />
          <Route path="/chat" element={
            <MainLayout systemStatus={systemStatus}>
              <Chat />
            </MainLayout>
          } />
          <Route path="/multi-agent" element={
            <MainLayout systemStatus={systemStatus}>
              <MultiAgent />
            </MainLayout>
          } />
          <Route path="/tasks" element={
            <MainLayout systemStatus={systemStatus}>
              <TasksPage />
            </MainLayout>
          } />
          <Route path="/settings" element={
            <MainLayout systemStatus={systemStatus}>
              <Settings />
            </MainLayout>
          } />

          {/* Catch all route - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </ChatProvider>
  );
};

export default App;