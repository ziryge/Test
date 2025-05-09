import React, { createContext, useState, useEffect, useContext } from 'react';
import ApiService from '../services/ApiService';

// Create the context
export const ChatContext = createContext();

// Message types
export const MessageType = {
  USER: 'user',
  AI: 'ai',
  ERROR: 'error',
  SYSTEM: 'system',
  PENDING: 'pending' // New type for pending AI responses
};

// Provider component
export const ChatProvider = ({ children }) => {
  // Chat messages state
  const [messages, setMessages] = useState([]);

  // Chat settings
  const [chatSettings, setChatSettings] = useState({
    useWebSearch: true,
    // Multi-agent option removed as requested
    showThinking: true
  });

  // Current thinking process
  const [currentThinking, setCurrentThinking] = useState(null);

  // Current model name
  const [currentModelName, setCurrentModelName] = useState("neomaxai1");

  // Active sources
  const [activeSources, setActiveSources] = useState([]);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);

  // Pending request state - to track requests that were interrupted by refresh
  const [pendingRequest, setPendingRequest] = useState(null);

  // Helper function to convert string timestamps to Date objects
  const convertTimestamps = (messages) => {
    return messages.map(message => ({
      ...message,
      timestamp: message.timestamp ? new Date(message.timestamp) : new Date()
    }));
  };

  // Load messages from localStorage on component mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatMessages');
    const savedSettings = localStorage.getItem('chatSettings');
    const savedPendingRequest = localStorage.getItem('pendingRequest');

    if (savedMessages) {
      try {
        // Parse messages and convert timestamps to Date objects
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(convertTimestamps(parsedMessages));
      } catch (error) {
        console.error('Error parsing saved messages:', error);
        // If there's an error, clear the corrupted data
        localStorage.removeItem('chatMessages');
      }
    }

    if (savedSettings) {
      try {
        setChatSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Error parsing saved chat settings:', error);
        localStorage.removeItem('chatSettings');
      }
    }

    // Check for any pending requests that were interrupted by a refresh
    if (savedPendingRequest) {
      try {
        const parsedRequest = JSON.parse(savedPendingRequest);
        setPendingRequest(parsedRequest);

        // Set processing state if there's a pending request
        if (parsedRequest) {
          setIsProcessing(true);
        }
      } catch (error) {
        console.error('Error parsing saved pending request:', error);
        localStorage.removeItem('pendingRequest');
      }
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    }
  }, [messages]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('chatSettings', JSON.stringify(chatSettings));
  }, [chatSettings]);

  // Save pending request to localStorage whenever it changes
  useEffect(() => {
    if (pendingRequest) {
      localStorage.setItem('pendingRequest', JSON.stringify(pendingRequest));
    } else {
      localStorage.removeItem('pendingRequest');
    }
  }, [pendingRequest]);

  // Add a new message
  const addMessage = (message) => {
    setMessages(prevMessages => [...prevMessages, {
      ...message,
      id: message.id || Date.now().toString(),
      // Ensure timestamp is always a Date object
      timestamp: message.timestamp instanceof Date
        ? message.timestamp
        : message.timestamp
          ? new Date(message.timestamp)
          : new Date()
    }]);
  };

  // Update a message by ID
  const updateMessage = (id, updates) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === id ? { ...msg, ...updates } : msg
      )
    );
  };

  // Remove a message by ID
  const removeMessage = (id) => {
    setMessages(prevMessages =>
      prevMessages.filter(msg => msg.id !== id)
    );
  };

  // Clear all messages
  const clearMessages = () => {
    setMessages([]);
    setIsProcessing(false);
    setPendingRequest(null);
    setCurrentThinking(null);
    localStorage.removeItem('chatMessages');
    localStorage.removeItem('pendingRequest');
    // Also clear any interrupted streaming queries
    ApiService.clearInterruptedStreaming();
  };

  // Update chat settings
  const updateChatSettings = (newSettings) => {
    setChatSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };

  // Save a pending request to be resumed after refresh
  const savePendingRequest = (requestData) => {
    setPendingRequest(requestData);
  };

  // Clear a pending request
  const clearPendingRequest = () => {
    setPendingRequest(null);
  };

  // Check if there's a pending request for a specific message
  const hasPendingRequest = (messageId) => {
    return pendingRequest && pendingRequest.aiResponseId === messageId;
  };

  // Handle pending requests after page refresh
  useEffect(() => {
    // Check if there's a pending request and we're not already processing
    if (pendingRequest && !isProcessing) {
      const resumeRequest = async () => {
        try {
          setIsProcessing(true);

          // Find the last user message and AI response (if any)
          const lastUserMessage = messages.filter(m => m.type === MessageType.USER).pop();
          const pendingAiMessage = messages.find(m => m.id === pendingRequest.aiResponseId);

          if (lastUserMessage && pendingAiMessage) {
            // Update the AI message to show we're resuming
            updateMessage(pendingAiMessage.id, {
              content: pendingAiMessage.content || "Reprise de la génération de la réponse...",
              type: MessageType.AI
            });

            // Resume the request using the saved parameters
            await ApiService.sendQuery(lastUserMessage.content, {
              useWebSearch: pendingRequest.useWebSearch,
              useMultiAgent: pendingRequest.useMultiAgent,
              useStreaming: false,

              // Callbacks
              onProgress: (seconds) => {
                updateMessage(pendingAiMessage.id, {
                  processingTime: seconds,
                  content: seconds % 10 === 0
                    ? `Reprise du traitement... (${seconds}s)\n\nCela peut prendre jusqu'à 5 minutes pour les requêtes complexes.`
                    : pendingAiMessage.content
                });
              },

              onChunk: (_, fullText) => {
                updateMessage(pendingAiMessage.id, {
                  content: fullText
                });
              },

              onThinking: (thinking) => {
                if (thinking) {
                  setCurrentThinking(thinking);
                  updateMessage(pendingAiMessage.id, {
                    thinking: thinking
                  });
                }
              },

              onError: (error) => {
                // Update the message with an error indication
                updateMessage(pendingAiMessage.id, {
                  content: `${pendingAiMessage.content || ""}\n\n---\n\n⚠️ *Erreur lors de la reprise: ${error.message}*`,
                  type: MessageType.AI
                });

                // Clear the pending request
                setPendingRequest(null);
                setIsProcessing(false);
              },

              onDone: (finalResponse) => {
                // Update the message with the final response
                updateMessage(pendingAiMessage.id, {
                  content: finalResponse.response,
                  thinking: finalResponse.thinking || "",
                  sources: finalResponse.sources || [],
                  model: finalResponse.model || currentModelName,
                  usedWebSearch: finalResponse.usedWebSearch || false,
                  usedMultiAgent: finalResponse.usedMultiAgent || false,
                  streaming: false
                });

                // Clear the pending request
                setPendingRequest(null);
                setIsProcessing(false);
              }
            });
          } else {
            // If we can't find the messages, clear the pending request
            setPendingRequest(null);
            setIsProcessing(false);
          }
        } catch (error) {
          console.error("Error resuming request:", error);
          setPendingRequest(null);
          setIsProcessing(false);
        }
      };

      // Start resuming the request
      resumeRequest();
    }
  }, [pendingRequest, isProcessing, messages, currentModelName, updateMessage]);

  // Context value
  const contextValue = {
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
    setIsProcessing,
    pendingRequest,
    savePendingRequest,
    clearPendingRequest,
    hasPendingRequest
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

// Custom hook for using the chat context
export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export default ChatProvider;
