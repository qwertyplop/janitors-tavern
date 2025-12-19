'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { SyncProvider } from '@/components/providers/SyncProvider';
import { I18nProvider } from '@/components/providers/I18nProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, loading } = useAuth();

  // Show loading state while checking auth
  if (loading) {
    return (
      <I18nProvider>
        <div className="flex items-center justify-center h-screen">
          <div className="text-lg">Loading...</div>
        </div>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider>
      <SyncProvider>
        <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-900">
          {/* Mobile menu backdrop */}
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}

          {/* Sidebar - hidden on mobile, visible on desktop */}
          <div className={`
            fixed inset-y-0 left-0 z-50 lg:static lg:z-auto
            transform transition-transform duration-300 ease-in-out
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
            <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
          </div>

          <main className="flex-1 overflow-auto w-full">
            {/* Mobile header with hamburger */}
            <div className="sticky top-0 z-30 flex items-center gap-4 border-b border-zinc-200 bg-white px-4 py-3 lg:hidden dark:border-zinc-800 dark:bg-zinc-950">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 -ml-2 rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Open menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Janitor's Tavern</h1>
            </div>

            <div className="container mx-auto p-4 sm:p-6">{children}</div>
          </main>
        </div>
      </SyncProvider>
    </I18nProvider>
  );
}
