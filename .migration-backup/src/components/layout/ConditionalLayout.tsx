'use client';

import { MainLayout } from './main-layout';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface ConditionalLayoutProps {
  children: ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  
  // Hide sidebar on login and register pages
  const hideSidebar = pathname === '/login' || pathname === '/register';
  
  return (
    <MainLayout hideSidebar={hideSidebar}>
      {children}
    </MainLayout>
  );
}