import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Avatar,
  Chip,
  Grid,
  Divider,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  SvgIcon, // Correct import of SvgIcon from @mui/material
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  AccountTree as AccountTreeIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  ContentCopy as ContentCopyIcon,
  Search as SearchIcon,
  Code as CodeIcon,
  Edit as EditIcon,
  RateReview as RateReviewIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

// Services
import ApiService from '../services/ApiService';

// Interfaces agent prédéfinies
const AgentRoles = {
  RESEARCHER: 'researcher',
  PLANNER: 'planner',
  CODER: 'coder',
  WRITER: 'writer',
  CRITIC: 'critic',
  EXPERT: 'expert',
};

// Icône personnalisée pour l'agent expert
const ExpertIcon = (props) => (
  <SvgIcon {...props}>
    <path d="M12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2Z" />
  </SvgIcon>
);

// Icônes pour chaque rôle
const AgentIcons = {
  [AgentRoles.RESEARCHER]: (props) => <SearchIcon {...props} />,
  [AgentRoles.PLANNER]: (props) => <AccountTreeIcon {...props} />,
  [AgentRoles.CODER]: (props) => <CodeIcon {...props} />,
  [AgentRoles.WRITER]: (props) => <EditIcon {...props} />,
  [AgentRoles.CRITIC]: (props) => <RateReviewIcon {...props} />,
  [AgentRoles.EXPERT]: (props) => <ExpertIcon {...props} />,
};

