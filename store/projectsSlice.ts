'use client';

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/init';

export interface Project {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  userId: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  status: 'draft' | 'in-progress' | 'completed';
  duration?: number;
  tags?: string[];
  emoji?: string;
}

interface ProjectsState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  selectedProject: Project | null;
}

const initialState: ProjectsState = {
  projects: [],
  loading: false,
  error: null,
  selectedProject: null,
};

export const createProject = createAsyncThunk(
  'projects/create',
  async (
    projectData: {
      title: string;
      description: string;
      thumbnail: string;
      userId: string;
      tags?: string[];
    },
    { rejectWithValue }
  ) => {
    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        ...projectData,
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return {
        id: docRef.id,
        ...projectData,
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create project');
    }
  }
);

export const fetchUserProjects = createAsyncThunk(
  'projects/fetchUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      const q = query(
        collection(db, 'projects'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const projects: Project[] = [];
      
      querySnapshot.forEach((doc) => {
        projects.push({
          id: doc.id,
          ...doc.data(),
        } as Project);
      });
      
      return projects;
    } catch (error: any) {
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        return rejectWithValue('Firestore index required. Check console for index creation link.');
      }
      return rejectWithValue(error.message || 'Failed to fetch projects');
    }
  }
);

export const updateProject = createAsyncThunk(
  'projects/update',
  async (
    { projectId, updates }: { projectId: string; updates: Partial<Project> },
    { rejectWithValue }
  ) => {
    try {
      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      
      return { projectId, updates };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteProject = createAsyncThunk(
  'projects/delete',
  async (projectId: string, { rejectWithValue }) => {
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      return projectId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setSelectedProject: (state, action: PayloadAction<Project | null>) => {
      state.selectedProject = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.loading = false;
        state.projects.unshift(action.payload);
      })
      .addCase(createProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchUserProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = action.payload;
      })
      .addCase(fetchUserProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        const index = state.projects.findIndex(
          (p) => p.id === action.payload.projectId
        );
        if (index !== -1) {
          state.projects[index] = {
            ...state.projects[index],
            ...action.payload.updates,
          };
        }
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.projects = state.projects.filter((p) => p.id !== action.payload);
      });
  },
});

export const { setSelectedProject, clearError } = projectsSlice.actions;
export default projectsSlice.reducer;
