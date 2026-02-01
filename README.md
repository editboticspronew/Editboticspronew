# EditBotics Pro - Next.js Edition

AI-powered video editing platform built with Next.js, Firebase, and Material-UI.

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## ✅ What's Already Set Up

- ✅ **Firebase Authentication** - Email/password and Google sign-in working
- ✅ **Redux State Management** - Fully configured with auth and theme slices
- ✅ **Material-UI** - Complete theme system with dark/light mode
- ✅ **Mobile Responsive** - All pages optimized for mobile devices
- ✅ **Protected Routes** - Authentication-based access control
- ✅ **TypeScript** - Full type safety throughout

## 📁 Project Structure

```
editboticsnext/
├── app/                 # Next.js pages (App Router)
├── components/          # Reusable components
├── hooks/              # Custom React hooks
├── lib/                # Firebase config, utilities
├── store/              # Redux store and slices
└── public/             # Static assets
```

## 🔐 Features

### Authentication
- Email/password registration and login
- Google OAuth sign-in
- Password reset functionality
- Protected routes with automatic redirect
- User profile management

### UI/UX
- Responsive navigation with mobile drawer
- Dark/Light theme toggle (persists in localStorage)
- Material-UI components throughout
- Smooth animations and transitions

### State Management
- Redux Toolkit for global state
- Type-safe hooks
- Auth state synchronization with Firebase
- Theme preference persistence

## 📚 Documentation

- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Complete migration guide from React Router
- **[MIGRATION_PLAN.md](./MIGRATION_PLAN.md)** - Project migration roadmap

## 🔄 Migrating Components from React Router

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed instructions.

**Quick tips:**
1. Add `'use client'` to interactive components
2. Update imports: `@/` for absolute paths
3. Use `useRouter()` from `'next/navigation'`
4. Dynamic routes: `[param]/page.tsx`

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Auth**: Firebase Auth
- **Database**: Firestore
- **State**: Redux Toolkit
- **UI**: Material-UI v7
- **Styling**: Tailwind + Emotion
- **Language**: TypeScript
- **Video**: FFmpeg, Konva.js, Fabric.js

## 🎯 Next Steps

The foundation is ready! Next features to implement:

1. **Video Editor** - Timeline-based editing interface
2. **Projects** - Create/manage video projects
3. **Files** - Upload and manage media files
4. **AI Transcription** - Automatic audio transcription
5. **Export** - Video rendering and export

## 📖 Available Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm start        # Production server
npm run lint     # Run ESLint
```

## 🔧 Environment Setup

Create `.env.local` with your Firebase config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
# ... other Firebase config
```

## 📱 Mobile Responsive

All pages are tested and working on:
- Mobile (< 600px)
- Tablet (600px - 900px)
- Desktop (> 900px)

## 🌐 Deploy

Deploy easily on [Vercel](https://vercel.com):

```bash
npm run build
```

Or see [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying).

## 📄 License

Private - All rights reserved

---

**Note**: This is the Next.js migration of EditBotics Pro. The original React Router app remains in the parent directory.