// Composant MultiAgent
const MultiAgent = () => {
  const theme = useTheme();
  const [taskInput, setTaskInput] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [agents, setAgents] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [agentConfiguration, setAgentConfiguration] = useState([]);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const messagesEndRef = useRef(null);
  
  // Étapes du flux de travail multi-agents
  const steps = ['Planification', 'Exécution', 'Synthèse'];
  
  // Récupérer les sessions précédentes et la configuration des agents au chargement
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingHistory(true);
        
        // Récupérer les sessions précédentes
        const response = await ApiService.listMultiAgentSessions(5);
        setSessionHistory(response.sessions || []);
        
        // Récupérer la configuration des agents disponibles
        const agentsConfig = await ApiService.getAgentsConfig();
        setAgentConfiguration(agentsConfig.agents || []);
        
      } catch (error) {
        console.error('Erreur lors du chargement des données multi-agents:', error);
      } finally {
        setLoadingHistory(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Faire défiler vers le bas lorsque de nouveaux messages d'agents arrivent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agents]);
  
  // Démarrer une nouvelle session multi-agents
  const startSession = async () => {
    if (!taskInput.trim() || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      const response = await ApiService.createMultiAgentSession({
        task: taskInput,
      });
      
      if (response.session_id) {
        // Initialiser une nouvelle session
        const newSession = {
          id: response.session_id,
          task: taskInput,
          status: 'planning',
          created_at: new Date().toISOString(),
          agents: [],
        };
        
        setActiveSession(newSession);
        setCurrentStep(0);
        setAgents([]);
        
        // Mise à jour de l'historique des sessions
        setSessionHistory((prev) => [newSession, ...prev]);
        
        // Commencer à récupérer le flux de pensée des agents
        pollAgentsActivity(response.session_id);
      } else {
        throw new Error('Erreur lors de la création de la session');
      }
    } catch (error) {
      console.error('Erreur lors du démarrage de la session multi-agents:', error);
      setIsProcessing(false);
    }
  };
  
  // Interroger l'activité des agents à intervalles réguliers
  const pollAgentsActivity = async (sessionId) => {
    let polling = true;
    let finalStatus = null;
    
    const updateAgents = async () => {
      if (!polling) return;
      
      try {
        // Récupérer l'état actuel de la session
        const session = await ApiService.getMultiAgentSession(sessionId);
        
        // Si le statut a changé, mettre à jour le statut
        if (session.status !== activeSession?.status) {
          setActiveSession((prev) => ({ ...prev, status: session.status }));
          
          // Mettre à jour l'étape actuelle
          if (session.status === 'planning') {
            setCurrentStep(0);
          } else if (session.status === 'executing') {
            setCurrentStep(1);
          } else if (session.status === 'synthesizing' || session.status === 'completed') {
            setCurrentStep(2);
          }
        }
        
        // Récupérer l'activité des agents
        const activity = await ApiService.getAgentsActivity(sessionId);
        
        // Mettre à jour la liste des agents
        setAgents(activity.agents || []);
        
        // Définir le statut final si la tâche est terminée ou a échoué
        if (session.status === 'completed' || session.status === 'failed') {
          finalStatus = session.status;
          polling = false;
          setIsProcessing(false);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'activité des agents:', error);
        polling = false;
        setIsProcessing(false);
      }
      
      if (polling) {
        setTimeout(updateAgents, 3000);
      }
    };
    
    // Commencer l'interrogation
    updateAgents();
  };
  
  // Reprendre une session existante
  const resumeSession = async (session) => {
    if (isProcessing) return;
    
    setActiveSession(session);
    setIsProcessing(true);
    
    // Déterminer l'étape actuelle en fonction du statut
    if (session.status === 'planning') {
      setCurrentStep(0);
    } else if (session.status === 'executing') {
      setCurrentStep(1);
    } else if (session.status === 'synthesizing' || session.status === 'completed') {
      setCurrentStep(2);
    }
    
    try {
      // Récupérer l'activité des agents pour cette session
      const activity = await ApiService.getAgentsActivity(session.id);
      setAgents(activity.agents || []);
      
      // Si la session n'est pas terminée, continuer l'interrogation
      if (session.status !== 'completed' && session.status !== 'failed') {
        pollAgentsActivity(session.id);
      } else {
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Erreur lors de la reprise de la session:', error);
      setIsProcessing(false);
    }
  };
  
  // Annuler la session active
  const cancelSession = async () => {
    if (!activeSession || !isProcessing) return;
    
    try {
      await ApiService.cancelMultiAgentSession(activeSession.id);
      
      // Mettre à jour le statut localement
      setActiveSession((prev) => ({ ...prev, status: 'cancelled' }));
      setSessionHistory((prev) =>
        prev.map((session) =>
          session.id === activeSession.id ? { ...session, status: 'cancelled' } : session
        )
      );
      
      setIsProcessing(false);
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la session:', error);
    }
  };
  
  // Afficher la configuration des agents
  const handleConfigureAgents = () => {
    setConfigDialogOpen(true);
  };
  
  // Rendre les messages/pensées d'un agent
  const renderAgentThoughts = (agent, index) => {
    const progressStatus =
      agent.status === 'working' ? 'En cours...' :
      agent.status === 'completed' ? 'Terminé' :
      agent.status === 'failed' ? 'Échec' : 'En attente';

    return (
      <Accordion
        key={agent.id}
        elevation={2}
        component={motion.div}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        sx={{
          mb: 2,
          borderRadius: 2,
          overflow: 'hidden',
          border: `1px solid ${theme.palette.divider}`,
          '&:before': {
            display: 'none',
          },
          bgcolor: theme.palette.mode === 'dark' ? theme.palette.neocortex.card.background : theme.palette.background.paper,
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            borderLeft: '4px solid',
            borderLeftColor: agent.role === AgentRoles.PLANNER ? 'primary.main' :
                            agent.role === AgentRoles.RESEARCHER ? 'info.main' :
                            agent.role === AgentRoles.CODER ? 'success.main' :
                            agent.role === AgentRoles.WRITER ? 'secondary.main' :
                            agent.role === AgentRoles.CRITIC ? 'warning.main' : 'error.main',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 2 }}>
            <Avatar
              sx={{
                bgcolor: agent.role === AgentRoles.PLANNER ? theme.palette.primary.main :
                        agent.role === AgentRoles.RESEARCHER ? theme.palette.info.main :
                        agent.role === AgentRoles.CODER ? theme.palette.success.main :
                        agent.role === AgentRoles.WRITER ? theme.palette.secondary.main :
                        agent.role === AgentRoles.CRITIC ? theme.palette.warning.main : theme.palette.error.main,
                mr: 2,
              }}
            >
              {agent.role === AgentRoles.PLANNER && <AccountTreeIcon />}
              {agent.role === AgentRoles.RESEARCHER && <SearchIcon />}
              {agent.role === AgentRoles.CODER && <CodeIcon />}
              {agent.role === AgentRoles.WRITER && <EditIcon />}
              {agent.role === AgentRoles.CRITIC && <RateReviewIcon />}
              {agent.role === AgentRoles.EXPERT && <ExpertIcon />}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                {agent.name || `Agent ${agent.role.charAt(0).toUpperCase() + agent.role.slice(1)}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {agent.description || `Un agent spécialisé dans le rôle de ${agent.role}`}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={progressStatus}
              color={
                agent.status === 'completed' ? 'success' :
                agent.status === 'failed' ? 'error' :
                agent.status === 'working' ? 'warning' : 'default'
              }
              icon={
                agent.status === 'completed' ? <CheckIcon /> :
                agent.status === 'failed' ? <ErrorIcon /> :
                agent.status === 'working' ? <CircularProgress size={16} /> : null
              }
            />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {agent.thoughts && agent.thoughts.length > 0 ? (
            <Box>
              {agent.thoughts.map((thought, idx) => (
                <Box key={idx} sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {new Date(thought.timestamp).toLocaleTimeString()} - {thought.type || 'Réflexion'}
                  </Typography>
                  <Box
                    sx={{
                      bgcolor: theme.palette.action.hover,
                      borderRadius: 1,
                      p: 2,
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={theme.palette.mode === 'dark' ? oneDark : oneLight}
                              language={match[1]}
                              PreTag="div"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {thought.content}
                    </ReactMarkdown>
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
              Cet agent n'a pas encore partagé ses réflexions.
            </Typography>
          )}
          
          {agent.outputs && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Résultats de l'agent:
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: 'success.light',
                  color: 'success.contrastText',
                  borderRadius: 1,
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={theme.palette.mode === 'dark' ? oneDark : oneLight}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {agent.outputs}
                </ReactMarkdown>
              </Paper>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    );
  };
  
  // Rendu du résultat final
  const renderFinalResult = () => {
    if (!activeSession || !activeSession.final_result) return null;
    
    return (
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        sx={{ mt: 4 }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 3,
            borderRadius: 2,
            bgcolor: theme.palette.mode === 'dark'
              ? theme.palette.neocortex.card.background
              : theme.palette.background.paper,
          }}
        >
          <Typography variant="h6" gutterBottom>
            Résultat final
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={theme.palette.mode === 'dark' ? oneDark : oneLight}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {activeSession.final_result}
          </ReactMarkdown>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              startIcon={<ContentCopyIcon />}
              onClick={() => navigator.clipboard.writeText(activeSession.final_result)}
            >
              Copier
            </Button>
            <Button
              startIcon={<SaveIcon />}
              onClick={() => {/* Fonction pour sauvegarder le résultat */}}
              sx={{ ml: 1 }}
            >
              Sauvegarder
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  };
  
  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* En-tête */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          component={motion.h1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          fontWeight="bold"
          gutterBottom
        >
          <PsychologyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Système Multi-Agents
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Résolvez des problèmes complexes en décomposant les tâches entre plusieurs agents IA spécialisés qui collaborent ensemble.
        </Typography>
      </Box>
      
      {/* Section principale */}
      <Grid container spacing={3} sx={{ flexGrow: 1 }}>
        {/* Panneau principal (formulation de tâche ou session active) */}
        <Grid item xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column' }}>
          <Paper
            elevation={2}
            sx={{
              p: 3,
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              bgcolor: theme.palette.mode === 'dark' ? theme.palette.neocortex.card.background : theme.palette.background.paper,
            }}
          >
            {!activeSession ? (
              // Formulaire de nouvelle tâche
              <Box
                component={motion.div}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}
              >
                <Typography variant="h6" gutterBottom>
                  Nouvelle tâche multi-agents
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Décrivez une tâche complexe et laissez notre système multi-agents la décomposer et la résoudre.
                </Typography>
                <TextField
                  multiline
                  rows={6}
                  fullWidth
                  variant="outlined"
                  placeholder="Décrivez votre tâche en détail (par exemple : 'Analysez les tendances actuelles du marché de l'IA et rédigez un rapport de 500 mots avec des recommandations stratégiques')"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 'auto' }}>
                  <Button
                    variant="outlined"
                    startIcon={<PsychologyIcon />}
                    onClick={handleConfigureAgents}
                  >
                    Configurer les agents
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PlayArrowIcon />}
                    onClick={startSession}
                    disabled={!taskInput.trim() || isProcessing}
                  >
                    Démarrer
                  </Button>
                </Box>
              </Box>
            ) : (
              // Session active
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Tâche en cours
                  </Typography>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="body1">{activeSession.task}</Typography>
                  </Paper>
                </Box>
                
                <Stepper
                  activeStep={currentStep}
                  alternativeLabel
                  sx={{ mb: 3, '& .MuiStepLabel-root .Mui-active': { color: 'primary.main' } }}
                >
                  {steps.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
                
                <Typography variant="subtitle1" gutterBottom>
                  Activité des agents
                </Typography>
                
                <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }}>
                  {agents.length > 0 ? (
                    agents.map((agent, index) => renderAgentThoughts(agent, index))
                  ) : (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                      }}
                    >
                      <CircularProgress size={40} sx={{ mb: 2 }} />
                      <Typography variant="body2">
                        Initialisation des agents...
                      </Typography>
                    </Box>
                  )}
                  <div ref={messagesEndRef} />
                </Box>
                
                {/* Résultat final */}
                {(activeSession.status === 'completed' || activeSession.final_result) && renderFinalResult()}
                
                {/* Actions pour la session active */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 'auto', pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<CloseIcon />}
                    onClick={cancelSession}
                    disabled={!isProcessing || activeSession.status === 'completed' || activeSession.status === 'failed'}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<RefreshIcon />}
                    onClick={() => resumeSession(activeSession)}
                    disabled={isProcessing || activeSession.status !== 'completed'}
                  >
                    Relancer
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setActiveSession(null);
                      setTaskInput('');
                      setAgents([]);
                    }}
                    disabled={isProcessing}
                  >
                    Nouvelle tâche
                  </Button>
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Panneau latéral (historique des sessions) */}
        <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column' }}>
          <Paper
            elevation={2}
            sx={{
              p: 3,
              borderRadius: 2,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: theme.palette.mode === 'dark' ? theme.palette.neocortex.card.background : theme.palette.background.paper,
            }}
          >
            <Typography variant="h6" gutterBottom>
              Sessions récentes
            </Typography>
            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
              {loadingHistory ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : sessionHistory.length > 0 ? (
                <List sx={{ '& > li': { mb: 1 } }}>
                  {sessionHistory.map((session) => (
                    <ListItem
                      key={session.id}
                      component={motion.div}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      sx={{
                        bgcolor: theme.palette.action.hover,
                        borderRadius: 1,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: theme.palette.action.selected },
                        border: session.id === activeSession?.id ? `2px solid ${theme.palette.primary.main}` : 'none',
                      }}
                      onClick={() => resumeSession(session)}
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
                        <PsychologyIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          session.task.length > 40
                            ? `${session.task.substring(0, 40)}...`
                            : session.task
                        }
                        secondary={new Date(session.created_at).toLocaleDateString()}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    p: 3,
                  }}
                >
                  <PsychologyIcon sx={{ fontSize: 48, mb: 2, opacity: 0.6 }} />
                  <Typography variant="body2" color="text.secondary" align="center">
                    Vous n'avez pas encore de sessions multi-agents.
                    Commencez par créer une nouvelle tâche.
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Dialogue de configuration des agents */}
      <Dialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Configuration des agents</DialogTitle>
        <IconButton
          aria-label="close"
          onClick={() => setConfigDialogOpen(false)}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Personnalisez les agents qui travailleront sur votre tâche. Vous pouvez activer ou désactiver des agents selon vos besoins.
          </Typography>
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {Object.values(AgentRoles).map((role) => (
              <Grid item xs={12} sm={6} key={role}>
                <Card sx={{ mb: 2 }}>
                  <CardHeader
                    avatar={
                      <Avatar
                        sx={{
                          bgcolor: 
                            role === AgentRoles.PLANNER ? 'primary.main' :
                            role === AgentRoles.RESEARCHER ? 'info.main' :
                            role === AgentRoles.CODER ? 'success.main' :
                            role === AgentRoles.WRITER ? 'secondary.main' :
                            role === AgentRoles.CRITIC ? 'warning.main' : 'error.main',
                        }}
                      >
                        {role.charAt(0).toUpperCase()}
                      </Avatar>
                    }
                    title={`Agent ${role.charAt(0).toUpperCase() + role.slice(1)}`}
                    action={
                      <Chip label="Actif" color="success" size="small" />
                    }
                  />
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      {role === AgentRoles.PLANNER && "Coordonne le travail et décompose les tâches complexes en sous-tâches."}
                      {role === AgentRoles.RESEARCHER && "Collecte et analyse des informations pertinentes pour la tâche."}
                      {role === AgentRoles.CODER && "Écrit et teste du code pour résoudre des problèmes techniques."}
                      {role === AgentRoles.WRITER && "Rédige et formate du contenu textuel de qualité."}
                      {role === AgentRoles.CRITIC && "Révise et améliore le travail des autres agents."}
                      {role === AgentRoles.EXPERT && "Apporte une expertise spécialisée dans un domaine spécifique."}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={() => setConfigDialogOpen(false)}>
            Appliquer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MultiAgent;