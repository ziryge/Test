import React from 'react';
import { Box, Typography, useTheme, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';

const LoadingScreen = ({ message = "Initialisation de NeoCortex..." }) => {
  const theme = useTheme();
  
  // Animation variants pour les éléments
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        duration: 0.5,
        when: "beforeChildren",
        staggerChildren: 0.3
      }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { duration: 0.5 }
    }
  };
  
  // Animation de la pulsation du logo
  const pulseVariants = {
    initial: { scale: 1 },
    pulse: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "reverse"
      }
    }
  };
  
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        bgcolor: theme.palette.background.default
      }}
      component={motion.div}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Logo animé */}
      <Box
        component={motion.div}
        variants={pulseVariants}
        initial="initial"
        animate="pulse"
        sx={{
          width: 120,
          height: 120,
          mb: 4,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        <Box
          component="img"
          src="/neocortex-logo.svg"
          alt="NeoCortex Logo"
          sx={{
            width: '100%',
            height: '100%',
            filter: 'drop-shadow(0 0 12px rgba(45, 156, 219, 0.6))'
          }}
        />
        
        {/* Cercle de chargement animé autour du logo */}
        <CircularProgress
          size={140}
          thickness={1}
          sx={{
            position: 'absolute',
            color: theme.palette.primary.main,
            opacity: 0.7,
          }}
        />
        <CircularProgress
          size={140}
          thickness={1}
          sx={{
            position: 'absolute',
            color: theme.palette.secondary.main,
            opacity: 0.5,
            animation: 'spin 3s linear infinite',
            '@keyframes spin': {
              '0%': {
                transform: 'rotate(0deg)',
              },
              '100%': {
                transform: 'rotate(360deg)',
              },
            },
          }}
        />
      </Box>
      
      {/* Texte animé */}
      <Box
        component={motion.div}
        variants={itemVariants}
      >
        <Typography
          variant="h4"
          fontWeight="bold"
          align="center"
          gutterBottom
          sx={{
            background: theme.palette.neocortex.gradient1,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent'
          }}
        >
          NeoCortex AI
        </Typography>
      </Box>
      
      <Box
        component={motion.div}
        variants={itemVariants}
      >
        <Typography
          variant="body1"
          align="center"
          color="textSecondary"
          sx={{ mb: 2 }}
        >
          {message}
        </Typography>
      </Box>
      
      {/* Animation dots */}
      <Box
        component={motion.div}
        variants={itemVariants}
        sx={{ display: 'flex', gap: 1, mt: 1 }}
      >
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            component={motion.div}
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: theme.palette.primary.main
            }}
            animate={{
              y: [-5, 5, -5],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        ))}
      </Box>
      
      {/* Version */}
      <Box
        component={motion.div}
        variants={itemVariants}
        sx={{ mt: 4 }}
      >
        <Typography
          variant="caption"
          color="textSecondary"
        >
          v1.0.0
        </Typography>
      </Box>
    </Box>
  );
};

export default LoadingScreen;