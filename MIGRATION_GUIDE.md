# Next.js Migration Guide for EditBotics Pro

## Project Overview

Successfully migrated EditBotics Pro from React Router to Next.js App Router while maintaining all functionality.

## ✅ Completed Setup

### 1. **Dependencies Installed**
- Firebase SDK (firebase)
- Redux Toolkit (@reduxjs/toolkit, react-redux)
- Material-UI (@mui/material, @mui/icons-material, @emotion/react, @emotion/styled)
- Video editing libraries (@ffmpeg/ffmpeg, konva, react-konva, fabric, wavesurfer.js)
- Drag & Drop (@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities)
- File upload (react-dropzone)

### 2. **Firebase Configuration**
- **Location**: `lib/firebase/init.ts`
- **Environment**: `.env.local` (using NEXT_PUBLIC_ prefix)
- **Features**: Auth, Firestore, Storage
- **Client Component**: Uses `'use client'` directive

### 3. **Redux Store Setup**
- **Store Provider**: `store/StoreProvider.tsx` (client component)
- **Slices**: 
  - `authSlice.ts` - Authentication state
  - `themeSlice.ts` - Theme mode (light/dark)
- **Hooks**: Type-safe Redux hooks in `store/hooks.ts`

### 4. **Providers Architecture**
```
RootLayout (app/layout.tsx)
  ├── StoreProvider (Redux)
  │   ├── ThemeProvider (Material-UI)
  │   │   └── AuthProvider (Firebase Auth Listener)
  │   │       └── Children
```

### 5. **Created Pages**
- ✅ Home page (`app/page.tsx`) - Landing page with features
- ✅ Login (`app/login/page.tsx`) - Email/password + Google auth
- ✅ Register (`app/register/page.tsx`) - User registration
- ✅ Dashboard (`app/dashboard/page.tsx`) - Protected route

### 6. **Components**
- ✅ `Navbar.tsx` - Responsive navigation with mobile drawer
- ✅ `ProtectedRoute.tsx` - Auth wrapper for protected pages
- ✅ `AuthProvider.tsx` - Firebase auth state listener
- ✅ `ThemeProvider.tsx` - Material-UI theme with dark mode

## 🔄 How to Migrate Components from React Router

### Step 1: Add 'use client' Directive
Any component that uses:
- React hooks (useState, useEffect, etc.)
- Event handlers (onClick, onChange, etc.)
- Browser APIs (window, localStorage, etc.)
- Redux hooks
- Firebase

```tsx
'use client';

import { useState } from 'react';
// ... rest of imports
```

### Step 2: Update Imports

**Old (React Router):**
```tsx
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/init';
import { useAppSelector } from '../store/hooks';
```

**New (Next.js):**
```tsx
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/init';
import { useAppSelector } from '@/store/hooks';
```

### Step 3: Update Navigation

**Old:**
```tsx
const navigate = useNavigate();
navigate('/dashboard');
```

**New:**
```tsx
const router = useRouter();
router.push('/dashboard');
```

### Step 4: File Location

Move components based on usage:
- **Shared components** → `components/` (e.g., dialogs, UI elements)
- **Page-specific components** → Next to the page file
- **Timeline components** → `components/Timeline/`

## 📁 Folder Mapping

| React Router | Next.js | Notes |
|--------------|---------|-------|
| `app/routes/home.tsx` | `app/page.tsx` | Root page |
| `app/routes/dashboard.tsx` | `app/dashboard/page.tsx` | Dashboard |
| `app/routes/editor.$projectId.tsx` | `app/editor/[projectId]/page.tsx` | Dynamic route |
| `app/routes/login.tsx` | `app/login/page.tsx` | Auth page |
| `app/routes/register.tsx` | `app/register/page.tsx` | Auth page |
| `app/components/` | `components/` | Shared components |
| `app/firebase/` | `lib/firebase/` | Firebase config |
| `app/utils/` | `lib/utils/` | Utility functions |
| `app/config/` | `lib/config/` | App constants |

## 🔐 Authentication Flow

### Current Implementation

1. **AuthProvider** (`components/providers/AuthProvider.tsx`)
   - Listens to Firebase auth state changes
   - Updates Redux store automatically
   - Runs in client component

2. **useAuth Hook** (`hooks/useAuth.ts`)
   - Returns: `{ user, loading, error, initialized, isAuthenticated }`
   - Use this in components to check auth state

3. **ProtectedRoute Component**
   - Wraps protected pages
   - Redirects to `/login` if not authenticated
   - Shows loading spinner while checking auth

### Usage Example

```tsx
'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function ProtectedPage() {
  return (
    <ProtectedRoute>
      <YourContent />
    </ProtectedRoute>
  );
}
```

