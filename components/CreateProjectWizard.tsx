'use client';

import React, { useState } from 'react';
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
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  useTheme,
  useMediaQuery,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Close,
  Add,
  AutoAwesome,
  CreateNewFolder,
  VideoLibrary,
  TrendingUp,
  Instagram,
  YouTube,
  ArrowBack,
  ArrowForward,
  CloudUpload,
  Image as ImageIcon,
  AudioFile,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { createProject } from '@/store/projectsSlice';
import { uploadProjectFile } from '@/store/filesSlice';
import { useAuth } from '@/hooks/useAuth';

interface CreateProjectWizardProps {
  open: boolean;
  onClose: () => void;
}

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  aspectRatio?: string;
  suggestedDuration?: string;
}

const templates: ProjectTemplate[] = [
  {
    id: 'tiktok',
    name: 'TikTok Video',
    description: 'Vertical short-form content (9:16)',
    icon: <TrendingUp />,
    category: 'Social Media',
    aspectRatio: '9:16',
    suggestedDuration: '15-60s',
  },
  {
    id: 'youtube',
    name: 'YouTube Video',
    description: 'Horizontal long-form content (16:9)',
    icon: <YouTube />,
    category: 'Social Media',
    aspectRatio: '16:9',
    suggestedDuration: '5-15min',
  },
  {
    id: 'instagram-reel',
    name: 'Instagram Reel',
    description: 'Vertical short video (9:16)',
    icon: <Instagram />,
    category: 'Social Media',
    aspectRatio: '9:16',
    suggestedDuration: '15-90s',
  },
  {
    id: 'instagram-story',
    name: 'Instagram Story',
    description: 'Vertical story format (9:16)',
    icon: <Instagram />,
    category: 'Social Media',
    aspectRatio: '9:16',
    suggestedDuration: '15s',
  },
  {
    id: 'custom',
    name: 'Custom Video',
    description: 'Start with your own specifications',
    icon: <VideoLibrary />,
    category: 'Custom',
    aspectRatio: 'Custom',
    suggestedDuration: 'Any',
  },
];

const thumbnailEmojis = ['🎬', '🎥', '📹', '🎞️', '📽️', '🌴', '🏖️', '🌆', '🌃', '🎨', '🎭', '🎪', '🎸', '🎤', '🎧', '📚', '✨', '🔥', '💎', '🚀'];

