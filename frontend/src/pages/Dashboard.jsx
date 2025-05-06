import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  CardActions,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Psychology as PsychologyIcon,
  Task as TaskIcon,
  Memory as MemoryIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  Speed as SpeedIcon,
  Language as LanguageIcon,
  Computer as ComputerIcon,
  GitHub as GitHubIcon,
  Lightbulb as LightbulbIcon,
  ArrowForward as ArrowForwardIcon,
  SmartToy as SmartToyIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

// Enregistrement des composants nécessaires pour Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// Services
import ApiService from '../services/ApiService';

// Composants
const FeatureCard = ({ title, description, icon, disabled, onClick }) => {
  const theme = useTheme();

  return (
    <Card
      component={motion.div}
      whileHover={{ y: -5, boxShadow: theme.palette.neocortex.shadow }}
      transition={{ duration: 0.2 }}
      className="hover-card"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.mode === 'dark' ? theme.palette.neocortex.card.background : theme.palette.background.paper,
        opacity: disabled ? 0.6 : 1,
        border: `1px solid ${theme.palette.divider}`,
      }}
      elevation={2}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Avatar
            sx={{
              bgcolor: theme.palette.primary.main,
              color: '#fff',
              width: 40,
              height: 40,
              mr: 1.5,
            }}
          >
            {icon}
          </Avatar>
          <Typography variant="h6" component="div">
            {title}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
      <CardActions>
        <Button
          size="small"
          endIcon={<ArrowForwardIcon />}
          onClick={onClick}
          disabled={disabled}
          sx={{ ml: 'auto' }}
        >
          Explorer
        </Button>
      </CardActions>
    </Card>
  );
};

const Dashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // États
  const [loading, setLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [memories, setMemories] = useState([]);
  const [multiAgentSessions, setMultiAgentSessions] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Charger les données au montage du composant
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Récupérer le statut du système
        const status = await ApiService.getStatus();
        setSystemInfo(status);

        // Récupérer les tâches récentes
        setLoadingTasks(true);
        const tasksData = await ApiService.getTasks();
        setTasks(tasksData.tasks || []);
        setLoadingTasks(false);

        // Récupérer les séances multi-agents récentes
        if (status.components?.multiagent_system?.status === 'active') {
          const sessionsData = await ApiService.listMultiAgentSessions(3);
          setMultiAgentSessions(sessionsData.sessions || []);
        }

        // Récupérer les souvenirs récents
        const memoriesData = await ApiService.getMemories();
        setMemories((memoriesData.memories || []).slice(0, 3));

      } catch (error) {
        console.error('Erreur lors de la récupération des données du dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Données pour le graphique des capacités
  const capabilitiesData = {
    labels: ['Raisonnement', 'Recherche Web', 'Cognition Distribuée', 'Génération de Code', 'Mémoire Associative'],
    datasets: [
      {
        label: 'Capacités',
        data: [99, 98, 99, 97, 98],
        backgroundColor: [
          'rgba(45, 156, 219, 0.8)',
          'rgba(187, 107, 217, 0.8)',
          'rgba(242, 201, 76, 0.8)',
          'rgba(104, 211, 145, 0.8)',
          'rgba(99, 179, 237, 0.8)',
        ],
        borderColor: [
          'rgba(45, 156, 219, 1)',
          'rgba(187, 107, 217, 1)',
          'rgba(242, 201, 76, 1)',
          'rgba(104, 211, 145, 1)',
          'rgba(99, 179, 237, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Données pour le graphique de performances
  const performanceData = {
    labels: ['Raisonnement', 'Précision', 'Compréhension', 'Créativité', 'Résolution de problèmes'],
    datasets: [
      {
        label: 'NeoMaxAI1',
        data: [98, 97, 99, 96, 98],
        backgroundColor: 'rgba(45, 156, 219, 0.7)',
      },
      {
        label: 'Manus',
        data: [75, 85, 80, 70, 82],
        backgroundColor: 'rgba(187, 107, 217, 0.7)',
      },
      {
        label: 'GenSpark',
        data: [70, 80, 75, 85, 78],
        backgroundColor: 'rgba(242, 201, 76, 0.7)',
      },
    ],
  };

  // Options pour le graphique de performances
  const performanceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ${context.raw}/100`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          color: theme.palette.divider,
        },
      },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20,
        },
        grid: {
          color: theme.palette.divider,
        },
      },
    },
  };

  // Liste des fonctionnalités principales
  const features = [
    {
      id: 'chat',
      title: 'AGI Conversationnelle',
      description: 'Interagissez avec NeoMaxAI1 pour résoudre des problèmes complexes avec un raisonnement multi-étapes et une compréhension contextuelle profonde.',
      icon: <ChatIcon />,
      disabled: false,
      onClick: () => navigate('/chat'),
    },
    {
      id: 'multiagent',
      title: 'Cognition Distribuée',
      description: 'Bénéficiez d\'une architecture cognitive avancée qui décompose automatiquement les problèmes complexes en sous-tâches optimales.',
      icon: <PsychologyIcon />,
      disabled: false,
      onClick: () => navigate('/multi-agent'),
    },
    {
      id: 'tasks',
      title: 'Exécution Autonome',
      description: 'Déléguez des tâches complexes à NeoMaxAI1 qui les exécutera de manière autonome avec une capacité de raisonnement avancée.',
      icon: <TaskIcon />,
      disabled: false,
      onClick: () => navigate('/tasks'),
    },
    {
      id: 'memory',
      title: 'Mémoire Associative',
      description: 'Explorez le réseau neuronal associatif de NeoMaxAI1 qui lui permet de maintenir un contexte riche et de faire des connexions complexes.',
      icon: <MemoryIcon />,
      disabled: false,
      onClick: () => navigate('/memory'),
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* En-tête du tableau de bord */}
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        sx={{ mb: 4 }}
      >
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Bienvenue sur{' '}
          <Box component="span" sx={{
            background: theme.palette.neocortex.gradient1,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}>
            NeoMaxAI1
          </Box>
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          <Box component="span" fontWeight="medium">Intelligence Artificielle Générale (AGI)</Box> - Surpassant significativement les systèmes comme Manus et GenSpark
        </Typography>

        <Paper
          elevation={2}
          sx={{
            p: 2,
            mb: 3,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(45, 156, 219, 0.1)' : 'rgba(45, 156, 219, 0.05)',
            border: '1px solid',
            borderColor: theme.palette.primary.main,
            borderRadius: 2
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">
            Système AGI de nouvelle génération
          </Typography>
          <Typography variant="body2">
            NeoMaxAI1 représente une avancée majeure dans le domaine de l'intelligence artificielle, combinant raisonnement avancé,
            compréhension contextuelle profonde, et intégration transparente avec des outils externes. Contrairement aux assistants IA
            traditionnels, NeoMaxAI1 peut décomposer automatiquement les problèmes complexes, générer du code de qualité professionnelle,
            et maintenir une conscience de son propre raisonnement.
          </Typography>
        </Paper>

        {/* Statistiques système */}
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} md={4}>
            <Paper
              elevation={2}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                bgcolor: theme.palette.mode === 'dark' ? theme.palette.neocortex.card.background : theme.palette.background.paper,
              }}
            >
              <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                <SpeedIcon />
              </Avatar>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Modèle
                </Typography>
                <Typography variant="h6">
                  NeoMaxAI1
                </Typography>
                <Chip
                  size="small"
                  label="AGI"
                  color="primary"
                  sx={{ mt: 0.5 }}
                />
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper
              elevation={2}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                bgcolor: theme.palette.mode === 'dark' ? theme.palette.neocortex.card.background : theme.palette.background.paper,
              }}
            >
              <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}>
                <LightbulbIcon />
              </Avatar>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Mode Système
                </Typography>
                <Typography variant="h6">
                  {systemInfo?.components?.multiagent_system?.status === 'active' ? 'Multi-Agents' : 'Standard'}
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper
              elevation={2}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                bgcolor: theme.palette.mode === 'dark' ? theme.palette.neocortex.card.background : theme.palette.background.paper,
              }}
            >
              <Avatar sx={{ bgcolor: theme.palette.info.main, mr: 2 }}>
                <LanguageIcon />
              </Avatar>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Accès Web
                </Typography>
                <Typography variant="h6">
                  {systemInfo?.components?.web_researcher?.status === 'ready' ? 'Activé' : 'Désactivé'}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Fonctionnalités principales */}
      <Typography
        variant="h5"
        component={motion.h2}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        sx={{ mb: 2, fontWeight: 600 }}
      >
        Fonctionnalités principales
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {features.map((feature, index) => (
          <Grid
            item
            xs={12}
            sm={6}
            md={3}
            key={feature.id}
            component={motion.div}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * (index + 1) }}
          >
            <FeatureCard {...feature} />
          </Grid>
        ))}
      </Grid>

      {/* Visualisations et statistiques */}
      <Grid container spacing={3}>
        {/* Graphique des capacités */}
        <Grid
          item
          xs={12}
          md={4}
          component={motion.div}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Paper
            elevation={2}
            sx={{
              p: 3,
              height: '100%',
              bgcolor: theme.palette.mode === 'dark' ? theme.palette.neocortex.card.background : theme.palette.background.paper,
            }}
          >
            <Typography variant="h6" gutterBottom align="center">
              Capacités Cognitives de NeoMaxAI1
            </Typography>
            <Box sx={{ height: 240, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Doughnut
                data={capabilitiesData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        boxWidth: 12,
                      },
                    },
                  },
                }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Graphique de comparaison */}
        <Grid
          item
          xs={12}
          md={8}
          component={motion.div}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Paper
            elevation={2}
            sx={{
              p: 3,
              height: '100%',
              bgcolor: theme.palette.mode === 'dark' ? theme.palette.neocortex.card.background : theme.palette.background.paper,
            }}
          >
            <Typography variant="h6" gutterBottom align="center">
              NeoMaxAI1 vs Autres Systèmes
            </Typography>
            <Box sx={{ height: 240 }}>
              <Bar data={performanceData} options={performanceOptions} />
            </Box>
          </Paper>
        </Grid>

        {/* Tâches récentes */}
        <Grid
          item
          xs={12}
          md={6}
          component={motion.div}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Paper
            elevation={2}
            sx={{
              p: 3,
              height: '100%',
              bgcolor: theme.palette.mode === 'dark' ? theme.palette.neocortex.card.background : theme.palette.background.paper,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Tâches récentes
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/tasks')}
              >
                Voir tout
              </Button>
            </Box>

            <List>
              {loadingTasks ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : tasks.length > 0 ? (
                tasks.slice(0, 3).map((task) => (
                  <ListItem
                    key={task.id}
                    sx={{
                      mb: 1,
                      borderRadius: 1,
                      bgcolor: theme.palette.action.hover,
                    }}
                    secondaryAction={
                      <Chip
                        size="small"
                        label={task.status}
                        color={
                          task.status === 'completed'
                            ? 'success'
                            : task.status === 'failed'
                            ? 'error'
                            : task.status === 'in_progress'
                            ? 'warning'
                            : 'default'
                        }
                      />
                    }
                  >
                    <ListItemIcon>
                      <TaskIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={task.description.length > 50 ? `${task.description.substring(0, 50)}...` : task.description}
                      secondary={new Date(task.created_at).toLocaleDateString()}
                    />
                  </ListItem>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                  Aucune tâche récente.
                </Typography>
              )}

              {tasks.length > 0 && tasks.length < 3 && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AddIcon />}
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/tasks')}
                >
                  Créer une nouvelle tâche
                </Button>
              )}
            </List>
          </Paper>
        </Grid>

        {/* Sessions Multi-Agents */}
        <Grid
          item
          xs={12}
          md={6}
          component={motion.div}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Paper
            elevation={2}
            sx={{
              p: 3,
              height: '100%',
              bgcolor: theme.palette.mode === 'dark' ? theme.palette.neocortex.card.background : theme.palette.background.paper,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Sessions Multi-Agents
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/multi-agent')}
                disabled={systemInfo?.components?.multiagent_system?.status !== 'active'}
              >
                Voir tout
              </Button>
            </Box>

            {systemInfo?.components?.multiagent_system?.status === 'active' ? (
              <List>
                {multiAgentSessions.length > 0 ? (
                  multiAgentSessions.map((session) => (
                    <ListItem
                      key={session.id}
                      sx={{
                        mb: 1,
                        borderRadius: 1,
                        bgcolor: theme.palette.action.hover,
                      }}
                      secondaryAction={
                        <Chip
                          size="small"
                          label={session.status}
                          color={
                            session.status === 'completed'
                              ? 'success'
                              : session.status === 'failed' || session.status === 'cancelled'
                              ? 'error'
                              : session.status === 'executing' || session.status === 'planning'
                              ? 'warning'
                              : 'default'
                          }
                        />
                      }
                    >
                      <ListItemIcon>
                        <PsychologyIcon color="secondary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={session.task.length > 50 ? `${session.task.substring(0, 50)}...` : session.task}
                        secondary={new Date(session.created_at).toLocaleDateString()}
                      />
                    </ListItem>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                    Aucune session multi-agents récente.
                  </Typography>
                )}

                <Button
                  fullWidth
                  variant="outlined"
                  color="secondary"
                  startIcon={<PsychologyIcon />}
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/multi-agent')}
                >
                  Créer une nouvelle session multi-agents
                </Button>
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <SmartToyIcon sx={{ fontSize: 48, opacity: 0.5, mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Le système multi-agents est actuellement désactivé.
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate('/settings')}
                  sx={{ mt: 2 }}
                >
                  Activer dans les paramètres
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;