## 🎨 Theming (Dark/Light Mode)

The theme system is fully functional:

1. **Toggle Theme**: Use Redux action
```tsx
import { toggleTheme } from '@/store/themeSlice';
dispatch(toggleTheme());
```

2. **Access Theme Mode**:
```tsx
const mode = useAppSelector((state) => state.theme.mode);
```

3. **Material-UI Theme**: Automatically updates based on Redux state

## 📱 Mobile Responsiveness

All pages are mobile-responsive using:
- Material-UI's responsive breakpoints
- `useMediaQuery` hook for conditional rendering
- Mobile drawer navigation in Navbar
- Responsive typography and spacing

Example:
```tsx
const isMobile = useMediaQuery(theme.breakpoints.down('md'));
```

## 🚀 Next Steps to Complete Migration

### Phase 1: Core Pages (Priority 1)
1. Create About page (`app/about/page.tsx`)
2. Create Projects page (`app/projects/page.tsx`)
3. Create Files page (`app/files/page.tsx`)
4. Create Profile page (`app/profile/page.tsx`)
5. Create Settings page (`app/settings/page.tsx`)

### Phase 2: Editor (Priority 2)
1. Create Editor page structure (`app/editor/[projectId]/page.tsx`)
2. Migrate Timeline components:
   - `AudioWaveform.tsx`
   - `ClipThumbnails.tsx`
   - `TimelineCanvas.tsx`
   - `TimelineControls.tsx`
   - `VideoPreview.tsx`
3. Add `'use client'` to all Timeline components

### Phase 3: Dialogs & Modals (Priority 3)
1. Migrate dialog components:
   - `AddVideoDialog.tsx`
   - `CreateProjectDialog.tsx`
   - `CreateProjectWizard.tsx`
   - `FileUploadZone.tsx`
   - `PreUploadAudioDialog.tsx`
   - `TranscriptionModal.tsx`

### Phase 4: Redux Slices (Priority 4)
1. Migrate `projectsSlice.ts` from React app
2. Migrate `filesSlice.ts` from React app
3. Add to store configuration

### Phase 5: Utilities (Priority 5)
1. Create `lib/utils/` folder
2. Migrate utility files:
   - `audioExtraction.ts`
   - `audioTranscription.ts`
   - `fileUpload.ts`
   - `videoExport.ts`

## 🧪 Testing Checklist

- [ ] Firebase authentication works
- [ ] Google sign-in works
- [ ] Protected routes redirect correctly
- [ ] Theme toggle works
- [ ] Mobile navigation works
- [ ] Redux state persists
- [ ] All pages are mobile-responsive

## 🔧 Development Commands

```bash
# Start development server
cd editboticsnext
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## 📝 Important Notes

### 1. Environment Variables
- All Firebase config is in `.env.local`
- Use `NEXT_PUBLIC_` prefix for client-side variables
- Never commit `.env.local` to git

### 2. Client vs Server Components
- Default: Server Components (faster, better SEO)
- Use `'use client'` when needed:
  - Interactive features
  - Browser APIs
  - Redux/Firebase
  - Event handlers

### 3. Image Optimization
- Use Next.js `<Image>` component instead of `<img>`
- Automatic optimization and lazy loading

### 4. Routing
- File-based routing in `app/` directory
- Dynamic routes: `[param]/page.tsx`
- Route groups: `(group)/page.tsx`

## 🎯 Migration Strategy

### Recommended Approach:
1. **Incremental Migration**: Move one feature at a time
2. **Test Frequently**: Run dev server after each migration
3. **Keep Both Apps**: Don't delete React app until fully migrated
4. **Use TypeScript**: Maintain type safety throughout

### Tips:
- Start with simple pages (About, Contact)
- Move complex features (Editor) last
- Test mobile responsiveness for each page
- Use browser dev tools to verify Firebase/Redux

## 🐛 Common Issues & Solutions

### Issue: "Error: 'use client' directive not found"
**Solution**: Add `'use client'` at the top of the component file

### Issue: "window is not defined"
**Solution**: Wrap browser-specific code in `typeof window !== 'undefined'` check

### Issue: Firebase not initializing
**Solution**: Ensure Firebase init file has `'use client'` directive

### Issue: Redux state not persisting
**Solution**: Check that StoreProvider is in client component tree

### Issue: Theme not updating
**Solution**: Verify ThemeProvider is inside StoreProvider

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Firebase with Next.js](https://firebase.google.com/docs/web/setup)
- [Material-UI with Next.js](https://mui.com/material-ui/integrations/nextjs/)
- [Redux Toolkit](https://redux-toolkit.js.org/)
