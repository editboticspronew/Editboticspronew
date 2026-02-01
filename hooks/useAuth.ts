'use client';

import { useAppSelector } from '@/store/hooks';

export function useAuth() {
  const { user, loading, error, initialized } = useAppSelector((state) => state.auth);
  
  return {
    user,
    loading,
    error,
    initialized,
    isAuthenticated: !!user,
  };
}
