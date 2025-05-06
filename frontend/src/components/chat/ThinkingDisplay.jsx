import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Collapse,
  Divider,
  useTheme,
  LinearProgress
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Memory as MemoryIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

/**
 * Component to display the AI's thinking process
 * @param {Object} props
 * @param {string} props.thinking - The thinking content to display
 * @param {string} props.modelName - The name of the model
 */
const ThinkingDisplay = ({ thinking, modelName }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [animationPhase, setAnimationPhase] = useState(0);

  // If no thinking content is provided, don't render anything
  if (!thinking) return null;

  // Animation effect for progress bar
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        const newProgress = Math.min(oldProgress + Math.random() * 10, 100);
        if (newProgress === 100) {
          clearInterval(timer);
        }
        return newProgress;
      });
    }, 500);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Animation effect for neural network visualization
  useEffect(() => {
    const timer = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 4);
    }, 800);

    return () => {
      clearInterval(timer);
    };
  }, []);

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
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(15, 23, 42, 0.3)'
            : 'rgba(241, 245, 249, 0.7)',
          cursor: 'pointer',
        }}
        onClick={toggleExpanded}
      >
        <PsychologyIcon
          fontSize="small"
          sx={{
            mr: 1.5,
            color: theme.palette.primary.main
          }}
        />
        <Typography
          variant="body2"
          fontWeight="medium"
          sx={{ flexGrow: 1 }}
        >
          {modelName || 'NeoMaxAI1'} réfléchit...
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              component={motion.div}
              sx={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                backgroundColor: theme.palette.primary.main,
              }}
              animate={{
                y: [0, -3, 0],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </Box>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            toggleExpanded();
          }}
          sx={{ ml: 1 }}
        >
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Simple progress bar */}
      <LinearProgress
        variant="indeterminate"
        sx={{
          height: 2,
          '& .MuiLinearProgress-bar': {
            backgroundColor: theme.palette.primary.main,
          }
        }}
      />

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
