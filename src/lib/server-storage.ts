// ============================================
// Server-Side Storage Reader
// ============================================
// Reads presets and settings from Firebase storage for server-side use (API routes)
// Includes in-memory caching to minimize Firebase operations

import { ConnectionPreset, ChatCompletionPreset, AppSettings, RegexScript } from '@/types';
import { storageManager } from './storage-provider';

// ============================================
// In-Memory Cache (reduces Firebase operations drastically)
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 60000; // 1 minute - balances freshness vs Firebase operations

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
// Firebase Fetchers
// ============================================

async function fetchFirebaseJson<T>(key: string, defaultValue: T): Promise<T> {
  // Check cache first - avoids Firebase operations entirely
  const cached = getCached<T>(key);
  if (cached !== null) {
    console.log(`[ServerStorage] Cache hit for ${key}`);
    return cached;
  }

  console.log(`[ServerStorage] Cache miss for ${key}, attempting to fetch from Firebase`);
  
  try {
    // Use the storage manager to get data from Firebase
    const data = await storageManager.get(key as any);
    
    // Handle regex scripts specifically to add default roles for backward compatibility
    if (key === 'regexScripts' && Array.isArray(data)) {
      const scripts = data as any[];
      const processedData = scripts.map((script: any) => {
        // If the script doesn't have roles, add the default ['assistant', 'user']
        if (!script.hasOwnProperty('roles')) {
          return { ...script, roles: ['assistant', 'user'] };
        }
        return script;
      });
      
      setCache(key, processedData);
      console.log(`[ServerStorage] Successfully fetched ${key} from Firebase, count: ${processedData.length}`);
      return processedData as any;
    }
    
    setCache(key, data);
    console.log(`[ServerStorage] Successfully fetched ${key} from Firebase, count: ${Array.isArray(data) ? data.length : 'N/A'}`);
    return data as any;
  } catch (error) {
    console.error(`[ServerStorage] Error fetching ${key} from Firebase:`, error);
    // Return default value if Firebase fails
  }

  setCache(key, defaultValue);
  console.log(`[ServerStorage] Returning default value for ${key}`);
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
    defaultPostProcessing: 'none',
    logging: {
      enabled: false,
      logRequests: true,
      logResponses: true,
      logFilePath: 'logs/proxy.log',
    },
  };
  return fetchFirebaseJson<AppSettings>('settings', defaultSettings);
}

export async function getServerConnectionPresets(): Promise<ConnectionPreset[]> {
  return fetchFirebaseJson<ConnectionPreset[]>('connections', []);
}

export async function getServerChatCompletionPresets(): Promise<ChatCompletionPreset[]> {
  return fetchFirebaseJson<ChatCompletionPreset[]>('presets', []);
}

export async function getServerConnectionPreset(id: string): Promise<ConnectionPreset | null> {
  const presets = await getServerConnectionPresets();
  return presets.find(p => p.id === id) || null;
}

export async function getServerChatCompletionPreset(id: string): Promise<ChatCompletionPreset | null> {
  const presets = await getServerChatCompletionPresets();
  return presets.find(p => p.id === id) || null;
}

export async function getServerRegexScripts(): Promise<RegexScript[]> {
  return fetchFirebaseJson<RegexScript[]>('regexScripts', []);
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
