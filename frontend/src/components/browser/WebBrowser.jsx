import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Divider,
  CircularProgress,
  Button,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Screenshot as ScreenshotIcon,
  ContentCopy as CopyIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import FileSystemService from '../../services/FileSystemService';

const WebBrowser = ({ onClose, onScreenshot, initialUrl = '' }) => {
  const theme = useTheme();
  const [url, setUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [browserData, setBrowserData] = useState(null);

  // Load initial URL if provided
  useEffect(() => {
    if (initialUrl && initialUrl !== url) {
      setUrl(initialUrl);
      handleSubmit({ preventDefault: () => {} });
    }
  }, [initialUrl]);

  // Handle URL input change
  const handleUrlChange = (e) => {
    setUrl(e.target.value);
  };

  // Handle URL submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await FileSystemService.browseWebsite(url);
      setBrowserData(response);
    } catch (error) {
      console.error('Error browsing website:', error);
      setError('Failed to browse website. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    if (browserData) {
      handleSubmit({ preventDefault: () => {} });
    }
  };

  // Handle screenshot
  const handleScreenshot = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await FileSystemService.takeScreenshot(url);

      // Update browser data
      setBrowserData(prev => ({
        ...prev,
        screenshot: response.screenshot
      }));

      // Call onScreenshot callback if provided
      if (onScreenshot && typeof onScreenshot === 'function') {
        onScreenshot({
          url: url,
          title: browserData?.title || 'Screenshot',
          screenshot: response.screenshot,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error taking screenshot:', error);
      setError('Failed to take screenshot. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy text to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('Copied to clipboard!');
      })
      .catch((err) => {
        console.error('Failed to copy text:', err);
      });
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
      }}
    >
      {/* Browser header */}
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
          <SearchIcon sx={{ mr: 1 }} />
          <Typography variant="subtitle1" fontWeight="medium">
            Web Browser
          </Typography>
        </Box>
        <Box>
          <IconButton size="small" color="inherit" onClick={handleRefresh} disabled={!browserData}>
            <RefreshIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="inherit" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Divider />

      {/* URL input */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        }}
      >
        <TextField
          fullWidth
          placeholder="Enter URL..."
          value={url}
          onChange={handleUrlChange}
          variant="outlined"
          size="small"
          sx={{ mr: 1 }}
        />
        <Button
          variant="contained"
          color="primary"
          type="submit"
          disabled={isLoading || !url.trim()}
          startIcon={isLoading ? <CircularProgress size={16} /> : <SearchIcon />}
        >
          Browse
        </Button>
      </Box>

      <Divider />

      {/* Browser content */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2,
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading...
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ color: theme.palette.error.main }}>
            <Typography>{error}</Typography>
          </Box>
        ) : browserData ? (
          <Box>
            {/* Page info */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {browserData.title || 'Untitled Page'}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {browserData.url}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Tooltip title="Take Screenshot">
                  <IconButton size="small" onClick={handleScreenshot}>
                    <ScreenshotIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy Text">
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(browserData.text_content)}
                  >
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="View Source">
                  <IconButton size="small">
                    <CodeIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Screenshot */}
            {browserData.screenshot && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Screenshot
                </Typography>
                <Paper
                  elevation={1}
                  sx={{
                    p: 1,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                    overflow: 'hidden'
                  }}
                >
                  <img
                    src={`data:image/png;base64,${browserData.screenshot}`}
                    alt="Website Screenshot"
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      borderRadius: 4
                    }}
                  />
                </Paper>
              </Box>
            )}

            {/* Page content */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Page Content
              </Typography>
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  maxHeight: 300,
                  overflowY: 'auto',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {browserData.text_content}
                </Typography>
              </Paper>
            </Box>

            {/* Links */}
            {browserData.links && browserData.links.length > 0 && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Links ({browserData.links.length})
                </Typography>
                <Paper
                  elevation={1}
                  sx={{
                    p: 2,
                    maxHeight: 200,
                    overflowY: 'auto',
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1
                  }}
                >
                  {browserData.links.map((link, index) => (
                    <Box key={index} sx={{ mb: 1 }}>
                      <Typography variant="body2" component="div">
                        <Box component="span" sx={{ fontWeight: 'bold' }}>
                          {link.text || 'No text'}:
                        </Box>{' '}
                        <Box
                          component="span"
                          sx={{
                            color: theme.palette.primary.main,
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                          onClick={() => {
                            setUrl(link.href);
                            handleSubmit({ preventDefault: () => {} });
                          }}
                        >
                          {link.href}
                        </Box>
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              </Box>
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" color="text.secondary">
              Enter a URL to browse a website
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default WebBrowser;
