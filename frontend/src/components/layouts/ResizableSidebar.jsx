import React, { useState, useEffect, useRef } from 'react';
import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, useTheme, IconButton, Tooltip } from '@mui/material';
import { motion } from 'framer-motion';
import { styled } from '@mui/material/styles';

// Icons
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

// Default drawer width
const DEFAULT_DRAWER_WIDTH = 240;
const MIN_DRAWER_WIDTH = 60;
const MAX_DRAWER_WIDTH = 400;

// Styled component for the resizer
const Resizer = styled('div')(({ theme }) => ({
  width: '5px',
  cursor: 'ew-resize',
  padding: '4px 0 0',
  borderTop: '1px solid',
  borderBottom: '1px solid',
  borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  zIndex: 1200,
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
  '&:hover': {
    backgroundColor: theme.palette.primary.main,
    opacity: 0.6,
  },
}));

/**
 * ResizableSidebar component
 * 
 * A sidebar that can be resized by dragging and collapsed/expanded with a button.
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.open - Whether the sidebar is open
 * @param {function} props.onToggle - Function to call when toggling the sidebar
 * @param {React.ReactNode} props.children - Content to render inside the sidebar
 * @param {boolean} props.hideByDefault - Whether to hide the sidebar by default (only show on hover)
 */
const ResizableSidebar = ({ 
  open, 
  onToggle, 
  children, 
  hideByDefault = true,
  ...props 
}) => {
  const theme = useTheme();
  const [width, setWidth] = useState(DEFAULT_DRAWER_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const sidebarRef = useRef(null);
  
  // Handle mouse down on the resizer
  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };
  
  // Handle mouse move to resize the sidebar
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      // Calculate new width based on mouse position
      const newWidth = e.clientX;
      
      // Constrain width between min and max
      if (newWidth >= MIN_DRAWER_WIDTH && newWidth <= MAX_DRAWER_WIDTH) {
        setWidth(newWidth);
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);
  
  // Handle hover state for auto-hide functionality
  const handleMouseEnter = () => {
    setIsHovering(true);
  };
  
  const handleMouseLeave = () => {
    setIsHovering(false);
  };
  
  // Determine if sidebar should be visible based on hover state and hideByDefault prop
  const isVisible = hideByDefault ? (open && isHovering) : open;
  
  return (
    <Box 
      sx={{ 
        position: 'relative',
        height: '100%',
        overflow: 'hidden'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      ref={sidebarRef}
    >
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: open ? width : theme.spacing(7),
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          '& .MuiDrawer-paper': {
            position: 'relative',
            whiteSpace: 'nowrap',
            width: open ? width : theme.spacing(7),
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            boxSizing: 'border-box',
            overflowX: 'hidden',
            border: 'none',
            ...(!isVisible && {
              width: theme.spacing(7),
            }),
          },
        }}
        {...props}
      >
        {children}
        
        {/* Toggle button */}
        <Box
          sx={{
            position: 'absolute',
            bottom: theme.spacing(2),
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
          }}
        >
          <IconButton
            onClick={onToggle}
            size="small"
            sx={{
              bgcolor: theme.palette.background.paper,
              boxShadow: theme.shadows[3],
              '&:hover': {
                bgcolor: theme.palette.action.hover,
              },
            }}
          >
            {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </Box>
        
        {/* Resizer */}
        {open && (
          <Resizer onMouseDown={handleMouseDown} />
        )}
      </Drawer>
    </Box>
  );
};

export default ResizableSidebar;
