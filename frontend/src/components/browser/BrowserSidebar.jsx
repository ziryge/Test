import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
  Tooltip,
  alpha,
  useTheme,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  Language as WebIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Computer as ComputerIcon,
} from '@mui/icons-material';
import { useBrowserContext } from '../../context/BrowserContext';

const BrowserSidebar = () => {
  const theme = useTheme();
  const { activeBrowsers, loading, closeBrowser, refreshBrowsers } = useBrowserContext();

  // Format URL for display
  const formatUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return url;
    }
  };

  // Format timestamp for display
  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Paper
      elevation={3}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.palette.mode === 'dark'
          ? alpha(theme.palette.background.paper, 0.8)
          : theme.palette.background.paper,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ComputerIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
          <Typography variant="subtitle1" fontWeight={600}>
            Active Browsers
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton 
            size="small" 
            onClick={refreshBrowsers}
            disabled={loading}
          >
            {loading ? (
              <CircularProgress size={20} />
            ) : (
              <RefreshIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Browser List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {activeBrowsers.length === 0 ? (
          <Box
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.palette.text.secondary,
            }}
          >
            <WebIcon sx={{ fontSize: 40, mb: 2, opacity: 0.5 }} />
            <Typography variant="body2" align="center">
              No active browser sessions
            </Typography>
            <Typography variant="caption" align="center" sx={{ mt: 1 }}>
              Browser sessions will appear here when the AI uses the browser tool
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {activeBrowsers.map((browser, index) => (
              <React.Fragment key={browser.browser_id}>
                <ListItem
                  sx={{
                    py: 1.5,
                    px: 2,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.action.hover, 0.1),
                    },
                  }}
                  secondaryAction={
                    <Tooltip title="Close browser">
                      <IconButton 
                        edge="end" 
                        size="small"
                        onClick={() => closeBrowser(browser.browser_id)}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <WebIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={formatUrl(browser.url)}
                    secondary={`Opened at ${formatTime(browser.last_activity)}`}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: 500,
                      noWrap: true,
                    }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      noWrap: true,
                    }}
                  />
                </ListItem>
                {index < activeBrowsers.length - 1 && (
                  <Divider variant="inset" component="li" />
                )}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
    </Paper>
  );
};

export default BrowserSidebar;
