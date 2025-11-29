// ============================================
// Server-Side Storage Reader
// ============================================
// Reads presets and settings from Vercel Blob storage for server-side use (API routes)

import { head } from '@vercel/blob';
import { ConnectionPreset, ChatCompletionPreset, AppSettings } from '@/types';

const STORAGE_PREFIX = 'janitors-tavern/';

// ============================================
// Blob Fetchers
// ============================================

async function fetchBlobJson<T>(key: string, defaultValue: T): Promise<T> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return defaultValue;
  }

  try {
    const blobPath = `${STORAGE_PREFIX}${key}.json`;
    const blobInfo = await head(blobPath);
    if (blobInfo) {
      const response = await fetch(blobInfo.url);
      return await response.json();
    }
  } catch {
    // Blob doesn't exist or error
  }
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
