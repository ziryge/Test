import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Divider,
  useTheme,
  LinearProgress,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Code as CodeIcon,
  BarChart as BarChartIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Terminal as TerminalIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

/**
 * AIComputer component - Represents the AI's virtual computer
 * This component displays a virtual computer interface for the AI with various tabs
 * showing system resources, memory usage, and processing capabilities
 */
const AIComputer = ({ onClose }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [neuralActivity, setNeuralActivity] = useState([]);
  const [processingTasks, setProcessingTasks] = useState([]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Simulate CPU and memory usage
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(Math.min(95, Math.max(30, cpuUsage + (Math.random() * 20 - 10))));
      setMemoryUsage(Math.min(90, Math.max(40, memoryUsage + (Math.random() * 15 - 7.5))));
    }, 2000);

    return () => clearInterval(interval);
  }, [cpuUsage, memoryUsage]);

  // Simulate neural activity
  useEffect(() => {
    const generateNeuralActivity = () => {
      const newActivity = [];
      for (let i = 0; i < 10; i++) {
        newActivity.push({
          id: `layer-${i}`,
          name: `Neural Layer ${i + 1}`,
          activity: Math.random() * 100,
          connections: Math.floor(Math.random() * 1000) + 500,
        });
      }
      setNeuralActivity(newActivity);
    };

    generateNeuralActivity();
    const interval = setInterval(generateNeuralActivity, 3000);

    return () => clearInterval(interval);
  }, []);

  // Simulate processing tasks
  useEffect(() => {
    const taskTypes = [
      'Natural Language Processing',
      'Image Recognition',
      'Logical Reasoning',
      'Data Analysis',
      'Code Generation',
      'Memory Retrieval',
      'Web Search Processing',
    ];

    const generateTasks = () => {
      const newTasks = [];
      const numTasks = Math.floor(Math.random() * 3) + 3; // 3-5 tasks

      for (let i = 0; i < numTasks; i++) {
        const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
        const progress = Math.random() * 100;

        newTasks.push({
          id: `task-${Date.now()}-${i}`,
          type: taskType,
          progress,
          priority: Math.floor(Math.random() * 10) + 1,
          startTime: new Date(Date.now() - Math.random() * 60000 * 10).toISOString(),
        });
      }

      setProcessingTasks(newTasks);
    };

    generateTasks();
    const interval = setInterval(generateTasks, 5000);

    return () => clearInterval(interval);
  }, []);

  // Render system resources tab
  const renderSystemTab = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        System Resources
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">CPU Usage</Typography>
          <Typography variant="body2" fontWeight="bold">{cpuUsage.toFixed(1)}%</Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={cpuUsage}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            '& .MuiLinearProgress-bar': {
              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
              borderRadius: 4,
            }
          }}
        />
      </Box>

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">Memory Usage</Typography>
          <Typography variant="body2" fontWeight="bold">{memoryUsage.toFixed(1)}%</Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={memoryUsage}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            '& .MuiLinearProgress-bar': {
              background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.warning.main})`,
              borderRadius: 4,
            }
          }}
        />
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>System Specifications</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Model</Typography>
            <Typography variant="body2" fontWeight="medium">NeoMaxAI1 Advanced</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Parameters</Typography>
            <Typography variant="body2" fontWeight="medium">175 Billion</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Context Length</Typography>
            <Typography variant="body2" fontWeight="medium">32K Tokens</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Neural Layers</Typography>
            <Typography variant="body2" fontWeight="medium">96 Transformer Blocks</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  // Render neural network tab
  const renderNeuralTab = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Neural Network Activity
      </Typography>

      <Box sx={{ mb: 3 }}>
        {neuralActivity.slice(0, 5).map((layer) => (
          <Box key={layer.id} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">{layer.name}</Typography>
              <Typography variant="body2" fontWeight="medium">{layer.activity.toFixed(1)}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={layer.activity}
              sx={{
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );

  // Render processing tab
  const renderProcessingTab = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Active Processing Tasks
      </Typography>

      <Box sx={{ mb: 3 }}>
        {processingTasks.slice(0, 3).map((task) => (
          <Box
            key={task.id}
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(0,0,0,0.02)',
            }}
          >
            <Typography variant="body2" fontWeight="medium" gutterBottom>
              {task.type}
            </Typography>

            <LinearProgress
              variant="determinate"
              value={task.progress}
              sx={{
                height: 4,
                borderRadius: 2,
                mb: 1,
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }}
            />

            <Typography variant="caption" color="text.secondary">
              {task.progress.toFixed(0)}% Complete
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );

  return (
    <Paper
      elevation={3}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.mode === 'dark'
          ? 'rgba(22, 28, 36, 0.95)'
          : 'rgba(255, 255, 255, 0.95)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(0, 0, 0, 0.2)'
            : 'rgba(0, 0, 0, 0.03)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <MemoryIcon
            sx={{
              mr: 1.5,
              color: theme.palette.primary.main
            }}
          />
          <Typography variant="subtitle1" fontWeight="medium">
            NeoMaxAI1 System Monitor
          </Typography>
        </Box>

        <Box>
          <Tooltip title="Close">
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{
          borderBottom: `1px solid ${theme.palette.divider}`,
          '& .MuiTab-root': {
            minHeight: 48,
          },
        }}
      >
        <Tab
          icon={<StorageIcon fontSize="small" />}
          label="System"
          iconPosition="start"
        />
        <Tab
          icon={<MemoryIcon fontSize="small" />}
          label="Neural Net"
          iconPosition="start"
        />
        <Tab
          icon={<CodeIcon fontSize="small" />}
          label="Processing"
          iconPosition="start"
        />
      </Tabs>

      {/* Tab content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {activeTab === 0 && renderSystemTab()}
        {activeTab === 1 && renderNeuralTab()}
        {activeTab === 2 && renderProcessingTab()}
      </Box>
    </Paper>
  );
};

export default AIComputer;
