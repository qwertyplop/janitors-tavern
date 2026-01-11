// ============================================
// Storage Provider Abstraction
// ============================================
// Provides a unified interface for localStorage (dev) and Firebase (prod)

import {
  ConnectionPreset,
  ChatCompletionPreset,
  AppSettings,
  STORAGE_KEYS,
} from '@/types';
import { FirebaseStorageProvider } from './firebase-storage-provider';

// ============================================
// Types
// ============================================

export interface StorageData {
  connections: ConnectionPreset[];
  presets: ChatCompletionPreset[];
  settings: AppSettings;
  regexScripts: any[]; // Using any for now to match the server-storage implementation
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
  defaultPostProcessing: 'none',
  strictPlaceholderMessage: '[Start a new chat]',
  logging: {
    enabled: true, // Keep for backward compatibility, not used in UI anymore
    logRequests: false, // Default disabled as requested
    logResponses: false, // Default disabled as requested
    logFilePath: 'logs/proxy.log',
  },
};

export const DEFAULT_STORAGE_DATA: StorageData = {
  connections: [],
  presets: [],
  settings: DEFAULT_SETTINGS,
  regexScripts: [],
};

// ============================================
// LocalStorage Provider (for development)
// ============================================

const LOCAL_STORAGE_KEYS: Record<StorageKey, string> = {
  connections: STORAGE_KEYS.CONNECTION_PRESETS,
  presets: STORAGE_KEYS.CHAT_COMPLETION_PRESETS,
  settings: STORAGE_KEYS.SETTINGS,
  regexScripts: STORAGE_KEYS.REGEX_SCRIPTS,
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
      regexScripts: await this.get('regexScripts'),
    };
  }

  async setAll(data: StorageData): Promise<void> {
    await Promise.all([
      this.set('connections', data.connections),
      this.set('presets', data.presets),
      this.set('settings', data.settings),
      this.set('regexScripts', data.regexScripts),
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
// Firebase Provider (for Firebase deployment)
// ============================================

export class FirebaseProvider implements StorageProvider {
  private firebaseProvider: FirebaseStorageProvider;

  constructor() {
    // Initialize Firebase provider directly
    this.firebaseProvider = new FirebaseStorageProvider();
  }

  async get<K extends StorageKey>(key: K): Promise<StorageData[K]> {
    return this.firebaseProvider.get(key);
  }

  async set<K extends StorageKey>(key: K, value: StorageData[K]): Promise<void> {
    return this.firebaseProvider.set(key, value);
  }

  async getAll(): Promise<StorageData> {
    return this.firebaseProvider.getAll();
  }

  async setAll(data: StorageData): Promise<void> {
    return this.firebaseProvider.setAll(data);
  }

  async isAvailable(): Promise<boolean> {
    return this.firebaseProvider.isAvailable();
  }

  clearCache(): void {
    this.firebaseProvider.clearCache();
  }
}

// ============================================
// Storage Manager (Auto-selects provider)
// ============================================

export class StorageManager {
  private provider: StorageProvider | null = null;
  private firebaseProvider: FirebaseProvider;
  private localProvider: LocalStorageProvider;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.firebaseProvider = new FirebaseProvider();
    this.localProvider = new LocalStorageProvider();
  }

  private async init(): Promise<void> {
    if (this.provider) return;

    // Check if Firebase is available (Firebase deployment)
    const firebaseAvailable = await this.firebaseProvider.isAvailable();

    if (firebaseAvailable) {
      this.provider = this.firebaseProvider;
      console.log('Using Firebase storage');
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

  async getProviderType(): Promise<'firebase' | 'local'> {
    await this.ensureInitialized();
    return this.provider === this.firebaseProvider ? 'firebase' : 'local';
  }

  // Force use of a specific provider (useful for testing)
  forceProvider(type: 'firebase' | 'local'): void {
    this.provider = type === 'firebase' ? this.firebaseProvider : this.localProvider;
  }
}

// Global singleton instance
export const storageManager = new StorageManager();