export default function CreateProjectWizard({ open, onClose }: CreateProjectWizardProps) {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [activeStep, setActiveStep] = useState(0);
  const [projectType, setProjectType] = useState<'blank' | 'assisted' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    thumbnail: '🎬',
    tags: [] as string[],
    template: '' as string,
  });
  
  const [tagInput, setTagInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const steps = projectType === 'assisted' 
    ? ['Choose Type', 'Select Template', 'Describe Project', 'Add Resources', 'Review & Create']
    : ['Choose Type', 'Project Details', 'Create'];

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setProjectType(null);
    setFormData({
      title: '',
      description: '',
      thumbnail: '🎬',
      tags: [],
      template: '',
    });
    setTagInput('');
    setSelectedFiles([]);
    setError('');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

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
    if (!user?.uid) {
      setError('You must be logged in to create a project');
      return;
    }

    if (!formData.title.trim()) {
      setError('Project title is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create project
      const project = await dispatch(createProject({
        ...formData,
        userId: user.uid,
      })).unwrap();

      // Upload files if any
      if (selectedFiles.length > 0) {
        setUploadingFiles(true);
        
        for (const file of selectedFiles) {
          const fileType = file.type.split('/')[0] as 'video' | 'audio' | 'image';
          
          if (['video', 'image', 'audio'].includes(fileType)) {
            await dispatch(
              uploadProjectFile({
                file,
                projectId: project.id,
                userId: user.uid,
                type: fileType,
              })
            ).unwrap();
          }
        }
      }

      // Navigate to project page
      handleReset();
      onClose();
      router.push(`/project/${project.id}`);
    } catch (err: any) {
      setError(err || 'Failed to create project');
    } finally {
      setLoading(false);
      setUploadingFiles(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      handleReset();
      onClose();
    }
  };

  const renderStepContent = () => {
    // Step 0: Choose Project Type
    if (activeStep === 0) {
      return (
        <Box sx={{ py: 3 }}>
          <Typography variant="h6" fontWeight={700} textAlign="center" gutterBottom>
            How would you like to create your project?
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
            Choose the creation method that works best for you
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
            <Box>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: 2,
                  borderColor: projectType === 'blank' ? 'primary.main' : 'divider',
                  transition: 'all 0.3s',
                  height: '100%',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[8],
                  },
                }}
                onClick={() => setProjectType('blank')}
              >
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <CreateNewFolder sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Blank Project
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Start from scratch with a clean canvas. Perfect for experienced creators.
                  </Typography>
                  <Chip label="3 Steps" size="small" sx={{ mt: 2 }} />
                </CardContent>
              </Card>
            </Box>

            <Box>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: 2,
                  borderColor: projectType === 'assisted' ? 'primary.main' : 'divider',
                  background: projectType === 'assisted' 
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)'
                    : 'transparent',
                  transition: 'all 0.3s',
                  height: '100%',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[8],
                  },
                }}
                onClick={() => setProjectType('assisted')}
              >
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <AutoAwesome sx={{ fontSize: 64, color: 'secondary.main', mb: 2 }} />
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    AI-Assisted
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Get guided with templates and suggestions. Great for beginners.
                  </Typography>
                  <Chip label="5 Steps" size="small" color="secondary" sx={{ mt: 2 }} />
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>
      );
    }

    // Blank Project Steps
    if (projectType === 'blank') {
      // Step 1: Project Details
      if (activeStep === 1) {
        return (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Project Details
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Set up your project information
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Thumbnail Selector */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Choose Thumbnail
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {thumbnailEmojis.map((emoji) => (
                    <Box
                      key={emoji}
                      onClick={() => setFormData({ ...formData, thumbnail: emoji })}
                      sx={{
                        width: 48,
                        height: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 1,
                        cursor: 'pointer',
                        fontSize: 24,
                        border: 2,
                        borderColor: formData.thumbnail === emoji ? 'primary.main' : 'divider',
                        bgcolor: formData.thumbnail === emoji ? 'action.selected' : 'transparent',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: 'primary.main',
                          transform: 'scale(1.1)',
                        },
                      }}
                    >
                      {emoji}
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Project Title */}
              <TextField
                label="Project Title"
                fullWidth
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                placeholder="Describe your project..."
              />

              {/* Tags */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Tags (Optional)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add a tag..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button onClick={handleAddTag} variant="outlined" startIcon={<Add />}>
                    Add
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {formData.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      onDelete={() => handleRemoveTag(tag)}
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>
        );
      }

      // Step 2: Review & Create
      if (activeStep === 2) {
        return (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Review & Create
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Confirm your project details
            </Typography>

            <Card sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Box sx={{ fontSize: 48 }}>{formData.thumbnail}</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" fontWeight={700}>
                    {formData.title || 'Untitled Project'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formData.description || 'No description provided'}
                  </Typography>
                  {formData.tags.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                      {formData.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            </Card>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
        );
      }
    }

    // AI-Assisted Project Steps
    if (projectType === 'assisted') {
      // Step 1: Select Template
      if (activeStep === 1) {
        return (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Select Template
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose a template that fits your content type
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
              {templates.map((template) => (
                <Card
                  key={template.id}
                  sx={{
                    cursor: 'pointer',
                    border: 2,
                    borderColor: formData.template === template.id ? 'primary.main' : 'divider',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      transform: 'translateY(-2px)',
                      boxShadow: theme.shadows[4],
                    },
                  }}
                  onClick={() => setFormData({ ...formData, template: template.id })}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {template.icon}
                      <Typography variant="subtitle1" fontWeight={700}>
                        {template.name}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {template.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {template.aspectRatio && (
                        <Chip label={template.aspectRatio} size="small" />
                      )}
                      {template.suggestedDuration && (
                        <Chip label={template.suggestedDuration} size="small" color="secondary" />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        );
      }

      // Step 2: Describe Project
      if (activeStep === 2) {
        return (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Describe Your Project
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Tell us about your video project
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Thumbnail Selector */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Choose Thumbnail
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {thumbnailEmojis.map((emoji) => (
                    <Box
                      key={emoji}
                      onClick={() => setFormData({ ...formData, thumbnail: emoji })}
                      sx={{
                        width: 48,
                        height: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 1,
                        cursor: 'pointer',
                        fontSize: 24,
                        border: 2,
                        borderColor: formData.thumbnail === emoji ? 'primary.main' : 'divider',
                        bgcolor: formData.thumbnail === emoji ? 'action.selected' : 'transparent',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: 'primary.main',
                          transform: 'scale(1.1)',
                        },
                      }}
                    >
                      {emoji}
                    </Box>
                  ))}
                </Box>
              </Box>

              <TextField
                label="Project Title"
                fullWidth
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="My Awesome Video"
              />

              <TextField
                label="Description"
                fullWidth
                multiline
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what you want to create..."
              />

              {/* Tags */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Tags
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add a tag..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button onClick={handleAddTag} variant="outlined" startIcon={<Add />}>
                    Add
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {formData.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      onDelete={() => handleRemoveTag(tag)}
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>
        );
      }

      // Step 3: Add Resources
      if (activeStep === 3) {
        return (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Add Resources
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Upload videos, images, or audio files (optional)
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                component="label"
                variant="outlined"
                startIcon={<CloudUpload />}
                sx={{ py: 2 }}
              >
                Upload Files
                <input
                  type="file"
                  hidden
                  multiple
                  accept="video/*,image/*,audio/*"
                  onChange={handleFileSelect}
                />
              </Button>

              {selectedFiles.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Selected Files ({selectedFiles.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {selectedFiles.map((file, index) => (
                      <Card key={index} variant="outlined">
                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}>
                          {file.type.startsWith('video') && <VideoLibrary color="primary" />}
                          {file.type.startsWith('image') && <ImageIcon color="secondary" />}
                          {file.type.startsWith('audio') && <AudioFile color="info" />}
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {file.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </Typography>
                          </Box>
                          <IconButton size="small" onClick={() => handleRemoveFile(index)}>
                            <Close fontSize="small" />
                          </IconButton>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        );
      }

      // Step 4: Review & Create
      if (activeStep === 4) {
        const selectedTemplate = templates.find((t) => t.id === formData.template);
        
        return (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Review & Create
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Confirm your project details
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Template
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {selectedTemplate?.icon}
                    <Typography variant="body1" fontWeight={600}>
                      {selectedTemplate?.name || 'No template selected'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Box sx={{ fontSize: 48 }}>{formData.thumbnail}</Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" fontWeight={700}>
                        {formData.title || 'Untitled Project'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formData.description || 'No description provided'}
                      </Typography>
                      {formData.tags.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                          {formData.tags.map((tag) => (
                            <Chip key={tag} label={tag} size="small" />
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {selectedFiles.length > 0 && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Files to Upload ({selectedFiles.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {selectedFiles.map((file, index) => (
                        <Chip key={index} label={file.name} size="small" />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
        );
      }
    }

    return null;
  };

  const isNextDisabled = () => {
    if (activeStep === 0) return !projectType;
    if (projectType === 'blank') {
      if (activeStep === 1) return !formData.title.trim();
    }
    if (projectType === 'assisted') {
      if (activeStep === 1) return !formData.template;
      if (activeStep === 2) return !formData.title.trim();
    }
    return false;
  };

  const isLastStep = activeStep === steps.length - 1;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          maxHeight: isMobile ? '100vh' : '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Typography variant="h6" fontWeight={700}>
          Create New Project
        </Typography>
        <IconButton onClick={handleClose} size="small" disabled={loading}>
          <Close />
        </IconButton>
      </DialogTitle>

      <Divider />

      {/* Stepper */}
      {projectType && (
        <Box sx={{ px: 3, pt: 3 }}>
          <Stepper activeStep={activeStep} alternativeLabel={isMobile}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}

      {(loading || uploadingFiles) && <LinearProgress />}

      <DialogContent sx={{ pt: projectType ? 2 : 3 }}>
        {renderStepContent()}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        {activeStep > 0 && (
          <Button onClick={handleBack} startIcon={<ArrowBack />} disabled={loading}>
            Back
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {!isLastStep ? (
          <Button
            onClick={handleNext}
            variant="contained"
            endIcon={<ArrowForward />}
            disabled={isNextDisabled() || loading}
            sx={{
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            }}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleCreateProject}
            variant="contained"
            disabled={loading || uploadingFiles || !formData.title.trim()}
            sx={{
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            }}
          >
            {loading
              ? 'Creating...'
              : uploadingFiles
              ? 'Uploading Files...'
              : 'Create Project'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
