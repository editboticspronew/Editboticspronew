'use client';

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import themeReducer from './themeSlice';
import projectsReducer from './projectsSlice';
import filesReducer from './filesSlice';
import editorReducer from './editorSlice';

export const makeStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer,
      theme: themeReducer,
      projects: projectsReducer,
      files: filesReducer,
      editor: editorReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['auth/loginUser/fulfilled', 'auth/registerUser/fulfilled', 'projects/create/fulfilled', 'projects/fetchUser/fulfilled', 'files/fetchProject/fulfilled', 'files/fetchAll/fulfilled'],
          ignoredPaths: ['projects.projects', 'files.files', 'editor.past', 'editor.future'],
        },
      }),
  });
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
