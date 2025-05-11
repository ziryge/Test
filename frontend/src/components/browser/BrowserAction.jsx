import React from 'react';
import { Box, Paper, Typography, Link, Divider, useTheme, alpha } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';

/**
 * BrowserAction Component
 * 
 * Displays information about a browser action taken by the AI
 */
const BrowserAction = ({ action }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  if (!action) return null;

  return (
    <Paper
      elevation={1}
      sx={{
        mt: 1,
        mb: 2,
        p: 1.5,
        borderRadius: '8px',
        border: `1px solid ${isDarkMode ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.primary.main, 0.1)}`,
        backgroundColor: isDarkMode ? alpha(theme.palette.primary.main, 0.05) : alpha(theme.palette.primary.main, 0.02),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <LanguageIcon 
          sx={{ 
            mr: 1, 
            color: theme.palette.primary.main,
            fontSize: '1.2rem'
          }} 
        />
        <Typography variant="subtitle2" color="primary">
          Browser Action
        </Typography>
      </Box>
      
      <Divider sx={{ mb: 1.5 }} />
      
      <Box sx={{ pl: 1 }}>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          <strong>URL:</strong>{' '}
          <Link 
            href={action.url} 
            target="_blank" 
            rel="noopener noreferrer"
            sx={{ wordBreak: 'break-all' }}
          >
            {action.url}
          </Link>
        </Typography>
        
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          <strong>Title:</strong> {action.title || 'No title'}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          {new Date(action.timestamp * 1000).toLocaleString()}
        </Typography>
      </Box>
    </Paper>
  );
};

export default BrowserAction;
