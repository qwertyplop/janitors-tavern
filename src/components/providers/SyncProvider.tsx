'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initializeSync, getSyncStatus, forceSync, isBlobConfigured, addSyncListener } from '@/lib/storage-sync';

interface SyncContextValue {
  initialized: boolean;
  blobConfigured: boolean;
  lastSync: string | null;
  syncing: boolean;
  forcePush: () => Promise<boolean>;
  forcePull: () => Promise<boolean>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [blobConfigured, setBlobConfigured] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Initialize sync on mount
    initializeSync().then(() => {
      setInitialized(true);
      const status = getSyncStatus();
      setBlobConfigured(status.configured);
      setLastSync(status.lastSync);
    });

    // Listen for auto-push sync status changes
    const unsubscribe = addSyncListener((isSyncing) => {
      setSyncing(isSyncing);
      if (!isSyncing) {
        // Update lastSync when sync completes
        const status = getSyncStatus();
        setLastSync(status.lastSync);
      }
    });

    return () => unsubscribe();
  }, []);

  const forcePush = async (): Promise<boolean> => {
    setSyncing(true);
    try {
      const success = await forceSync('push');
      if (success) {
        setLastSync(new Date().toISOString());
      }
      return success;
    } finally {
      setSyncing(false);
    }
  };

  const forcePull = async (): Promise<boolean> => {
    setSyncing(true);
    try {
      const success = await forceSync('pull');
      if (success) {
        setLastSync(new Date().toISOString());
        // Reload page to reflect pulled data
        window.location.reload();
      }
      return success;
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SyncContext.Provider
      value={{
        initialized,
        blobConfigured,
        lastSync,
        syncing,
        forcePush,
        forcePull,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
