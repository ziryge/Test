import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Divider,
  CircularProgress,
  useTheme
} from '@mui/material';
import {
  Send as SendIcon,
  Clear as ClearIcon,
  Code as CodeIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import FileSystemService from '../../services/FileSystemService';

const Terminal = ({ onClose, initialCommand = '' }) => {
  const theme = useTheme();
  const [input, setInput] = useState(initialCommand);
  const [history, setHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef(null);

  // Execute initial command if provided
  useEffect(() => {
    if (initialCommand && history.length === 0) {
      setInput(initialCommand);
      executeCommand();
    }
  }, []);

  // Scroll to bottom when history changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  // Handle command execution
  const executeCommand = async () => {
    if (!input.trim() || isProcessing) return;

    const command = input.trim();

    // Add command to history
    setHistory(prev => [...prev, { type: 'command', content: command }]);

    // Add to command history for up/down navigation
    setCommandHistory(prev => [command, ...prev.slice(0, 19)]);
    setHistoryIndex(-1);

    // Clear input
    setInput('');

    // Set processing state
    setIsProcessing(true);

    try {
      // Execute command
      const response = await FileSystemService.executeCommand(command);

      // Add response to history
      if (response.stdout) {
        setHistory(prev => [...prev, { type: 'output', content: response.stdout }]);
      }

      if (response.stderr) {
        setHistory(prev => [...prev, { type: 'error', content: response.stderr }]);
      }

      if (!response.stdout && !response.stderr) {
        setHistory(prev => [...prev, { type: 'output', content: 'Command executed successfully.' }]);
      }

      if (response.return_code !== 0) {
        setHistory(prev => [...prev, {
          type: 'error',
          content: `Command exited with code ${response.return_code}`
        }]);
      }
    } catch (error) {
      console.error('Error executing command:', error);
      setHistory(prev => [...prev, {
        type: 'error',
        content: `Error: ${error.message || 'Failed to execute command'}`
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Navigate command history up
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Navigate command history down
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  // Clear terminal
  const clearTerminal = () => {
    setHistory([]);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: theme.palette.mode === 'dark' ? '#1E1E1E' : '#F5F5F5',
      }}
    >
      {/* Terminal header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          bgcolor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <CodeIcon sx={{ mr: 1 }} />
          <Typography variant="subtitle1" fontWeight="medium">
            Terminal
          </Typography>
        </Box>
        <Box>
          <IconButton size="small" color="inherit" onClick={clearTerminal}>
            <ClearIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="inherit" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Divider />

      {/* Terminal output */}
      <Box
        ref={terminalRef}
        sx={{
          flexGrow: 1,
          p: 1,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          bgcolor: theme.palette.mode === 'dark' ? '#1E1E1E' : '#F5F5F5',
        }}
      >
        {history.map((item, index) => (
          <Box key={index} sx={{ mb: 1 }}>
            {item.type === 'command' ? (
              <Box sx={{ color: theme.palette.success.main }}>
                $ {item.content}
              </Box>
            ) : item.type === 'error' ? (
              <Box sx={{ color: theme.palette.error.main }}>
                {item.content}
              </Box>
            ) : (
              <Box sx={{ color: theme.palette.text.primary }}>
                {item.content}
              </Box>
            )}
          </Box>
        ))}
        {isProcessing && (
          <Box sx={{ display: 'flex', alignItems: 'center', color: theme.palette.info.main }}>
            <CircularProgress size={16} sx={{ mr: 1 }} />
            Processing...
          </Box>
        )}
      </Box>

      <Divider />

      {/* Terminal input */}
      <Box sx={{ p: 1 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Enter command..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          InputProps={{
            startAdornment: (
              <Box component="span" sx={{ color: theme.palette.success.main, mr: 1 }}>
                $
              </Box>
            ),
            endAdornment: (
              <IconButton
                color="primary"
                onClick={executeCommand}
                disabled={isProcessing || !input.trim()}
              >
                {isProcessing ? <CircularProgress size={24} /> : <SendIcon />}
              </IconButton>
            ),
            sx: {
              fontFamily: 'monospace',
              fontSize: '0.9rem',
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: theme.palette.mode === 'dark' ? '#2D2D2D' : '#FFFFFF',
            },
          }}
        />
      </Box>
    </Paper>
  );
};

export default Terminal;
