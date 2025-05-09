import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

/**
 * AnimatedLoader component
 * 
 * A visually appealing animated loader that can be used when the AI is processing
 * or when waiting for a response.
 * 
 * @param {Object} props - Component props
 * @param {string} props.message - Message to display below the animation
 * @param {string} props.size - Size of the loader ('small', 'medium', 'large')
 * @param {string} props.color - Color of the loader (defaults to primary color)
 * @param {boolean} props.showText - Whether to show the text message
 */
const AnimatedLoader = ({ 
  message = "Thinking...", 
  size = "medium", 
  color,
  showText = true
}) => {
  const theme = useTheme();
  
  // Determine size values
  const sizeValues = {
    small: { container: 40, dot: 4, spacing: 6 },
    medium: { container: 60, dot: 6, spacing: 8 },
    large: { container: 80, dot: 8, spacing: 10 }
  };
  
  const { container, dot, spacing } = sizeValues[size] || sizeValues.medium;
  
  // Use provided color or default to primary
  const dotColor = color || theme.palette.primary.main;
  
  // Animation variants for the dots
  const containerVariants = {
    animate: {
      rotate: [0, 360],
      transition: {
        duration: 3,
        ease: "linear",
        repeat: Infinity
      }
    }
  };
  
  const dotVariants = {
    animate: {
      scale: [1, 1.5, 1],
      opacity: [0.7, 1, 0.7],
      transition: {
        duration: 1.5,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "reverse"
      }
    }
  };

  // Create an array of dots
  const dots = Array.from({ length: 8 }).map((_, index) => {
    const angle = (index * 45) * (Math.PI / 180);
    const x = Math.cos(angle) * spacing;
    const y = Math.sin(angle) * spacing;
    
    return (
      <motion.div
        key={index}
        variants={dotVariants}
        animate="animate"
        style={{
          position: 'absolute',
          width: dot,
          height: dot,
          borderRadius: '50%',
          backgroundColor: dotColor,
          top: '50%',
          left: '50%',
          marginTop: -dot/2,
          marginLeft: -dot/2,
          transform: `translate(${x}px, ${y}px)`,
        }}
        custom={index}
      />
    );
  });

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      justifyContent: 'center',
      padding: 2
    }}>
      <Box
        component={motion.div}
        variants={containerVariants}
        animate="animate"
        sx={{
          position: 'relative',
          width: container,
          height: container,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: showText ? 2 : 0
        }}
      >
        {dots}
        <Box
          sx={{
            width: dot * 2,
            height: dot * 2,
            borderRadius: '50%',
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Box
            component={motion.div}
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse"
            }}
            sx={{
              width: dot,
              height: dot,
              borderRadius: '50%',
              background: theme.palette.neocortex?.gradient1 || 
                `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            }}
          />
        </Box>
      </Box>
      
      {showText && (
        <Typography 
          variant="body2" 
          color="text.secondary"
          component={motion.p}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ 
            duration: 2, 
            repeat: Infinity,
            repeatType: "reverse"
          }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default AnimatedLoader;
