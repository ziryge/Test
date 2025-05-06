import React, { createContext, useState, useEffect, useContext } from 'react';

// Create the context
export const ChatContext = createContext();

// Message types
export const MessageType = {
  USER: 'user',
  AI: 'ai',
  ERROR: 'error',
  SYSTEM: 'system'
};

// Provider component
export const ChatProvider = ({ children }) => {
  // Chat messages state
  const [messages, setMessages] = useState([]);

  // Chat settings
  const [chatSettings, setChatSettings] = useState({
    useWebSearch: true,
    useMultiAgent: true, // Keep multi-agent enabled by default, just hidden from UI
    showThinking: true
  });

  // Current thinking process
  const [currentThinking, setCurrentThinking] = useState(null);

  // Current model name
  const [currentModelName, setCurrentModelName] = useState("deepseek-r1:14b");

  // Active sources
  const [activeSources, setActiveSources] = useState([]);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);

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
    localStorage.removeItem('chatMessages');
  };

  // Update chat settings
  const updateChatSettings = (newSettings) => {
    setChatSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };

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
    setIsProcessing
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
