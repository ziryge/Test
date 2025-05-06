import React from 'react';
import { Box, Typography } from '@mui/material';

const TasksPage = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Gestion des tâches
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Cette page affichera la liste des tâches créées et leur statut. (Fonctionnalité à compléter)
      </Typography>
    </Box>
  );
};

export default TasksPage;
