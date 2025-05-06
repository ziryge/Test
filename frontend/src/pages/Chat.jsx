import React, { useRef, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Paper,
  Chip,
  CircularProgress,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  Badge,
  Switch,
  FormControlLabel,
  useTheme,
  Drawer,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Send as SendIcon,
  MoreVert as MoreVertIcon,
  Psychology as PsychologyIcon,
  Search as SearchIcon,
  Code as CodeIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Language as LanguageIcon,
  Memory as MemoryIcon,
  Public as PublicIcon,
  Terminal as TerminalIcon,
  Folder as FolderIcon,
  Screenshot as ScreenshotIcon,
} from '@mui/icons-material';

// Components
import ThinkingDisplay from '../components/chat/ThinkingDisplay';
import Terminal from '../components/terminal/Terminal';
import FileExplorer from '../components/filesystem/FileExplorer';
import WebBrowser from '../components/browser/WebBrowser';

// Context
import { useChat, MessageType } from '../context/ChatContext';

// Services
import FileSystemService from '../services/FileSystemService';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

// Services
import ApiService from '../services/ApiService';

const Chat = () => {
  const theme = useTheme();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Get chat context
  const {
    messages,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages,
    chatSettings,
    updateChatSettings,
    currentThinking,
    setCurrentThinking,
    currentModelName,
    setCurrentModelName,
    activeSources,
    setActiveSources,
    isProcessing,
    setIsProcessing
  } = useChat();

  // Local states
  const [input, setInput] = useState('');
  const [contextActionsAnchorEl, setContextActionsAnchorEl] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showSearchHints, setShowSearchHints] = useState(false);

  // Tool states
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [fileExplorerOpen, setFileExplorerOpen] = useState(false);
  const [webBrowserOpen, setWebBrowserOpen] = useState(false);
  const [screenshotData, setScreenshotData] = useState(null);

  // Destructure chat settings for easier access
  const { useWebSearch, useMultiAgent } = chatSettings;

  // Effet pour faire défiler vers le bas à chaque nouveau message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    // Process AI commands in the latest message
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage.type === MessageType.AI) {
        processAICommands(latestMessage);
      }
    }
  }, [messages]);

  // Effet pour ajouter un message d'accueil si aucun message n'existe
  // et pour réinitialiser le thinking process lors du chargement de la page
  useEffect(() => {
    // Clear thinking process on page load/refresh
    setCurrentThinking(null);

    if (messages.length === 0) {
      addMessage({
        id: 'welcome',
        type: MessageType.SYSTEM,
        content: "# Bienvenue sur NeoMaxAI1 - Intelligence Artificielle Générale 👋\n\nJe suis NeoMaxAI1, une intelligence artificielle générale (AGI) de nouvelle génération, conçue pour surpasser significativement les systèmes comme Manus et GenSpark.\n\n## Mes capacités avancées incluent:\n\n- **Raisonnement multi-étapes complexe** avec une profondeur cognitive exceptionnelle\n- **Compréhension contextuelle approfondie** et mémoire à long terme\n- **Génération de code de qualité professionnelle** avec une compréhension architecturale\n- **Recherche d'informations en temps réel** sur le web avec intégration transparente\n- **Exécution de commandes** dans un terminal intégré\n- **Navigation web intelligente** avec captures d'écran et analyse de contenu\n- **Création et modification de fichiers** avec compréhension du contexte\n- **Décomposition automatique** des problèmes complexes en sous-tâches gérables\n\n## Comment puis-je vous assister aujourd'hui?\n\nPosez-moi n'importe quelle question ou décrivez un problème complexe, et je vous montrerai comment une véritable AGI peut vous aider.",
        timestamp: new Date(),
      });
    }
  }, [messages.length, addMessage, setCurrentThinking]);

  // State for tool initial values
  const [initialUrl, setInitialUrl] = useState('');
  const [initialCommand, setInitialCommand] = useState('');
  const [initialPath, setInitialPath] = useState('');

  // Function to detect and process AI commands in messages
  const processAICommands = (message) => {
    if (message.type !== MessageType.AI) return;

    const content = message.content || '';

    // Check for command patterns
    const browserCommandRegex = /```browser\s+([^`]+)```/g;
    const terminalCommandRegex = /```terminal\s+([^`]+)```/g;
    const fileCommandRegex = /```file\s+([^`]+)```/g;

    // Process browser commands
    const browserMatches = [...content.matchAll(browserCommandRegex)];
    if (browserMatches.length > 0) {
      const url = browserMatches[0][1].trim();
      if (url) {
        setInitialUrl(url);
        setWebBrowserOpen(true);
      }
    }

    // Process terminal commands
    const terminalMatches = [...content.matchAll(terminalCommandRegex)];
    if (terminalMatches.length > 0) {
      const command = terminalMatches[0][1].trim();
      if (command) {
        setInitialCommand(command);
        setTerminalOpen(true);
      }
    }

    // Process file commands
    const fileMatches = [...content.matchAll(fileCommandRegex)];
    if (fileMatches.length > 0) {
      const path = fileMatches[0][1].trim();
      if (path) {
        setInitialPath(path);
        setFileExplorerOpen(true);
      }
    }

    // Check for screenshot requests
    if (content.includes('![Screenshot]') || content.toLowerCase().includes('capture d\'écran')) {
      // Extract URL from the message if possible
      const urlMatch = content.match(/https?:\/\/[^\s)]+/);
      if (urlMatch) {
        setInitialUrl(urlMatch[0]);
      }
      setWebBrowserOpen(true);
    }
  };

  // Gestion de l'envoi de message
  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = {
      id: Date.now().toString(),
      type: MessageType.USER,
      content: input.trim(),
      timestamp: new Date(),
    };

    // Add user message to chat
    addMessage(userMessage);
    setInput('');
    setIsProcessing(true);

    // Réinitialiser le thinking
    setCurrentThinking(null);

    // Créer un ID unique pour la réponse de l'IA
    const aiResponseId = `ai-${Date.now()}`;

    // Ajouter un message initial vide pour l'IA (sera mis à jour pendant le streaming)
    addMessage({
      id: aiResponseId,
      type: MessageType.AI,
      content: '',
      thinking: '',
      sources: [],
      timestamp: new Date(),
      model: currentModelName,
      usedWebSearch: useWebSearch,
      usedMultiAgent: useMultiAgent,
      streaming: true
    });

    try {
      // Appel à l'API pour obtenir une réponse avec les options activées et le streaming
      await ApiService.sendQuery(userMessage.content, {
        useWebSearch: useWebSearch,
        useMultiAgent: useMultiAgent,
        useStreaming: true,
        // Callback pour chaque morceau de texte reçu
        onChunk: (_, fullText) => {
          // Mettre à jour le message de l'IA avec le texte reçu jusqu'à présent
          updateMessage(aiResponseId, {
            content: fullText
          });
        },
        // Callback pour les informations de réflexion
        onThinking: (thinking) => {
          if (thinking) {
            setCurrentThinking(thinking);
          }
        },
        // Callback à la fin du streaming
        onDone: (finalResponse) => {
          // Mettre à jour le message de l'IA avec toutes les informations finales
          updateMessage(aiResponseId, {
            content: finalResponse.response,
            thinking: finalResponse.thinking || "",
            sources: finalResponse.sources || [],
            model: finalResponse.model || currentModelName,
            usedWebSearch: finalResponse.usedWebSearch || false,
            usedMultiAgent: finalResponse.usedMultiAgent || false,
            streaming: false
          });

          // Mettre à jour le nom du modèle si disponible
          if (finalResponse.model) {
            setCurrentModelName(finalResponse.model);
          }

          // Si des sources sont présentes, les ajouter à l'état
          if (finalResponse.sources && finalResponse.sources.length > 0) {
            setActiveSources(finalResponse.sources);
          }

          // Update chat settings based on what was used
          updateChatSettings({
            useWebSearch: finalResponse.usedWebSearch !== undefined ? finalResponse.usedWebSearch : useWebSearch,
            useMultiAgent: finalResponse.usedMultiAgent !== undefined ? finalResponse.usedMultiAgent : useMultiAgent
          });

          // Fin du traitement
          setIsProcessing(false);
        }
      });

    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);

      // Supprimer le message de streaming en cas d'erreur
      removeMessage(aiResponseId);

      // Ajout d'un message d'erreur avec plus de détails
      addMessage({
        id: `error-${Date.now()}`,
        type: MessageType.ERROR,
        content: `Désolé, une erreur s'est produite lors du traitement de votre message: ${error.message}. Veuillez réessayer.`,
        timestamp: new Date(),
      });

      // Fin du traitement
      setIsProcessing(false);
    }
  };

  // Gérer la soumission via touche Entrée (mais Maj+Entrée pour nouvelle ligne)
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Gestion des actions de contexte (menu pour chaque message)
  const handleContextMenu = (event, message) => {
    event.preventDefault();
    setContextActionsAnchorEl(event.currentTarget);
    setSelectedMessage(message);
  };

  // Fermeture du menu contextuel
  const handleCloseContextMenu = () => {
    setContextActionsAnchorEl(null);
    setSelectedMessage(null);
  };

  // Copier le contenu d'un message
  const handleCopyMessage = () => {
    if (selectedMessage) {
      navigator.clipboard.writeText(selectedMessage.content);
      handleCloseContextMenu();
    }
  };

  // Enregistrer le message dans la mémoire
  const handleSaveToMemory = async () => {
    if (selectedMessage) {
      try {
        await ApiService.storeMemory(selectedMessage.content, {
          type: 'chat_message',
          messageType: selectedMessage.type,
          timestamp: selectedMessage.timestamp,
        });
      } catch (error) {
        console.error("Erreur lors de l'enregistrement en mémoire:", error);
      }
      handleCloseContextMenu();
    }
  };

  // Supprimer un message
  const handleDeleteMessage = () => {
    if (selectedMessage) {
      removeMessage(selectedMessage.id);
      handleCloseContextMenu();
    }
  };

  // Helper function to safely format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';

    try {
      // If timestamp is a string, try to convert it to a Date object
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '';
    }
  };

  // Focus sur le champ d'entrée au chargement
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Gestion de la détection d'un sujet de recherche dans l'entrée
  useEffect(() => {
    const searchTerms = [
      'recherche',
      'cherche',
      'trouve',
      'google',
      'web',
      'internet',
      'search',
      'find',
    ];
    const inputLower = input.toLowerCase();

    // Vérifier si l'entrée contient des termes de recherche
    const containsSearchTerm = searchTerms.some((term) =>
      inputLower.includes(term)
    );

    setShowSearchHints(containsSearchTerm && input.length > 10);
  }, [input]);

  // Rendu d'un message
  const renderMessage = (message) => {
    switch (message.type) {
      case MessageType.USER:
        return (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              mb: 2,
              maxWidth: '90%',
              alignSelf: 'flex-end',
            }}
            component={motion.div}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Box sx={{ mr: 2, maxWidth: '80%' }}>
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  bgcolor: theme.palette.primary.main,
                  color: '#fff',
                  borderRadius: '16px 16px 4px 16px',
                }}
                onContextMenu={(e) => handleContextMenu(e, message)}
              >
                <Typography variant="body1">{message.content}</Typography>
              </Paper>
              <Typography
                variant="caption"
                sx={{ display: 'block', textAlign: 'right', mt: 0.5, color: 'text.secondary' }}
              >
                {formatTimestamp(message.timestamp)}
              </Typography>
            </Box>
            <Avatar
              sx={{ bgcolor: theme.palette.primary.dark }}
              alt="Utilisateur"
            >
              U
            </Avatar>
          </Box>
        );

      case MessageType.AI:
        return (
          <Box
            sx={{
              display: 'flex',
              mb: 2,
              maxWidth: '90%',
              alignSelf: 'flex-start',
            }}
            component={motion.div}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                <Box
                  component="span"
                  sx={{
                    bgcolor: theme.palette.success.main,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: `2px solid ${theme.palette.background.paper}`,
                  }}
                />
              }
            >
              <Avatar
                sx={{
                  background: theme.palette.neocortex.gradient1,
                }}
                alt="NeoMaxAI1"
              >
                NM
              </Avatar>
            </Badge>
            <Box sx={{ ml: 2, maxWidth: '80%' }}>
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  bgcolor: theme.palette.mode === 'dark'
                    ? theme.palette.neocortex.card.background
                    : theme.palette.background.paper,
                  borderRadius: '16px 16px 16px 4px',
                  position: 'relative',
                }}
                onContextMenu={(e) => handleContextMenu(e, message)}
              >
                {message.typing ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      NeoMaxAI1 réfléchit
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      {[0, 1, 2].map((i) => (
                        <Box
                          key={i}
                          component={motion.div}
                          sx={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            bgcolor: 'text.secondary',
                          }}
                          animate={{
                            y: [0, -5, 0],
                          }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                ) : (
                  <Box>
                    {/* Indicateurs d'agents/capacités utilisés */}
                    {(message.agents || message.thinking) && (
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.5,
                          mb: 1,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Tooltip title="Système multi-agents">
                          <Chip
                            size="small"
                            icon={<PsychologyIcon fontSize="small" />}
                            label="Multi-Agents"
                            variant="outlined"
                            color="primary"
                            sx={{ height: 24 }}
                          />
                        </Tooltip>
                        {message.sources && message.sources.length > 0 && (
                          <Tooltip title="Recherche Web">
                            <Chip
                              size="small"
                              icon={<LanguageIcon fontSize="small" />}
                              label="Web"
                              variant="outlined"
                              color="info"
                              sx={{ height: 24 }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    )}

                    {/* Contenu du message avec Markdown */}
                    <Box sx={{ wordBreak: 'break-word' }}>
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
                        {message.content}
                      </ReactMarkdown>
                    </Box>

                    {/* Sources des informations */}
                    {message.sources && message.sources.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          Sources:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                          {message.sources.map((source, index) => (
                            <Chip
                              key={index}
                              size="small"
                              label={source.title || `Source ${index + 1}`}
                              color="primary"
                              variant="outlined"
                              onClick={() => window.open(source.url, '_blank')}
                              sx={{ height: 24, maxWidth: '100%', textOverflow: 'ellipsis' }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}
              </Paper>
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
              >
                {formatTimestamp(message.timestamp)}
                {' · '}
                <Typography
                  variant="caption"
                  color="primary"
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleContextMenu({ currentTarget: document.body }, message)}
                >
                  Plus d'options
                </Typography>
              </Typography>
            </Box>
          </Box>
        );

      case MessageType.SYSTEM:
        return (
          <Box
            sx={{
              p: 2,
              my: 2,
              borderRadius: 2,
              bgcolor: 'rgba(66, 153, 225, 0.07)',
              maxWidth: '96%',
              mx: 'auto',
              borderLeft: '4px solid',
              borderLeftColor: 'primary.main',
            }}
            component={motion.div}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
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
              {message.content}
            </ReactMarkdown>
          </Box>
        );

      case MessageType.ERROR:
        return (
          <Box
            sx={{
              p: 2,
              my: 2,
              borderRadius: 2,
              bgcolor: 'rgba(229, 62, 62, 0.07)',
              maxWidth: '96%',
              mx: 'auto',
              borderLeft: '4px solid',
              borderLeftColor: 'error.main',
            }}
            component={motion.div}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Typography color="error" variant="body2">
              <strong>Erreur:</strong> {message.content}
            </Typography>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Zone des messages */}
      <Box
        sx={{
          flexGrow: 1,
          p: 2,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.map((message) => (
          <Box key={message.id}>
            {renderMessage(message)}
          </Box>
        ))}
        <Box ref={messagesEndRef} />
      </Box>

      {/* Affichage des indices de recherche */}
      {showSearchHints && (
        <Paper
          elevation={2}
          sx={{
            mx: 2,
            mb: 2,
            p: 2,
            bgcolor: theme.palette.mode === 'dark'
              ? 'rgba(45, 55, 72, 0.5)'
              : 'rgba(237, 242, 247, 0.8)',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <SearchIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="body2" color="text.secondary">
            Je vais rechercher des informations actualisées sur le web pour vous aider.
          </Typography>
        </Paper>
      )}

      {/* Thinking Display */}
      {currentThinking && (
        <ThinkingDisplay
          thinking={currentThinking}
          modelName={currentModelName}
        />
      )}

      {/* Zone de saisie du message */}
      <Paper
        elevation={3}
        sx={{
          p: 2,
          mx: 2,
          mb: 2,
          borderRadius: 3,
          bgcolor: theme.palette.mode === 'dark'
            ? theme.palette.neocortex.card.background
            : theme.palette.background.paper,
        }}
      >
        {/* Options row */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            mb: 2,
            flexWrap: 'wrap'
          }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={useWebSearch}
                onChange={(e) => updateChatSettings({ useWebSearch: e.target.checked })}
                color="primary"
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PublicIcon fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="body2">Recherche Web</Typography>
              </Box>
            }
          />
        </Box>

        <TextField
          fullWidth
          multiline
          maxRows={6}
          variant="outlined"
          placeholder="Entrez votre message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          inputRef={inputRef}
          InputProps={{
            endAdornment: (
              <IconButton
                color="primary"
                onClick={handleSendMessage}
                disabled={isProcessing || !input.trim()}
                sx={{
                  bgcolor: 'primary.main',
                  color: '#fff',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                  '&.Mui-disabled': {
                    bgcolor: 'action.disabledBackground',
                    color: 'action.disabled',
                  },
                  ml: 1,
                }}
              >
                {isProcessing ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
              </IconButton>
            ),
            sx: {
              borderRadius: 3,
              fontSize: '1rem',
              lineHeight: 1.5,
              p: 1.5,
              '&.MuiOutlinedInput-root': {
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.primary.main,
                  borderWidth: 2,
                },
              },
            },
          }}
        />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 1,
            px: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Shift + Enter pour une nouvelle ligne
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Effacer la conversation">
              <IconButton
                size="small"
                color="inherit"
                onClick={() => {
                  if (window.confirm("Êtes-vous sûr de vouloir effacer toute la conversation ?")) {
                    clearMessages();
                    // Close all tools when conversation is cleared
                    setTerminalOpen(false);
                    setFileExplorerOpen(false);
                    setWebBrowserOpen(false);
                  }
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Tools */}
      {terminalOpen && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 100,
            right: 20,
            width: 600,
            height: 400,
            zIndex: 1000,
            boxShadow: theme.shadows[10],
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Terminal
            onClose={() => {
              setTerminalOpen(false);
              setInitialCommand('');
            }}
            initialCommand={initialCommand}
          />
        </Box>
      )}

      {fileExplorerOpen && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 100,
            right: 20,
            width: 600,
            height: 500,
            zIndex: 1000,
            boxShadow: theme.shadows[10],
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <FileExplorer
            onClose={() => {
              setFileExplorerOpen(false);
              setInitialPath('');
            }}
            initialPath={initialPath}
            onFileSelect={(file, content) => {
              // Add file content to chat
              addMessage({
                id: `file-${Date.now()}`,
                type: MessageType.SYSTEM,
                content: `**Contenu du fichier: ${file.name}**\n\`\`\`\n${content}\n\`\`\``,
                timestamp: new Date(),
              });
            }}
          />
        </Box>
      )}

      {webBrowserOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 80,
            right: 20,
            width: 700,
            height: 600,
            zIndex: 1000,
            boxShadow: theme.shadows[10],
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <WebBrowser
            onClose={() => {
              setWebBrowserOpen(false);
              setInitialUrl('');
            }}
            initialUrl={initialUrl}
            onScreenshot={(data) => {
              setScreenshotData(data);
              // Add screenshot to chat
              addMessage({
                id: `screenshot-${Date.now()}`,
                type: MessageType.SYSTEM,
                content: `**Capture d'écran de ${data.url}**\n![Screenshot](data:image/png;base64,${data.screenshot})`,
                timestamp: new Date(),
                screenshot: data.screenshot,
              });
            }}
          />
        </Box>
      )}

      {/* Menu contextuel pour les actions sur les messages */}
      <Menu
        anchorEl={contextActionsAnchorEl}
        open={Boolean(contextActionsAnchorEl)}
        onClose={handleCloseContextMenu}
        slotProps={{
          paper: {
            sx: {
              minWidth: 180,
              boxShadow: theme.palette.neocortex.shadow,
            }
          }
        }}
      >
        <MenuItem onClick={handleCopyMessage} dense>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <Typography variant="body2">Copier</Typography>
        </MenuItem>
        <MenuItem onClick={handleSaveToMemory} dense>
          <ListItemIcon>
            <SaveIcon fontSize="small" />
          </ListItemIcon>
          <Typography variant="body2">Enregistrer en mémoire</Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteMessage} dense>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <Typography variant="body2" color="error.main">
            Supprimer
          </Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Chat;