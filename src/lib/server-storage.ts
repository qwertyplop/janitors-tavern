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
    
    // Handle regex scripts specifically to add default values for backward compatibility
    if (key === 'regexScripts' && Array.isArray(data)) {
      const scripts = data as any[];
      const processedData = scripts.map((script: any) => {
        // Ensure all required fields have default values
        return {
          ...script,
          roles: script.roles || ['assistant', 'user'],
          disabled: script.disabled ?? false,
          markdownOnly: script.markdownOnly ?? false,
          runOnEdit: script.runOnEdit ?? false,
          substituteRegex: script.substituteRegex ?? 0,
          minDepth: script.minDepth ?? null,
          maxDepth: script.maxDepth ?? null,
          order: script.order ?? 0,
        };
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
    strictPlaceholderMessage: '[Start a new chat]',
    logging: {
      enabled: true, // Keep for backward compatibility, not used in UI anymore
      logRequests: false, // Default disabled as requested
      logResponses: false, // Default disabled as requested
    },
  };
  const settings = await fetchFirebaseJson<AppSettings>('settings', defaultSettings);
  console.log('[ServerStorage] getServerSettings() returned:', JSON.stringify(settings, null, 2));
  console.log('[ServerStorage] defaultPostProcessing value:', settings.defaultPostProcessing);
  return settings;
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
  const standaloneScripts = await fetchFirebaseJson<RegexScript[]>('regexScripts', []);
  
  // Also get preset-specific regex scripts
  const presets = await getServerChatCompletionPresets();
  const presetScripts: RegexScript[] = [];
  
  presets.forEach(preset => {
    if (preset.regexScripts && preset.regexScripts.length > 0) {
      preset.regexScripts.forEach(script => {
        // Add preset reference to each script for identification
        const scriptWithPreset = {
          ...script,
          _presetId: preset.id,
          _presetName: preset.name,
        };
        presetScripts.push(scriptWithPreset);
      });
    }
  });
  
  // Combine standalone and preset scripts
  const allScripts = [...standaloneScripts, ...presetScripts];
  
  // Filter out disabled scripts
  const enabledScripts = allScripts.filter(script => !script.disabled);
  
  console.log(`[ServerStorage] getServerRegexScripts() returned ${enabledScripts.length} enabled scripts (${allScripts.length} total, ${standaloneScripts.length} standalone, ${presetScripts.length} preset)`);
  return enabledScripts;
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
