'use client';

import { ReactNode } from 'react';
import { useAuthListener } from '@/hooks/useAuthListener';

export function AuthProvider({ children }: { children: ReactNode }) {
  useAuthListener();
  return <>{children}</>;
}
