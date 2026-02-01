# Migration Plan: React Router → Next.js

## Overview
Migrating EditBotics Pro from React Router to Next.js while preserving all functionality and mobile responsiveness.

## Key Differences & Adaptations

### 1. **Firebase Setup**
- **React Router**: Client-side only initialization
- **Next.js**: Need client-side components (`'use client'`) for Firebase
- **Strategy**: Create lib/firebase folder with client-side initialization

### 2. **State Management (Redux)**
- **React Router**: Standard Redux setup
- **Next.js**: Wrap with Provider in root layout (client component)
- **Strategy**: Create store/provider.tsx with 'use client' directive

### 3. **Routing**
- **React Router**: File-based routes in app/routes/
- **Next.js**: App Router with app/ directory
- **Migration**:
  - `home.tsx` → `app/page.tsx`
  - `dashboard.tsx` → `app/dashboard/page.tsx`
  - `editor.$projectId.tsx` → `app/editor/[projectId]/page.tsx`
  - `login.tsx` → `app/login/page.tsx`
  - etc.

### 4. **Components**
- **Client Components**: All interactive components need `'use client'`
  - Components using hooks (useState, useEffect, etc.)
  - Components with Firebase auth
  - Components with event handlers
- **Server Components**: Static components can remain server-side
- **Strategy**: Start with 'use client' for all, optimize later

### 5. **Authentication**
- **Strategy**: 
  - Create AuthProvider as client component
  - Use middleware for protected routes
  - Maintain existing auth hooks

### 6. **Mobile Responsiveness**
- Tailwind CSS is already configured
- Material-UI components maintain responsive design
- Test all breakpoints during migration

## Folder Structure

```
editboticsnext/
├── app/
│   ├── layout.tsx (root layout with providers)
│   ├── page.tsx (home)
│   ├── dashboard/
│   │   └── page.tsx
│   ├── editor/
│   │   └── [projectId]/
│   │       └── page.tsx
│   ├── login/
│   │   └── page.tsx
│   └── ... (other routes)
├── components/ (shared components)
│   ├── Timeline/
│   ├── ProtectedRoute.tsx
│   └── ...
├── lib/
│   ├── firebase/
│   │   └── init.ts (client-side)
│   └── utils/
├── store/
│   ├── provider.tsx (Redux Provider)
│   ├── index.ts
│   ├── authSlice.ts
│   └── ...
├── hooks/
│   ├── useAuth.ts
│   └── ...
└── public/
```

## Migration Steps

### Phase 1: Foundation (Current)
- [x] Initialize Next.js app
- [ ] Install dependencies (Firebase, Redux, Material-UI, etc.)
- [ ] Setup Firebase configuration
- [ ] Setup Redux store with provider
- [ ] Create folder structure

### Phase 2: Core Features
- [ ] Setup authentication system
- [ ] Migrate layout and navigation
- [ ] Setup protected routes
- [ ] Migrate theme system

### Phase 3: Components
- [ ] Migrate shared components
- [ ] Migrate Timeline components
- [ ] Migrate dialog components
- [ ] Test component functionality

### Phase 4: Routes/Pages
- [ ] Migrate home page
- [ ] Migrate dashboard
- [ ] Migrate editor page
- [ ] Migrate authentication pages
- [ ] Migrate other pages

### Phase 5: Utils & Services
- [ ] Migrate file upload utilities
- [ ] Migrate audio/video processing
- [ ] Migrate transcription services
- [ ] Test all integrations

### Phase 6: Testing & Optimization
- [ ] Test mobile responsiveness
- [ ] Test Firebase integration
- [ ] Performance optimization
- [ ] Deploy and test

## Important Notes

1. **Environment Variables**: Move Firebase config to .env.local
2. **Image Optimization**: Use Next.js Image component
3. **Metadata**: Add metadata to each page
4. **API Routes**: Consider moving server logic to Next.js API routes
5. **Error Boundaries**: Implement error.tsx in each route
6. **Loading States**: Add loading.tsx for better UX
