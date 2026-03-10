'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  IconButton,
  Typography,
  Chip,
  useTheme,
  useMediaQuery,
  Divider,
} from '@mui/material';
import {
  Close,
  Add,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { createProject } from '@/store/projectsSlice';
import { useAuth } from '@/hooks/useAuth';
import { THUMBNAIL_OPTIONS, DEFAULT_THUMBNAIL, ThumbnailIcon } from '@/lib/thumbnailIcons';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
}


export function CreateProjectDialog({ open, onClose }: CreateProjectDialogProps) {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    thumbnail: DEFAULT_THUMBNAIL,
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  const handleCreateProject = async () => {
    if (!user?.uid || !formData.title.trim()) return;

    setLoading(true);
    try {
      const result = await dispatch(createProject({
        title: formData.title,
        description: formData.description,
        thumbnail: formData.thumbnail,
        userId: user.uid,
        tags: formData.tags,
      })).unwrap();

      // Navigate to the editor for the new project
      router.push(`/editor/${result.id}`);
      handleClose();
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      thumbnail: DEFAULT_THUMBNAIL,
      tags: [],
    });
    setTagInput('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          maxHeight: isMobile ? '100vh' : '90vh',
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1,
      }}>
        <Typography variant="h6" fontWeight={700}>
          Create New Project
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Project Title */}
          <TextField
            label="Project Title"
            fullWidth
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            autoFocus
            required
            placeholder="My Awesome Video"
          />

          {/* Description */}
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="What's this project about?"
          />

          {/* Thumbnail Icon */}
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Project Icon
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {THUMBNAIL_OPTIONS.map((option) => (
                <Box
                  key={option.id}
                  onClick={() => setFormData({ ...formData, thumbnail: option.id })}
                  sx={{
                    width: 48,
                    height: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: 2,
                    borderColor: formData.thumbnail === option.id ? 'primary.main' : 'divider',
                    bgcolor: formData.thumbnail === option.id ? 'action.selected' : 'transparent',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      transform: 'scale(1.1)',
                    },
                  }}
                >
                  <ThumbnailIcon name={option.id} size={24} color={option.color} />
                </Box>
              ))}
            </Box>
          </Box>

          {/* Tags */}
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Tags (optional)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                size="small"
                fullWidth
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add a tag"
              />
              <Button 
                variant="outlined" 
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
                startIcon={<Add />}
              >
                Add
              </Button>
            </Box>
            {formData.tags.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {formData.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => handleRemoveTag(tag)}
                    size="small"
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleCreateProject}
          variant="contained"
          disabled={!formData.title.trim() || loading}
          sx={{
            background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
            minWidth: 120,
          }}
        >
          {loading ? 'Creating...' : 'Create Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
