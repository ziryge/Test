import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

/**
 * StreamingResponse component
 * 
 * A component that displays streaming text with a typing indicator
 * and proper markdown formatting.
 * 
 * @param {Object} props - Component props
 * @param {string} props.content - The content to display
 * @param {boolean} props.isStreaming - Whether the content is still streaming
 * @param {number} props.processingTime - The time spent processing the response
 */
const StreamingResponse = ({ 
  content, 
  isStreaming = false, 
  processingTime = 0 
}) => {
  const theme = useTheme();
  
  // Cursor animation variants
  const cursorVariants = {
    blinking: {
      opacity: [0, 1, 0],
      transition: {
        duration: 1,
        repeat: Infinity,
        repeatType: "loop"
      }
    }
  };
  
  // Progress bar animation variants
  const progressVariants = {
    animate: {
      x: ['-100%', '100%'],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <Box sx={{ wordBreak: 'break-word' }}>
      <Typography variant="body1" component="div">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  style={theme.palette.mode === 'dark' ? oneDark : oneLight}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content || ""}
        </ReactMarkdown>
        
        {/* Blinking cursor for streaming effect */}
        {isStreaming && (
          <Box
            component={motion.div}
            variants={cursorVariants}
            animate="blinking"
            sx={{ 
              display: 'inline-block', 
              ml: 0.5,
              fontSize: '1.2em',
              fontWeight: 'bold',
              color: theme.palette.primary.main
            }}
          >
            ▋
          </Box>
        )}
      </Typography>
      
      {/* Processing indicator */}
      {isStreaming && processingTime > 0 && (
        <Box 
          sx={{ 
            mt: 2, 
            p: 1.5, 
            borderRadius: 2,
            bgcolor: theme.palette.mode === 'dark' 
              ? 'rgba(0, 0, 0, 0.2)' 
              : 'rgba(0, 0, 0, 0.05)',
            border: '1px solid',
            borderColor: theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'rgba(0, 0, 0, 0.1)',
          }}
          component={motion.div}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            mb: 1 
          }}>
            <Typography 
              variant="body2" 
              color="primary" 
              sx={{ fontWeight: 'bold' }}
            >
              Generating response...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {processingTime}s
            </Typography>
          </Box>
          
          {/* Animated progress bar */}
          <Box sx={{ 
            position: 'relative', 
            height: 4, 
            borderRadius: 2, 
            overflow: 'hidden',
            bgcolor: 'rgba(0, 0, 0, 0.1)' 
          }}>
            <Box
              component={motion.div}
              variants={progressVariants}
              animate="animate"
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: '30%',
                borderRadius: 2,
                background: `linear-gradient(90deg,
                  ${theme.palette.primary.light},
                  ${theme.palette.primary.main},
                  ${theme.palette.primary.dark})`
              }}
            />
          </Box>
          
          <Box sx={{ 
            mt: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                component={motion.div}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: theme.palette.primary.main
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Complex responses may take up to 5 minutes.
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default StreamingResponse;
