'use client';

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/init';
import { uploadFile, deleteFile } from '@/utils/fileUpload';

export interface ProjectFile {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  originalName: string;
  type: 'video' | 'audio' | 'image' | 'other';
  size: number;
  url: string;
  storagePath: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  duration?: number;
  thumbnail?: string;
  transcription?: string;
  videoType?: string;
  aiAnalysis?: any; // AI video analysis results
}

interface FilesState {
  files: ProjectFile[];
  loading: boolean;
  uploadProgress: { [fileId: string]: number };
  error: string | null;
}

const initialState: FilesState = {
  files: [],
  loading: false,
  uploadProgress: {},
  error: null,
};

export const fetchProjectFiles = createAsyncThunk(
  'files/fetchProject',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const q = query(
        collection(db, 'files'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const files: ProjectFile[] = [];

      querySnapshot.forEach((doc) => {
        files.push({
          id: doc.id,
          ...doc.data(),
        } as ProjectFile);
      });

      return files;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchAllUserFiles = createAsyncThunk(
  'files/fetchAll',
  async (userId: string, { rejectWithValue }) => {
    try {
      const q = query(
        collection(db, 'files'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const files: ProjectFile[] = [];

      querySnapshot.forEach((doc) => {
        files.push({
          id: doc.id,
          ...doc.data(),
        } as ProjectFile);
      });

      return files;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const uploadProjectFile = createAsyncThunk(
  'files/upload',
  async (
    {
      file,
      projectId,
      userId,
      type,
      transcription,
      videoType,
    }: {
      file: File;
      projectId: string;
      userId: string;
      type: 'video' | 'audio' | 'image';
      transcription?: string;
      videoType?: string;
    },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const timestamp = Date.now();
      const storagePath = `projects/${userId}/${projectId}/${timestamp}_${file.name}`;

      // Upload file with progress tracking
      const url = await uploadFile(file, storagePath, (progress) => {
        dispatch(setUploadProgress({ fileId: timestamp.toString(), progress: progress.progress }));
      });

      // Save metadata to Firestore
      const fileData: any = {
        projectId,
        userId,
        name: file.name,
        originalName: file.name,
        type,
        size: file.size,
        url,
        storagePath,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Add optional metadata
      if (transcription) fileData.transcription = transcription;
      if (videoType) fileData.videoType = videoType;

      const docRef = await addDoc(collection(db, 'files'), fileData);

      return {
        id: docRef.id,
        projectId,
        userId,
        name: file.name,
        originalName: file.name,
        type,
        size: file.size,
        url,
        storagePath,
        createdAt: new Date(),
        updatedAt: new Date(),
        transcription,
        videoType,
      } as ProjectFile;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Save project file metadata without uploading (file already uploaded)
 * Use this when the file has already been uploaded to Firebase Storage
 */
export const saveProjectFileMetadata = createAsyncThunk(
  'files/saveMetadata',
  async (
    {
      projectId,
      userId,
      name,
      type,
      size,
      url,
      storagePath,
      transcription,
      videoType,
      aiAnalysis,
    }: {
      projectId: string;
      userId: string;
      name: string;
      type: 'video' | 'audio' | 'image';
      size: number;
      url: string;
      storagePath: string;
      transcription?: string;
      videoType?: string;
      aiAnalysis?: any;
    },
    { rejectWithValue }
  ) => {
    try {
      // Save metadata to Firestore (file already uploaded)
      const fileData: any = {
        projectId,
        userId,
        name,
        originalName: name,
        type,
        size,
        url,
        storagePath,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Add optional metadata
      if (transcription) fileData.transcription = transcription;
      if (videoType) fileData.videoType = videoType;
      if (aiAnalysis) fileData.aiAnalysis = aiAnalysis;

      const docRef = await addDoc(collection(db, 'files'), fileData);

      return {
        id: docRef.id,
        projectId,
        userId,
        name,
        originalName: name,
        type,
        size,
        url,
        storagePath,
        createdAt: new Date(),
        updatedAt: new Date(),
        transcription,
        videoType,
        aiAnalysis,
      } as ProjectFile;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteProjectFile = createAsyncThunk(
  'files/delete',
  async ({ fileId, storagePath }: { fileId: string; storagePath: string }, { rejectWithValue }) => {
    try {
      // Delete from Storage
      await deleteFile(storagePath);

      // Delete from Firestore
      await deleteDoc(doc(db, 'files', fileId));

      return fileId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    setUploadProgress: (state, action: PayloadAction<{ fileId: string; progress: number }>) => {
      state.uploadProgress[action.payload.fileId] = action.payload.progress;
    },
    clearUploadProgress: (state, action: PayloadAction<string>) => {
      delete state.uploadProgress[action.payload];
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjectFiles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjectFiles.fulfilled, (state, action) => {
        state.loading = false;
        // Merge files from different projects
        const newFiles = action.payload.filter(
          newFile => !state.files.some(existingFile => existingFile.id === newFile.id)
        );
        state.files = [...state.files, ...newFiles];
      })
      .addCase(fetchProjectFiles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchAllUserFiles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllUserFiles.fulfilled, (state, action) => {
        state.loading = false;
        state.files = action.payload;
      })
      .addCase(fetchAllUserFiles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(uploadProjectFile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadProjectFile.fulfilled, (state, action) => {
        state.loading = false;
        state.files.push(action.payload);
      })
      .addCase(uploadProjectFile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(saveProjectFileMetadata.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveProjectFileMetadata.fulfilled, (state, action) => {
        state.loading = false;
        state.files.push(action.payload);
      })
      .addCase(saveProjectFileMetadata.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(deleteProjectFile.fulfilled, (state, action) => {
        state.files = state.files.filter((f) => f.id !== action.payload);
      });
  },
});

export const { setUploadProgress, clearUploadProgress, clearError } = filesSlice.actions;
export default filesSlice.reducer;
