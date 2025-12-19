'use client';

import { AuthProvider } from './AuthProvider';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}