// ============================================
// Firebase Storage Provider
// ============================================
// Implements the StorageProvider interface using Firebase Firestore
// This replaces the local storage provider with Firebase

import {
  ConnectionPreset,
  ChatCompletionPreset,
  AppSettings,
  STORAGE_KEYS,
} from '@/types';
import { db } from './firebase-config';
import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

// ============================================
// Types
// ============================================

import { RegexScript } from '@/types';

export interface StorageData {
  connections: ConnectionPreset[];
  presets: ChatCompletionPreset[];
  settings: AppSettings;
  regexScripts: RegexScript[];
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
  regexScripts: [],
};

// ============================================
// Firebase Storage Provider Implementation
// ============================================

export class FirebaseStorageProvider implements StorageProvider {
  private userId: string | null = null;
  private cache: Partial<StorageData> = {};
  private cacheTimestamps: Map<string, number> = new Map();
  private CACHE_TTL = 30000; // 30 seconds cache TTL

  constructor(userId?: string) {
    this.userId = userId || this.getCurrentUserId();
  }

  private getCurrentUserId(): string {
    // In a real implementation, this would come from authentication
    // For now, we'll use a placeholder
    if (typeof window !== 'undefined' && window.localStorage) {
      let userId = localStorage.getItem('firebase_user_id');
      if (!userId) {
        userId = 'anonymous_user'; // In a real app, this would be handled by auth
        localStorage.setItem('firebase_user_id', userId);
      }
      return userId;
    }
    return 'anonymous_server'; // For server-side rendering
  }

  private getCacheKey(key: StorageKey): string {
    return `${this.userId}:${key}`;
  }

  private isCacheValid(key: StorageKey): boolean {
    const cacheKey = this.getCacheKey(key);
    const timestamp = this.cacheTimestamps.get(cacheKey);
    return timestamp !== undefined && (Date.now() - timestamp) < this.CACHE_TTL;
  }

  private getCached<K extends StorageKey>(key: K): StorageData[K] | null {
    if (this.isCacheValid(key) && this.cache[key] !== undefined) {
      return this.cache[key] as StorageData[K];
    }
    return null;
  }

  private setCached<K extends StorageKey>(key: K, value: StorageData[K]): void {
    this.cache[key] = value;
    const cacheKey = this.getCacheKey(key);
    this.cacheTimestamps.set(cacheKey, Date.now());
  }

  private getFirestoreDocPath(key: StorageKey): string {
    // In a real implementation, we'd have user-specific paths
    // For now, using a generic path structure
    return `users/${this.userId}/storage/${key}`;
  }

  async get<K extends StorageKey>(key: K): Promise<StorageData[K]> {
    // Check cache first
    const cached = this.getCached<K>(key);
    if (cached !== null) {
      console.log(`[FirebaseStorage] Cache hit for ${key}`);
      return cached;
    }

    try {
      const docPath = this.getFirestoreDocPath(key);
      const docRef = doc(db, docPath);
      const docSnap = await getDoc(docRef);

      let data: StorageData[K];
      if (docSnap.exists()) {
        const docData = docSnap.data();
        data = docData[key] as StorageData[K];
        console.log(`[FirebaseStorage] Retrieved ${key} from Firestore, count: ${Array.isArray(data) ? data.length : 'N/A'}`);
      } else {
        // Return default value if document doesn't exist
        data = DEFAULT_STORAGE_DATA[key];
        console.log(`[FirebaseStorage] Document for ${key} not found, returning default`);
      }

      // Cache the result
      this.setCached<K>(key, data);
      return data;
    } catch (error) {
      console.error(`[FirebaseStorage] Error fetching ${key} from Firestore:`, error);
      return DEFAULT_STORAGE_DATA[key];
    }
  }

  async set<K extends StorageKey>(key: K, value: StorageData[K]): Promise<void> {
    try {
      const docPath = this.getFirestoreDocPath(key);
      const docRef = doc(db, docPath);
      
      // Update only the specific key field in the document
      await setDoc(docRef, { [key]: value }, { merge: true });
      
      // Update cache
      this.setCached<K>(key, value);
      console.log(`[FirebaseStorage] Saved ${key} to Firestore`);
    } catch (error) {
      console.error(`[FirebaseStorage] Error saving ${key} to Firestore:`, error);
      throw error;
    }
  }

  async getAll(): Promise<StorageData> {
    try {
      // Get all storage keys in a single operation
      const result: StorageData = {
        connections: await this.get('connections'),
        presets: await this.get('presets'),
        settings: await this.get('settings'),
        regexScripts: await this.get('regexScripts'),
      };
      
      return result;
    } catch (error) {
      console.error('[FirebaseStorage] Error fetching all data from Firestore:', error);
      return DEFAULT_STORAGE_DATA;
    }
  }

  async setAll(data: StorageData): Promise<void> {
    try {
      // Use a batch write to update all storage keys in a single operation
      const batch = writeBatch(db);
      
      const keys: StorageKey[] = ['connections', 'presets', 'settings', 'regexScripts'];
      
      for (const key of keys) {
        if (data[key] !== undefined) {
          const docPath = this.getFirestoreDocPath(key);
          const docRef = doc(db, docPath);
          batch.set(docRef, { [key]: data[key] }, { merge: true });
        }
      }
      
      await batch.commit();
      
      // Update cache
      Object.assign(this.cache, data);
      const now = Date.now();
      keys.forEach(key => {
        this.cacheTimestamps.set(this.getCacheKey(key), now);
      });
      
      console.log('[FirebaseStorage] Saved all data to Firestore');
    } catch (error) {
      console.error('[FirebaseStorage] Error saving all data to Firestore:', error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test Firestore availability by attempting to read from a known path
      const testDocPath = `users/${this.userId}/storage/test`;
      const docRef = doc(db, testDocPath);
      await getDoc(docRef);
      return true;
    } catch {
      return false;
    }
  }

  clearCache(): void {
    this.cache = {};
    this.cacheTimestamps.clear();
  }
}