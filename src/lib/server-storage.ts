// ============================================
// Server-Side Storage Reader
// ============================================
// Reads presets and settings from Vercel Blob storage for server-side use (API routes)
// Includes in-memory caching to minimize blob operations

import { head } from '@vercel/blob';
import { ConnectionPreset, ChatCompletionPreset, AppSettings, Extension, ExtensionsPipeline } from '@/types';

const STORAGE_PREFIX = 'janitors-tavern/';

// ============================================
// In-Memory Cache (reduces blob operations drastically)
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 60000; // 1 minute - balances freshness vs blob operations

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Call this when data is updated via UI to invalidate cache
export function invalidateCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// ============================================
// Blob Fetchers
// ============================================

async function fetchBlobJson<T>(key: string, defaultValue: T): Promise<T> {
  // Check cache first - avoids blob operations entirely
  const cached = getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return defaultValue;
  }

  try {
    const blobPath = `${STORAGE_PREFIX}${key}.json`;
    const blobInfo = await head(blobPath);
    if (blobInfo) {
      const response = await fetch(blobInfo.url);
      const data = await response.json();
      setCache(key, data);
      return data;
    }
  } catch {
    // Blob doesn't exist or error
  }

  setCache(key, defaultValue);
  return defaultValue;
}

// ============================================
// Public Functions
// ============================================

export async function getServerSettings(): Promise<AppSettings> {
  const defaultSettings: AppSettings = {
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
  return fetchBlobJson<AppSettings>('settings', defaultSettings);
}

export async function getServerConnectionPresets(): Promise<ConnectionPreset[]> {
  return fetchBlobJson<ConnectionPreset[]>('connections', []);
}

export async function getServerChatCompletionPresets(): Promise<ChatCompletionPreset[]> {
  return fetchBlobJson<ChatCompletionPreset[]>('presets', []);
}

export async function getServerConnectionPreset(id: string): Promise<ConnectionPreset | null> {
  const presets = await getServerConnectionPresets();
  return presets.find(p => p.id === id) || null;
}

export async function getServerChatCompletionPreset(id: string): Promise<ChatCompletionPreset | null> {
  const presets = await getServerChatCompletionPresets();
  return presets.find(p => p.id === id) || null;
}

// ============================================
// Get Default Presets
// ============================================

export async function getDefaultConnectionPreset(): Promise<ConnectionPreset | null> {
  const settings = await getServerSettings();
  if (!settings.defaultConnectionId) {
    // No default set, try to get the first available
    const presets = await getServerConnectionPresets();
    return presets.length > 0 ? presets[0] : null;
  }
  return getServerConnectionPreset(settings.defaultConnectionId);
}

export async function getDefaultChatCompletionPreset(): Promise<ChatCompletionPreset | null> {
  const settings = await getServerSettings();
  if (!settings.defaultChatCompletionPresetId) {
    // No default set, try to get the first available
    const presets = await getServerChatCompletionPresets();
    return presets.length > 0 ? presets[0] : null;
  }
  return getServerChatCompletionPreset(settings.defaultChatCompletionPresetId);
}

// ============================================
// Extensions Storage
// ============================================

export async function getServerExtensions(): Promise<Extension[]> {
  return fetchBlobJson<Extension[]>('extensions', []);
}

export async function getServerExtensionsPipelines(): Promise<ExtensionsPipeline[]> {
  return fetchBlobJson<ExtensionsPipeline[]>('extensions-pipelines', []);
}

export async function getExtensionById(id: string): Promise<Extension | null> {
  const extensions = await getServerExtensions();
  return extensions.find(e => e.id === id) || null;
}

export async function getExtensionsPipeline(id: string): Promise<ExtensionsPipeline | null> {
  const pipelines = await getServerExtensionsPipelines();
  return pipelines.find(p => p.id === id) || null;
}
