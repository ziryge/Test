import React, { useRef, useState, useEffect } from 'react';
import { safeRefresh } from '../services/NoRefreshMiddleware';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Paper,
  Chip,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  Badge,
  Switch,
  FormControlLabel,
  useTheme,
  Dialog,
} from '@mui/material';
import {
  Send as SendIcon,
  Psychology as PsychologyIcon,
  Search as SearchIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Language as LanguageIcon,
  Memory as MemoryIcon,
  Public as PublicIcon,
} from '@mui/icons-material';

// Components
// import ThinkingDisplay from '../components/chat/ThinkingDisplay'; // Temporarily disabled
import Terminal from '../components/terminal/Terminal';
import FileExplorer from '../components/filesystem/FileExplorer';
import WebBrowser from '../components/browser/WebBrowser';
import AIComputer from '../components/ai/AIComputer';

// Context
import { useChat, MessageType } from '../context/ChatContext';

// Services
import { motion } from 'framer-motion';

// Import our new components
import StreamingResponse from '../components/chat/StreamingResponse';
import AnimatedLoader from '../components/common/AnimatedLoader';

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
    setActiveSources,
    isProcessing,
    setIsProcessing,
    savePendingRequest,
    clearPendingRequest,
    hasPendingRequest
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
  const [aiComputerOpen, setAiComputerOpen] = useState(false);

  // Destructure chat settings for easier access
  const { useWebSearch } = chatSettings;

  // Function to safely refresh the page
  const handleSafeRefresh = () => {
    // Removed console.log to prevent console spam
    safeRefresh();
  };

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

  // Check for interrupted streaming queries on load
  useEffect(() => {
    const checkForInterruptedStreaming = async () => {
      // Only check if we're not already processing a request
      if (!isProcessing) {
        const interruptedQuery = ApiService.checkForInterruptedStreaming();

        if (interruptedQuery) {
          console.log('Resuming interrupted streaming query:', interruptedQuery);

          // Find the last user message that matches this query
          const lastUserMessage = messages.filter(m =>
            m.type === MessageType.USER &&
            m.content === interruptedQuery.message
          ).pop();

          // Find any existing AI response that might be in progress
          let aiResponseMessage = null;
          if (lastUserMessage) {
            // Look for an AI message that follows the user message
            const userMessageIndex = messages.findIndex(m => m.id === lastUserMessage.id);
            if (userMessageIndex !== -1 && userMessageIndex < messages.length - 1) {
              const nextMessage = messages[userMessageIndex + 1];
              if (nextMessage.type === MessageType.AI) {
                aiResponseMessage = nextMessage;
              }
            }
          }

          // If we found the user message but no AI response, create one
          if (lastUserMessage && !aiResponseMessage) {
            // Create a new AI response message
            const aiResponseId = `ai-${Date.now()}`;

            // Add the AI message
            addMessage({
              id: aiResponseId,
              type: MessageType.AI,
              content: 'Reprise de la génération après rafraîchissement...',
              thinking: 'Reprise du traitement...',
              sources: [],
              timestamp: new Date(),
              model: currentModelName,
              usedWebSearch: interruptedQuery.options.useWebSearch,
              usedMultiAgent: interruptedQuery.options.useMultiAgent,
              streaming: true,
              processingTime: 0
            });

            // Resume the streaming query
            setIsProcessing(true);

            try {
              await ApiService.sendQuery(interruptedQuery.message, {
                useWebSearch: interruptedQuery.options.useWebSearch,
                useMultiAgent: interruptedQuery.options.useMultiAgent,
                useStreaming: true,

                // Callbacks
                onProgress: (seconds) => {
                  updateMessage(aiResponseId, {
                    processingTime: seconds
                  });
                },

                onChunk: (_, fullText) => {
                  updateMessage(aiResponseId, {
                    content: fullText
                  });
                },

                onThinking: (thinking) => {
                  if (thinking) {
                    setCurrentThinking(thinking);
                    updateMessage(aiResponseId, {
                      thinking: thinking
                    });
                  }
                },

                onError: (error) => {
                  // Clear the interrupted streaming data
                  ApiService.clearInterruptedStreaming();

                  // Update the message with an error indication
                  updateMessage(aiResponseId, {
                    content: `Reprise de la génération après rafraîchissement...\n\n---\n\n⚠️ *Erreur lors de la reprise: ${error.message}*`,
                    streaming: false
                  });

                  setIsProcessing(false);
                },

                onDone: (finalResponse) => {
                  console.log("Interrupted streaming onDone called with finalResponse:", finalResponse);

                  // Clear the interrupted streaming data
                  ApiService.clearInterruptedStreaming();

                  // Update the message with the final response
                  const updates = {
                    content: finalResponse.response,
                    thinking: finalResponse.thinking || "",
                    sources: finalResponse.sources || [],
                    model: finalResponse.model || currentModelName,
                    usedWebSearch: finalResponse.usedWebSearch || false,
                    usedMultiAgent: finalResponse.usedMultiAgent || false,
                    streaming: false
                  };

                  console.log(`Updating interrupted message ${aiResponseId} with:`, updates);

                  updateMessage(aiResponseId, updates);

                  // Force a re-render by setting a timeout
                  setTimeout(() => {
                    console.log(`Re-checking interrupted message ${aiResponseId} streaming status...`);
                    const message = messages.find(m => m.id === aiResponseId);
                    console.log("Interrupted message after update:", message);
                  }, 100);

                  // Update the model name if available
                  if (finalResponse.model) {
                    setCurrentModelName(finalResponse.model);
                  }

                  // If sources are present, add them to the state
                  if (finalResponse.sources && finalResponse.sources.length > 0) {
                    setActiveSources(finalResponse.sources);
                  }

                  setIsProcessing(false);
                }
              });
            } catch (error) {
              console.error('Error resuming streaming query:', error);

              // Clear the interrupted streaming data
              ApiService.clearInterruptedStreaming();

              // Update the message with an error indication
              updateMessage(aiResponseId, {
                content: `Reprise de la génération après rafraîchissement...\n\n---\n\n⚠️ *Erreur lors de la reprise: ${error.message}*`,
                streaming: false
              });

              setIsProcessing(false);
            }
          } else if (aiResponseMessage) {
            // If we already have an AI response message, just update it
            setIsProcessing(true);

            try {
              await ApiService.sendQuery(interruptedQuery.message, {
                useWebSearch: interruptedQuery.options.useWebSearch,
                useMultiAgent: interruptedQuery.options.useMultiAgent,
                useStreaming: true,

                // Callbacks
                onProgress: (seconds) => {
                  updateMessage(aiResponseMessage.id, {
                    processingTime: seconds
                  });
                },

                onChunk: (chunk, fullText) => {
                  console.log(`Interrupted streaming: Received chunk, full text length: ${fullText.length}`);

                  // Mettre à jour le message de l'IA avec le texte reçu jusqu'à présent
                  updateMessage(aiResponseMessage.id, {
                    content: fullText || chunk || "Reprise de la génération après rafraîchissement...",
                    streaming: true
                  });

                  // Force a re-render periodically to ensure content is displayed
                  if (fullText.length % 500 === 0) {
                    setTimeout(() => {
                      const message = messages.find(m => m.id === aiResponseMessage.id);
                      console.log(`Interrupted streaming periodic check - message content length: ${message?.content?.length || 0}`);
                    }, 50);
                  }
                },

                onThinking: (thinking) => {
                  if (thinking) {
                    setCurrentThinking(thinking);
                    updateMessage(aiResponseMessage.id, {
                      thinking: thinking
                    });
                  }
                },

                onError: (error) => {
                  // Clear the interrupted streaming data
                  ApiService.clearInterruptedStreaming();

                  // Update the message with an error indication
                  updateMessage(aiResponseMessage.id, {
                    content: `${aiResponseMessage.content || ""}\n\n---\n\n⚠️ *Erreur lors de la reprise: ${error.message}*`,
                    streaming: false
                  });

                  setIsProcessing(false);
                },

                onDone: (finalResponse) => {
                  console.log("Existing message interrupted streaming onDone called with finalResponse:", finalResponse);

                  // Clear the interrupted streaming data
                  ApiService.clearInterruptedStreaming();

                  // Update the message with the final response
                  const updates = {
                    content: finalResponse.response,
                    thinking: finalResponse.thinking || "",
                    sources: finalResponse.sources || [],
                    model: finalResponse.model || currentModelName,
                    usedWebSearch: finalResponse.usedWebSearch || false,
                    usedMultiAgent: finalResponse.usedMultiAgent || false,
                    streaming: false
                  };

                  console.log(`Updating existing interrupted message ${aiResponseMessage.id} with:`, updates);

                  updateMessage(aiResponseMessage.id, updates);

                  // Force a re-render by setting a timeout
                  setTimeout(() => {
                    console.log(`Re-checking existing interrupted message ${aiResponseMessage.id} streaming status...`);
                    const message = messages.find(m => m.id === aiResponseMessage.id);
                    console.log("Existing interrupted message after update:", message);
                  }, 100);

                  // Update the model name if available
                  if (finalResponse.model) {
                    setCurrentModelName(finalResponse.model);
                  }

                  // If sources are present, add them to the state
                  if (finalResponse.sources && finalResponse.sources.length > 0) {
                    setActiveSources(finalResponse.sources);
                  }

                  setIsProcessing(false);
                }
              });
            } catch (error) {
              console.error('Error resuming streaming query:', error);

              // Clear the interrupted streaming data
              ApiService.clearInterruptedStreaming();

              // Update the message with an error indication
              updateMessage(aiResponseMessage.id, {
                content: `${aiResponseMessage.content || ""}\n\n---\n\n⚠️ *Erreur lors de la reprise: ${error.message}*`,
                streaming: false
              });

              setIsProcessing(false);
            }
          } else {
            // If we couldn't find the user message, just clear the interrupted streaming data
            ApiService.clearInterruptedStreaming();
          }
        }
      }
    };

    // Run the check
    checkForInterruptedStreaming();
  }, [messages, isProcessing, addMessage, updateMessage, setCurrentThinking, currentModelName, setCurrentModelName, setActiveSources, setIsProcessing]);

  // Effet pour ajouter un message d'accueil si aucun message n'existe
  // et pour réinitialiser le thinking process lors du chargement de la page
  useEffect(() => {
    // Clear thinking process on page load/refresh
    setCurrentThinking(null);

    // Cancel any ongoing streaming requests when the component mounts
    // This prevents issues with lingering connections from previous sessions
    ApiService.cancelStreaming();

    // Add event listener to clean up when page is unloaded
    const handleBeforeUnload = () => {
      // Always cancel streaming when page is about to unload
      ApiService.cancelStreaming(true);

      // Don't prevent the page from unloading
      return null;
    };

    // Add the event listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    if (messages.length === 0) {
      addMessage({
        id: 'welcome',
        type: MessageType.SYSTEM,
        content: "# Bienvenue sur NeoMaxAI1 - Intelligence Artificielle Générale 👋\n\nJe suis NeoMaxAI1, une intelligence artificielle générale (AGI) de nouvelle génération, conçue pour surpasser significativement les systèmes comme Manus et GenSpark.\n\n## Mes capacités avancées incluent:\n\n- **Raisonnement multi-étapes complexe** avec une profondeur cognitive exceptionnelle\n- **Compréhension contextuelle approfondie** et mémoire à long terme\n- **Génération de code de qualité professionnelle** avec une compréhension architecturale\n- **Recherche d'informations en temps réel** sur le web avec intégration transparente\n- **Exécution de commandes** dans un terminal intégré\n- **Navigation web intelligente** avec captures d'écran et analyse de contenu\n- **Création et modification de fichiers** avec compréhension du contexte\n- **Décomposition automatique** des problèmes complexes en sous-tâches gérables\n\n## Comment puis-je vous assister aujourd'hui?\n\nPosez-moi n'importe quelle question ou décrivez un problème complexe, et je vous montrerai comment une véritable AGI peut vous aider.",
        timestamp: new Date(),
      });
    }

    // Clean up event listeners on component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also cancel any ongoing streaming requests
      ApiService.cancelStreaming();
    };
  }, [messages.length, addMessage, setCurrentThinking, isProcessing]);

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
        setWebBrowserOpen(true);
      }
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

    // Ajouter un message initial pour l'IA avec indicateur de streaming
    addMessage({
      id: aiResponseId,
      type: MessageType.AI,
      content: '',
      thinking: 'Initialisation du traitement...',
      sources: [],
      timestamp: new Date(),
      model: currentModelName,
      usedWebSearch: useWebSearch,
      streaming: true,
      processingTime: 0
    });

    // Save the pending request information to be able to resume after refresh
    savePendingRequest({
      aiResponseId: aiResponseId,
      userMessageId: userMessage.id,
      userMessageContent: userMessage.content,
      useWebSearch: useWebSearch,
      timestamp: Date.now()
    });

    try {
      // Appel à l'API pour obtenir une réponse avec les options activées (avec streaming)
      await ApiService.sendQuery(userMessage.content, {
        useWebSearch: useWebSearch,
        useStreaming: true, // Use streaming mode for real-time updates
        // Callback pour suivre la progression
        onProgress: (seconds) => {
          // Mettre à jour le message avec le temps de traitement
          updateMessage(aiResponseId, {
            processingTime: seconds,
            content: seconds % 10 === 0
              ? `Traitement de votre demande... (${seconds}s)\n\nCela peut prendre jusqu'à 5 minutes pour les requêtes complexes. Merci de votre patience.`
              : undefined
          });
        },
        // Callback pour chaque morceau de texte reçu
        onChunk: (chunk, fullText) => {
          console.log(`Received chunk, full text length: ${fullText.length}`);

          // Mettre à jour le message de l'IA avec le texte reçu jusqu'à présent
          updateMessage(aiResponseId, {
            content: fullText || chunk || "Génération en cours...",
            streaming: true
          });

          // Force a re-render periodically to ensure content is displayed
          if (fullText.length % 500 === 0) {
            setTimeout(() => {
              const message = messages.find(m => m.id === aiResponseId);
              console.log(`Periodic check - message content length: ${message?.content?.length || 0}`);
            }, 50);
          }
        },
        // Callback pour les informations de réflexion
        onThinking: (thinking) => {
          if (thinking) {
            setCurrentThinking(thinking);

            // Mettre à jour le message avec la réflexion
            updateMessage(aiResponseId, {
              thinking: thinking
            });
          }
        },
        // Callback pour les erreurs pendant le streaming
        onError: (error) => {
          // Check if this is a cancellation error
          const isCancellationError =
            error.isCanceled ||
            error.name === 'CanceledError' ||
            error.message === "La requête a été annulée" ||
            error.message === "Connexion interrompue, tentative de reconnexion..." ||
            error.message === "canceled" ||
            error.code === 'ERR_CANCELED' ||
            (error.message && (
              error.message.includes('cancel') ||
              error.message.includes('abort') ||
              error.message.includes('reconnexion')
            ));

          // Removed console.log to prevent console spam

          // Si nous avons déjà du contenu, on le garde et on ajoute un message d'erreur
          const currentContent = messages.find(m => m.id === aiResponseId)?.content || '';

          // Vérifier si c'est une erreur d'annulation
          if (isCancellationError) {
            if (currentContent.trim()) {
              // Mettre à jour le message avec une indication d'annulation
              updateMessage(aiResponseId, {
                content: currentContent + "\n\n---\n\n🛑 *La requête a été annulée par l'utilisateur.*",
                streaming: false
              });
            } else {
              // Si pas de contenu, supprimer le message et ajouter un message d'information
              removeMessage(aiResponseId);

              // Ajout d'un message d'information sur la reconnexion
              addMessage({
                id: `info-${Date.now()}`,
                type: MessageType.SYSTEM,
                content: "Connexion interrompue, tentative de reconnexion en cours...",
                timestamp: new Date(),
              });

              // Retry the query automatically after a short delay
              setTimeout(() => {
                handleSendMessage();
              }, 1500);
            }
          } else {
            // Pour les autres types d'erreurs
            if (currentContent.trim()) {
              // Mettre à jour le message avec une indication d'erreur
              updateMessage(aiResponseId, {
                content: currentContent + "\n\n---\n\n⚠️ *La connexion a été interrompue. La réponse peut être incomplète.*",
                streaming: false
              });
            } else {
              // Si pas de contenu, supprimer le message et ajouter un message d'erreur
              removeMessage(aiResponseId);

              // Ajout d'un message d'erreur avec plus de détails
              addMessage({
                id: `error-${Date.now()}`,
                type: MessageType.ERROR,
                content: `Désolé, une erreur s'est produite lors du traitement de votre message: ${error.message}. Veuillez réessayer.`,
                timestamp: new Date(),
              });
            }
          }

          // Clear the pending request in case of error
          clearPendingRequest();

          // Clear the interrupted streaming data
          ApiService.clearInterruptedStreaming();

          // Fin du traitement
          setIsProcessing(false);
        },
        // Callback à la fin du streaming
        onDone: (finalResponse) => {
          console.log("onDone called with finalResponse:", finalResponse);

          // Log the current state of the message before updating
          const beforeMessage = messages.find(m => m.id === aiResponseId);
          console.log("Message BEFORE update:", beforeMessage);

          // Mettre à jour le message de l'IA avec toutes les informations finales
          const updates = {
            content: finalResponse.response || "Réponse vide - veuillez réessayer",
            thinking: finalResponse.thinking || "",
            sources: finalResponse.sources || [],
            model: finalResponse.model || currentModelName,
            usedWebSearch: finalResponse.usedWebSearch || false,
            streaming: false,
            processingTime: 0
          };

          console.log(`Updating message ${aiResponseId} with:`, updates);

          // Update the message
          updateMessage(aiResponseId, updates);

          // Force a re-render by setting a timeout
          setTimeout(() => {
            console.log(`Re-checking message ${aiResponseId} streaming status...`);
            const message = messages.find(m => m.id === aiResponseId);
            console.log("Message AFTER update:", message);

            // If the message is still not showing correctly, force another update
            if (message && message.streaming) {
              console.log("Message still showing as streaming, forcing update...");
              updateMessage(aiResponseId, {
                streaming: false,
                processingTime: 0,
                content: message.content || finalResponse.response || "Réponse vide - veuillez réessayer"
              });
            }
          }, 100);

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
            useWebSearch: finalResponse.usedWebSearch !== undefined ? finalResponse.usedWebSearch : useWebSearch
          });

          // Clear the pending request since we've successfully completed it
          clearPendingRequest();

          // Clear the interrupted streaming data
          ApiService.clearInterruptedStreaming();

          // Fin du traitement
          setIsProcessing(false);
        }
      });

    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);

      // Check for different types of errors

      // Check if it's a cancellation error
      const isCancellationError =
        error.isCanceled ||
        error.name === 'CanceledError' ||
        error.message === "La requête a été annulée" ||
        error.message === "Connexion interrompue, tentative de reconnexion..." ||
        error.message === "canceled" ||
        error.code === 'ERR_CANCELED';

      // Check if it's a loop error
      const isLoopError = error.isLoopError || error.message.includes("Trop de tentatives");

      if (isCancellationError) {
        // Removed console.log to prevent console spam

        // Supprimer le message en cours si aucun contenu n'a été généré
        const currentMessage = messages.find(m => m.id === aiResponseId);
        if (!currentMessage || !currentMessage.content.trim()) {
          removeMessage(aiResponseId);

          // Ajouter un message d'information sur la reconnexion
          addMessage({
            id: `info-${Date.now()}`,
            type: MessageType.SYSTEM,
            content: "Connexion interrompue, tentative de reconnexion en cours...",
            timestamp: new Date(),
          });

          // Retry the query automatically after a short delay
          setTimeout(() => {
            handleSendMessage();
          }, 1500);
        }
      } else if (isLoopError) {
        // Removed console.error to prevent console spam

        // Remove the message in progress
        removeMessage(aiResponseId);

        // Add an error message about the connection loop
        addMessage({
          id: `error-${Date.now()}`,
          type: MessageType.ERROR,
          content: "Une boucle de connexion a été détectée. Veuillez attendre quelques secondes avant de réessayer.",
          timestamp: new Date(),
        });

        // Force a small delay before allowing new messages
        setTimeout(() => {
          setIsProcessing(false);
        }, 3000);
      } else {
        // Pour les autres types d'erreurs
        // Supprimer le message de streaming en cas d'erreur
        removeMessage(aiResponseId);

        // Ajout d'un message d'erreur avec plus de détails
        addMessage({
          id: `error-${Date.now()}`,
          type: MessageType.ERROR,
          content: `Désolé, une erreur s'est produite lors du traitement de votre message: ${error.message}. Veuillez réessayer.`,
          timestamp: new Date(),
        });

        // Tenter de redémarrer la connexion après une erreur grave
        setTimeout(() => {
          // No need to check visibility state
          // Removed console.log to prevent console spam
          // Ici on pourrait ajouter un code pour vérifier l'état du serveur
        }, 5000);
      }

      // Clear the pending request in case of error
      clearPendingRequest();

      // Clear the interrupted streaming data
      ApiService.clearInterruptedStreaming();

      // Fin du traitement dans tous les cas
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
                {/* Main content section - always show */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Message content - always show */}
                  <Box sx={{ wordBreak: 'break-word' }}>
                    <StreamingResponse
                      content={message.content || ""}
                      isStreaming={message.streaming}
                      processingTime={message.processingTime}
                    />
                  </Box>

                  {/* Loading indicators */}
                  {(message.streaming || message.processingTime > 0 || hasPendingRequest(message.id)) && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box
                        component={motion.div}
                        initial={{ opacity: 0.8 }}
                        animate={{ opacity: 1 }}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 1,
                          borderRadius: 2,
                          bgcolor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.03)',
                        }}
                      >
                        <AnimatedLoader
                          size="small"
                          showText={false}
                        />
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography
                            variant="body2"
                            color="primary"
                            sx={{ fontWeight: 'bold' }}
                          >
                            {hasPendingRequest(message.id)
                              ? "Reprise de la génération après rafraîchissement..."
                              : message.processingTime > 0
                                ? `NeoMaxAI1 traite votre demande (${message.processingTime}s)`
                                : "NeoMaxAI1 est en train d'écrire"}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Progress bar for long-running requests */}
                      {message.processingTime > 5 && (
                        <Box
                          component={motion.div}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5 }}
                          sx={{
                            width: '100%',
                            mt: 1,
                            mb: 1,
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)',
                            border: '1px solid',
                            borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                              Traitement en cours...
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                {message.processingTime}s
                              </Typography>

                              {/* Cancel button */}
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  ApiService.cancelStreaming(true);
                                }}
                                sx={{
                                  width: 24,
                                  height: 24,
                                  '&:hover': {
                                    bgcolor: 'error.main',
                                    color: 'white'
                                  }
                                }}
                              >
                                <Box
                                  component={motion.div}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  ✕
                                </Box>
                              </IconButton>
                            </Box>
                          </Box>

                          <Box sx={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', bgcolor: 'rgba(0, 0, 0, 0.1)' }}>
                            <Box
                              component={motion.div}
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                height: '100%',
                                width: '100%',
                                background: `linear-gradient(90deg,
                                  ${theme.palette.primary.light},
                                  ${theme.palette.primary.main},
                                  ${theme.palette.primary.dark})`
                              }}
                              animate={{
                                x: ['-100%', '100%'],
                              }}
                              transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut"
                              }}
                            />
                          </Box>

                          <Box
                            component={motion.div}
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                component={motion.div}
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  bgcolor: theme.palette.primary.main
                                }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                Les requêtes complexes peuvent prendre jusqu'à 5 minutes.
                              </Typography>
                            </Box>

                            {/* Cancel text button */}
                            <Typography
                              variant="caption"
                              color="error"
                              component={motion.div}
                              whileHover={{ scale: 1.05 }}
                              sx={{
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                textDecoration: 'underline',
                                '&:hover': {
                                  color: 'error.dark'
                                }
                              }}
                              onClick={() => {
                                ApiService.cancelStreaming(true);
                              }}
                            >
                              Annuler
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Capabilities indicators */}
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

                  {/* Sources */}
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
            <StreamingResponse
              content={message.content || ""}
              isStreaming={false}
            />
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

      {/* Thinking Display - temporarily disabled */}
      {currentThinking && (
        <Paper sx={{ p: 2, mt: 2, mb: 3, borderRadius: 2 }}>
          <Typography variant="body2">
            {currentModelName || 'NeoMaxAI1'} réfléchit...
          </Typography>
          <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {currentThinking}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Loading indicator when processing */}
      {isProcessing && !currentThinking && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <AnimatedLoader message="NeoMaxAI1 réfléchit..." />
        </Box>
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
            ? theme.palette.neocortex?.card?.background || 'rgba(30, 41, 59, 0.8)'
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
          disabled={isProcessing}
          component={motion.div}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          InputProps={{
            endAdornment: (
              <Box
                component={motion.div}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <IconButton
                  color="primary"
                  onClick={handleSendMessage}
                  disabled={isProcessing || !input.trim()}
                  sx={{
                    bgcolor: 'primary.main',
                    color: '#fff',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                    },
                    '&.Mui-disabled': {
                      bgcolor: 'action.disabledBackground',
                      color: 'action.disabled',
                    },
                    ml: 1,
                    transition: 'all 0.3s ease',
                  }}
                >
                  {isProcessing ? <AnimatedLoader size="small" showText={false} /> : <SendIcon />}
                </IconButton>
              </Box>
            ),
            sx: {
              borderRadius: 3,
              fontSize: '1rem',
              lineHeight: 1.5,
              p: 1.5,
              '&.MuiOutlinedInput-root': {
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 0 0 1px rgba(255, 255, 255, 0.1)'
                    : '0 0 0 1px rgba(0, 0, 0, 0.1)',
                },
                '&.Mui-focused': {
                  boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
                },
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
            <Tooltip title="Ordinateur virtuel de l'IA">
              <IconButton
                size="small"
                color="primary"
                onClick={() => setAiComputerOpen(true)}
              >
                <MemoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Rafraîchir la page en toute sécurité">
              <IconButton
                size="small"
                color="primary"
                onClick={handleSafeRefresh}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Effacer la conversation">
              <IconButton
                size="small"
                color="inherit"
                onClick={() => {
                  if (window.confirm("Êtes-vous sûr de vouloir effacer toute la conversation ?")) {
                    // Clear all messages
                    clearMessages();

                    // Reset input field
                    setInput('');

                    // Reset processing state
                    setIsProcessing(false);

                    // Cancel any ongoing requests
                    ApiService.cancelStreaming(true);

                    // Focus the input field
                    setTimeout(() => {
                      inputRef.current?.focus();
                    }, 100);

                    // Close all tools when conversation is cleared
                    setTerminalOpen(false);
                    setFileExplorerOpen(false);
                    setWebBrowserOpen(false);
                    setAiComputerOpen(false);
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

      {/* AI Computer */}
      {aiComputerOpen && (
        <Dialog
          open={aiComputerOpen}
          onClose={() => setAiComputerOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              overflow: 'hidden',
              height: '80vh',
            }
          }}
        >
          <AIComputer onClose={() => setAiComputerOpen(false)} />
        </Dialog>
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