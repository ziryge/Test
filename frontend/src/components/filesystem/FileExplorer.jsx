import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  IconButton,
  Divider,
  TextField,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  useTheme
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  CreateNewFolder as CreateNewFolderIcon,
  NoteAdd as NoteAddIcon,
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import FileSystemService from '../../services/FileSystemService';

const FileExplorer = ({ onClose, onFileSelect, initialPath = '' }) => {
  const theme = useTheme();
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState([]);
  const [directories, setDirectories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newFolderDialog, setNewFolderDialog] = useState(false);
  const [newFileDialog, setNewFileDialog] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileContentDialog, setFileContentDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Load files and directories
  const loadFiles = async (path = '') => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await FileSystemService.listFiles(path);
      setFiles(response.files || []);
      setDirectories(response.directories || []);
      setCurrentPath(response.path || '');
    } catch (error) {
      console.error('Error loading files:', error);
      setError('Failed to load files. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);

  // Handle directory navigation
  const navigateToDirectory = (path) => {
    loadFiles(path);
  };

  // Handle go back
  const goBack = () => {
    if (!currentPath) return;

    const pathParts = currentPath.split('/');
    pathParts.pop();
    const parentPath = pathParts.join('/');

    loadFiles(parentPath);
  };

  // Handle refresh
  const handleRefresh = () => {
    loadFiles(currentPath);
  };

  // Handle context menu open
  const handleContextMenu = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY });
    setSelectedItem(item);
  };

  // Handle context menu close
  const handleContextMenuClose = () => {
    setContextMenu(null);
    setSelectedItem(null);
  };

  // Handle file click
  const handleFileClick = async (file) => {
    try {
      setIsLoading(true);
      const response = await FileSystemService.readFile(file.path);
      setFileContent(response.content);
      setEditMode(false);
      setFileContentDialog(true);

      // If onFileSelect callback is provided, call it
      if (onFileSelect) {
        onFileSelect(file, response.content);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      setError('Failed to read file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle create new folder
  const handleCreateFolder = async () => {
    if (!newItemName.trim()) return;

    try {
      setIsLoading(true);
      const folderPath = currentPath
        ? `${currentPath}/${newItemName}`
        : newItemName;

      await FileSystemService.createFile(`${folderPath}/.gitkeep`, '');
      setNewFolderDialog(false);
      setNewItemName('');
      loadFiles(currentPath);
    } catch (error) {
      console.error('Error creating folder:', error);
      setError('Failed to create folder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle create new file
  const handleCreateFile = async () => {
    if (!newItemName.trim()) return;

    try {
      setIsLoading(true);
      const filePath = currentPath
        ? `${currentPath}/${newItemName}`
        : newItemName;

      await FileSystemService.createFile(filePath, fileContent);
      setNewFileDialog(false);
      setNewItemName('');
      setFileContent('');
      loadFiles(currentPath);
    } catch (error) {
      console.error('Error creating file:', error);
      setError('Failed to create file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle save file
  const handleSaveFile = async () => {
    if (!selectedItem) return;

    try {
      setIsLoading(true);
      await FileSystemService.updateFile(selectedItem.path, fileContent);
      setFileContentDialog(false);
      setEditMode(false);
      loadFiles(currentPath);
    } catch (error) {
      console.error('Error saving file:', error);
      setError('Failed to save file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete item
  const handleDeleteItem = async () => {
    if (!selectedItem) return;

    try {
      setIsLoading(true);
      await FileSystemService.deleteFile(selectedItem.path);
      handleContextMenuClose();
      loadFiles(currentPath);
    } catch (error) {
      console.error('Error deleting item:', error);
      setError('Failed to delete item. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
      {/* File explorer header */}
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
          <FolderIcon sx={{ mr: 1 }} />
          <Typography variant="subtitle1" fontWeight="medium">
            File Explorer
          </Typography>
        </Box>
        <Box>
          <IconButton size="small" color="inherit" onClick={handleRefresh}>
            <RefreshIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="inherit" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Divider />

      {/* Path navigation */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        }}
      >
        <IconButton size="small" onClick={goBack} disabled={!currentPath}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" sx={{ ml: 1, flexGrow: 1, fontFamily: 'monospace' }}>
          /{currentPath}
        </Typography>
        <IconButton size="small" onClick={() => setNewFolderDialog(true)}>
          <CreateNewFolderIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => setNewFileDialog(true)}>
          <NoteAddIcon fontSize="small" />
        </IconButton>
      </Box>

      <Divider />

      {/* File list */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 2, color: theme.palette.error.main }}>
            <Typography>{error}</Typography>
            <Button variant="outlined" size="small" onClick={handleRefresh} sx={{ mt: 1 }}>
              Retry
            </Button>
          </Box>
        ) : directories.length === 0 && files.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center', color: theme.palette.text.secondary }}>
            <Typography>This folder is empty</Typography>
          </Box>
        ) : (
          <List dense>
            {directories.map((dir) => (
              <ListItem
                key={dir.path}
                disablePadding
                onContextMenu={(e) => handleContextMenu(e, dir)}
              >
                <ListItemButton onClick={() => navigateToDirectory(dir.path)}>
                  <ListItemIcon>
                    <FolderIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText primary={dir.name} />
                </ListItemButton>
              </ListItem>
            ))}
            {files.map((file) => (
              <ListItem
                key={file.path}
                disablePadding
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                <ListItemButton onClick={() => handleFileClick(file)}>
                  <ListItemIcon>
                    <FileIcon color="info" />
                  </ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    secondary={`${(file.size / 1024).toFixed(1)} KB`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Context menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => {
          handleContextMenuClose();
          if (selectedItem && selectedItem.type === 'file') {
            handleFileClick(selectedItem);
          }
        }}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          if (window.confirm(`Are you sure you want to delete ${selectedItem?.name}?`)) {
            handleDeleteItem();
          } else {
            handleContextMenuClose();
          }
        }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* New folder dialog */}
      <Dialog open={newFolderDialog} onClose={() => setNewFolderDialog(false)}>
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            fullWidth
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateFolder} disabled={!newItemName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* New file dialog */}
      <Dialog
        open={newFileDialog}
        onClose={() => setNewFileDialog(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Create New File</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="File Name"
            fullWidth
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="File Content"
            multiline
            rows={15}
            fullWidth
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            sx={{
              fontFamily: 'monospace',
              '& .MuiInputBase-input': {
                fontFamily: 'monospace',
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFileDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateFile} disabled={!newItemName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* File content dialog */}
      <Dialog
        open={fileContentDialog}
        onClose={() => {
          if (editMode && !window.confirm('Discard changes?')) {
            return;
          }
          setFileContentDialog(false);
          setEditMode(false);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {selectedItem?.name || 'File Content'}
          <IconButton
            aria-label="close"
            onClick={() => {
              if (editMode && !window.confirm('Discard changes?')) {
                return;
              }
              setFileContentDialog(false);
              setEditMode(false);
            }}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            multiline
            rows={20}
            fullWidth
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            disabled={!editMode}
            sx={{
              fontFamily: 'monospace',
              '& .MuiInputBase-input': {
                fontFamily: 'monospace',
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          {!editMode ? (
            <Button onClick={() => setEditMode(true)}>Edit</Button>
          ) : (
            <>
              <Button onClick={() => setEditMode(false)}>Cancel</Button>
              <Button onClick={handleSaveFile}>Save</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default FileExplorer;
