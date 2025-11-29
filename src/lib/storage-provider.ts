// ============================================
// Storage Provider Abstraction
// ============================================
// Provides a unified interface for localStorage (dev) and Vercel Blob (prod)

import {
  ConnectionPreset,
  ChatCompletionPreset,
  AppSettings,
  STORAGE_KEYS,
} from '@/types';

// ============================================
// Types
// ============================================

export interface StorageData {
  connections: ConnectionPreset[];
  presets: ChatCompletionPreset[];
  settings: AppSettings;
}

export type StorageKey = keyof StorageData;

export interface StorageProvider {
  get<K extends StorageKey>(key: K): Promise<StorageData[K]>;
  set<K extends StorageKey>(key: K, value: StorageData[K]): Promise<void>;
  getAll(): Promise<StorageData>;
  setAll(data: StorageData): Promise<void>;
  isAvailable(): Promise<boolean>;
}

// ============================================
// Default Values
// ============================================

export const DEFAULT_SETTINGS: AppSettings = {
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

export const DEFAULT_STORAGE_DATA: StorageData = {
  connections: [],
  presets: [],
  settings: DEFAULT_SETTINGS,
};

// ============================================
// LocalStorage Provider (for development)
// ============================================

const LOCAL_STORAGE_KEYS: Record<StorageKey, string> = {
  connections: STORAGE_KEYS.CONNECTION_PRESETS,
  presets: STORAGE_KEYS.CHAT_COMPLETION_PRESETS,
  settings: STORAGE_KEYS.SETTINGS,
};

export class LocalStorageProvider implements StorageProvider {
  async get<K extends StorageKey>(key: K): Promise<StorageData[K]> {
    if (typeof window === 'undefined') {
      return DEFAULT_STORAGE_DATA[key];
    }

    try {
      const item = localStorage.getItem(LOCAL_STORAGE_KEYS[key]);
      if (!item) return DEFAULT_STORAGE_DATA[key];
      return JSON.parse(item);
    } catch {
      return DEFAULT_STORAGE_DATA[key];
    }
  }

  async set<K extends StorageKey>(key: K, value: StorageData[K]): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS[key], JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save to localStorage: ${key}`, error);
    }
  }

  async getAll(): Promise<StorageData> {
    return {
      connections: await this.get('connections'),
      presets: await this.get('presets'),
      settings: await this.get('settings'),
    };
  }

  async setAll(data: StorageData): Promise<void> {
    await Promise.all([
      this.set('connections', data.connections),
      this.set('presets', data.presets),
      this.set('settings', data.settings),
    ]);
  }

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================
// Blob API Provider (for Vercel deployment)
// ============================================

export class BlobApiProvider implements StorageProvider {
  private baseUrl: string;
  private cache: Partial<StorageData> = {};

  constructor(baseUrl: string = '/api/storage') {
    this.baseUrl = baseUrl;
  }

  async get<K extends StorageKey>(key: K): Promise<StorageData[K]> {
    // Return from cache if available
    if (this.cache[key] !== undefined) {
      return this.cache[key] as StorageData[K];
    }

    try {
      const response = await fetch(`${this.baseUrl}/${key}`);
      if (!response.ok) {
        if (response.status === 404) {
          return DEFAULT_STORAGE_DATA[key];
        }
        throw new Error(`Failed to fetch ${key}: ${response.statusText}`);
      }
      const data = await response.json();
      this.cache[key] = data;
      return data;
    } catch (error) {
      console.error(`Failed to fetch ${key} from blob:`, error);
      return DEFAULT_STORAGE_DATA[key];
    }
  }

  async set<K extends StorageKey>(key: K, value: StorageData[K]): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });

      if (!response.ok) {
        throw new Error(`Failed to save ${key}: ${response.statusText}`);
      }

      // Update cache
      this.cache[key] = value;
    } catch (error) {
      console.error(`Failed to save ${key} to blob:`, error);
      throw error;
    }
  }

  async getAll(): Promise<StorageData> {
    try {
      const response = await fetch(`${this.baseUrl}/all`);
      if (!response.ok) {
        if (response.status === 404) {
          return DEFAULT_STORAGE_DATA;
        }
        throw new Error(`Failed to fetch all data: ${response.statusText}`);
      }
      const data = await response.json();
      this.cache = data;
      return data;
    } catch (error) {
      console.error('Failed to fetch all data from blob:', error);
      return DEFAULT_STORAGE_DATA;
    }
  }

  async setAll(data: StorageData): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/all`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to save all data: ${response.statusText}`);
      }

      this.cache = data;
    } catch (error) {
      console.error('Failed to save all data to blob:', error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/status`);
      return response.ok;
    } catch {
      return false;
    }
  }

  clearCache(): void {
    this.cache = {};
  }
}

// ============================================
// Storage Manager (Auto-selects provider)
// ============================================

export class StorageManager {
  private provider: StorageProvider | null = null;
  private blobProvider: BlobApiProvider;
  private localProvider: LocalStorageProvider;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.blobProvider = new BlobApiProvider();
    this.localProvider = new LocalStorageProvider();
  }

  private async init(): Promise<void> {
    if (this.provider) return;

    // Check if Blob API is available (Vercel deployment)
    const blobAvailable = await this.blobProvider.isAvailable();

    if (blobAvailable) {
      this.provider = this.blobProvider;
      console.log('Using Vercel Blob storage');
    } else {
      this.provider = this.localProvider;
      console.log('Using localStorage');
    }
  }

  private async ensureInitialized(): Promise<StorageProvider> {
    if (!this.initPromise) {
      this.initPromise = this.init();
    }
    await this.initPromise;
    return this.provider!;
  }

  async get<K extends StorageKey>(key: K): Promise<StorageData[K]> {
    const provider = await this.ensureInitialized();
    return provider.get(key);
  }

  async set<K extends StorageKey>(key: K, value: StorageData[K]): Promise<void> {
    const provider = await this.ensureInitialized();
    return provider.set(key, value);
  }

  async getAll(): Promise<StorageData> {
    const provider = await this.ensureInitialized();
    return provider.getAll();
  }

  async setAll(data: StorageData): Promise<void> {
    const provider = await this.ensureInitialized();
    return provider.setAll(data);
  }

  async getProviderType(): Promise<'blob' | 'local'> {
    await this.ensureInitialized();
    return this.provider === this.blobProvider ? 'blob' : 'local';
  }

  // Force use of a specific provider (useful for testing)
  forceProvider(type: 'blob' | 'local'): void {
    this.provider = type === 'blob' ? this.blobProvider : this.localProvider;
  }
}

// Global singleton instance
export const storageManager = new StorageManager();
