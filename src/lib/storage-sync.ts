// ============================================
// Storage Sync Service
// ============================================
// Handles auto-sync between localStorage and Vercel Blob

import { ConnectionPreset, ChatCompletionPreset, AppSettings } from '@/types';

// ============================================
// Types
// ============================================

export interface StorageData {
  connections: ConnectionPreset[];
  presets: ChatCompletionPreset[];
  settings: AppSettings;
}

interface SyncStatus {
  configured: boolean;
  lastSync: string | null;
  syncing: boolean;
}

// ============================================
// Sync State (Module-level singleton)
// ============================================

let blobConfigured: boolean | null = null;
let isSyncing = false;
let syncInitialized = false;
let initPromise: Promise<void> | null = null;

// Debounce timer for push operations
let pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const PUSH_DEBOUNCE_MS = 1000; // Wait 1 second after last change before pushing

// Sync status change listeners
type SyncListener = (syncing: boolean) => void;
const syncListeners: Set<SyncListener> = new Set();

export function addSyncListener(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function notifySyncListeners(syncing: boolean): void {
  syncListeners.forEach(listener => listener(syncing));
}

// ============================================
// Check Blob Configuration
// ============================================

async function checkBlobStatus(): Promise<boolean> {
  try {
    const response = await fetch('/api/storage/status');
    if (response.ok) {
      const data = await response.json();
      return data.configured === true;
    }
  } catch (error) {
    console.error('Failed to check blob status:', error);
  }
  return false;
}

// ============================================
// Pull from Blob
// ============================================

async function pullFromBlob(): Promise<StorageData | null> {
  try {
    const response = await fetch('/api/storage/all');
    if (response.ok) {
      const data = await response.json();
      // Check if we got valid data (not just defaults)
      if (data && (data.connections?.length > 0 || data.presets?.length > 0)) {
        return data;
      }
    }
  } catch (error) {
    console.error('Failed to pull from blob:', error);
  }
  return null;
}

// ============================================
// Push to Blob
// ============================================

async function pushToBlob(data: Partial<StorageData>): Promise<boolean> {
  try {
    const response = await fetch('/api/storage/all', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to push to blob:', error);
    return false;
  }
}

// ============================================
// Local Storage Helpers
// ============================================

const STORAGE_KEYS = {
  connections: 'jt.connectionPresets',
  presets: 'jt.chatCompletionPresets',
  settings: 'jt.settings',
  lastSync: 'jt.lastBlobSync',
};

function getLocalData(): StorageData {
  if (typeof window === 'undefined') {
    return { connections: [], presets: [], settings: getDefaultSettings() };
  }

  return {
    connections: JSON.parse(localStorage.getItem(STORAGE_KEYS.connections) || '[]'),
    presets: JSON.parse(localStorage.getItem(STORAGE_KEYS.presets) || '[]'),
    settings: JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || 'null') || getDefaultSettings(),
  };
}

function setLocalData(data: Partial<StorageData>): void {
  if (typeof window === 'undefined') return;

  if (data.connections !== undefined) {
    localStorage.setItem(STORAGE_KEYS.connections, JSON.stringify(data.connections));
  }
  if (data.presets !== undefined) {
    localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(data.presets));
  }
  if (data.settings !== undefined) {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(data.settings));
  }
}

function getDefaultSettings(): AppSettings {
  return {
    theme: 'system',
    language: 'en',
    showAdvancedOptions: false,
    logging: {
      enabled: false,
      logRequests: true,
      logResponses: true,
      logFilePath: 'logs/proxy.log',
    },
  };
}

// ============================================
// Initialize Sync (Call on app start)
// ============================================

export async function initializeSync(): Promise<void> {
  // Only initialize once
  if (syncInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[Storage Sync] Initializing...');

    // Check if blob is configured
    blobConfigured = await checkBlobStatus();
    console.log(`[Storage Sync] Blob configured: ${blobConfigured}`);

    if (blobConfigured) {
      // Pull from blob on launch
      console.log('[Storage Sync] Pulling data from cloud...');
      const blobData = await pullFromBlob();

      if (blobData) {
        const localData = getLocalData();

        // Merge strategy: Blob data takes precedence if it has content
        // But keep local data if blob is empty for that category
        const mergedData: StorageData = {
          connections: blobData.connections?.length > 0 ? blobData.connections : localData.connections,
          presets: blobData.presets?.length > 0 ? blobData.presets : localData.presets,
          settings: blobData.settings || localData.settings,
        };

        setLocalData(mergedData);
        console.log('[Storage Sync] Data pulled from cloud successfully');

        // If local had data that blob didn't, push it back
        if (
          (localData.connections.length > 0 && blobData.connections?.length === 0) ||
          (localData.presets.length > 0 && blobData.presets?.length === 0)
        ) {
          console.log('[Storage Sync] Pushing local data to cloud...');
          await pushToBlob(mergedData);
        }
      } else {
        // Blob is empty, push local data if we have any
        const localData = getLocalData();
        if (localData.connections.length > 0 || localData.presets.length > 0) {
          console.log('[Storage Sync] Cloud is empty, pushing local data...');
          await pushToBlob(localData);
        }
      }

      // Update last sync time
      localStorage.setItem(STORAGE_KEYS.lastSync, new Date().toISOString());
    }

    syncInitialized = true;
    console.log('[Storage Sync] Initialization complete');
  })();

  return initPromise;
}

// ============================================
// Trigger Push (Debounced)
// ============================================

export function triggerPush(): void {
  if (!blobConfigured || typeof window === 'undefined') return;

  // Clear existing timer
  if (pushDebounceTimer) {
    clearTimeout(pushDebounceTimer);
  }

  // Set new timer
  pushDebounceTimer = setTimeout(async () => {
    if (isSyncing) return;

    isSyncing = true;
    notifySyncListeners(true);
    console.log('[Storage Sync] Auto-pushing changes to cloud...');

    try {
      const localData = getLocalData();
      const success = await pushToBlob(localData);

      if (success) {
        localStorage.setItem(STORAGE_KEYS.lastSync, new Date().toISOString());
        console.log('[Storage Sync] Changes pushed to cloud');
      }
    } finally {
      isSyncing = false;
      notifySyncListeners(false);
    }
  }, PUSH_DEBOUNCE_MS);
}

// ============================================
// Get Sync Status
// ============================================

export function getSyncStatus(): SyncStatus {
  return {
    configured: blobConfigured ?? false,
    lastSync: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.lastSync) : null,
    syncing: isSyncing,
  };
}

// ============================================
// Check if Blob is Configured
// ============================================

export function isBlobConfigured(): boolean {
  return blobConfigured ?? false;
}

// ============================================
// Force Sync (Manual trigger)
// ============================================

export async function forceSync(direction: 'push' | 'pull'): Promise<boolean> {
  if (!blobConfigured) return false;

  isSyncing = true;

  try {
    if (direction === 'push') {
      const localData = getLocalData();
      const success = await pushToBlob(localData);
      if (success) {
        localStorage.setItem(STORAGE_KEYS.lastSync, new Date().toISOString());
      }
      return success;
    } else {
      const blobData = await pullFromBlob();
      if (blobData) {
        setLocalData(blobData);
        localStorage.setItem(STORAGE_KEYS.lastSync, new Date().toISOString());
        return true;
      }
      return false;
    }
  } finally {
    isSyncing = false;
  }
}
