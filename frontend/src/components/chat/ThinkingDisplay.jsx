import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Collapse,
  Divider,
  useTheme
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

/**
 * Component to display the AI's thinking process
 * @param {Object} props
 * @param {string} props.thinking - The thinking content to display
 * @param {string} props.modelName - The name of the model
 */
const ThinkingDisplay = ({ thinking, modelName }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  // If no thinking content is provided, don't render anything
  if (!thinking) return null;

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  return (
    <Paper
      elevation={1}
      sx={{
        mt: 2,
        mb: 3,
        p: 0,
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.mode === 'dark' 
          ? 'rgba(30, 41, 59, 0.8)' 
          : 'rgba(248, 250, 252, 0.8)',
        overflow: 'hidden'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          backgroundColor: theme.palette.mode === 'dark' 
            ? 'rgba(15, 23, 42, 0.3)' 
            : 'rgba(241, 245, 249, 0.7)',
          cursor: 'pointer'
        }}
        onClick={toggleExpanded}
      >
        <PsychologyIcon 
          fontSize="small" 
          sx={{ 
            mr: 1,
            color: theme.palette.primary.main
          }} 
        />
        <Typography 
          variant="body2" 
          fontWeight="medium"
          sx={{ flexGrow: 1 }}
        >
          Processus de réflexion de {modelName || 'l\'IA'}
        </Typography>
        <IconButton 
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            toggleExpanded();
          }}
        >
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>
      
      <Collapse in={expanded}>
        <Divider />
        <Box 
          sx={{ 
            p: 2,
            maxHeight: '300px',
            overflow: 'auto',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.75rem',
            whiteSpace: 'pre-wrap',
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(15, 23, 42, 0.5)' 
              : 'rgba(248, 250, 252, 0.5)',
          }}
        >
          {thinking}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ThinkingDisplay;
