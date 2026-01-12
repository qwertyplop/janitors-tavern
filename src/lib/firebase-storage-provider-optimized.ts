// ============================================
// Optimized Firebase Storage Provider
// ============================================
// Performance-optimized implementation of StorageProvider using Firebase Firestore
// Key optimizations:
// 1. Enhanced caching with longer TTLs
// 2. Reduced console logging
// 3. Optimized batch operations
// 4. Improved data structure (single document for arrays)
// 5. Connection pooling via singleton

import {
  ConnectionPreset,
  ChatCompletionPreset,
  AppSettings,
  STORAGE_KEYS,
  RegexScript,
} from '@/types';
import { db } from './firebase-config';
import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
  collection,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';

// ============================================
// Types
// ============================================

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
  defaultPostProcessing: 'none',
  strictPlaceholderMessage: '[Start a new chat]',
  logging: {
    enabled: true,
    logRequests: false,
    logResponses: false,
  },
};

export const DEFAULT_STORAGE_DATA: StorageData = {
  connections: [],
  presets: [],
  settings: DEFAULT_SETTINGS,
  regexScripts: [],
};

// ============================================
// Performance Optimized Firebase Storage Provider
// ============================================

export class OptimizedFirebaseStorageProvider implements StorageProvider {
  private userId: string | null = null;
  private cache: Partial<StorageData> = {};
  private cacheTimestamps: Map<string, number> = new Map();
  private CACHE_TTL = 300000; // 5 minutes cache TTL (increased from 30s)
  private initialized: boolean = false;
  private performanceLogging: boolean = false;

  constructor(userId?: string, enablePerformanceLogging: boolean = false) {
    this.userId = userId || this.getCurrentUserId();
    this.performanceLogging = enablePerformanceLogging;
    if (this.performanceLogging) {
      console.log('[FirebaseStorage] Provider created with user ID:', this.userId);
    }
  }

  private getCurrentUserId(): string {
    // Use localStorage for client-side, fallback for server-side
    if (typeof window !== 'undefined' && window.localStorage) {
      let userId = localStorage.getItem('firebase_user_id');
      if (!userId) {
        userId = 'anonymous_user';
        localStorage.setItem('firebase_user_id', userId);
      }
      return userId;
    }
    return 'anonymous_server';
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
    // Store all data in a single document per user for better performance
    return `users/${this.userId}/storage`;
  }

  private async measurePerformance<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    if (!this.performanceLogging) {
      return fn();
    }

    const startTime = performance.now();
    try {
      const result = await fn();
      const endTime = performance.now();
      console.log(`[FirebasePerf] ${operation} took ${(endTime - startTime).toFixed(2)}ms`);
      return result;
    } catch (error) {
      const endTime = performance.now();
      console.error(`[FirebasePerf] ${operation} failed after ${(endTime - startTime).toFixed(2)}ms:`, error);
      throw error;
    }
  }

  async get<K extends StorageKey>(key: K): Promise<StorageData[K]> {
    // Check cache first (fast path)
    const cached = this.getCached<K>(key);
    if (cached !== null) {
      return cached;
    }

    // Check if Firebase is available
    if (!db) {
      return DEFAULT_STORAGE_DATA[key];
    }

    return this.measurePerformance(`get(${key})`, async () => {
      try {
        // Get the entire storage document once
        if (!db) {
          return DEFAULT_STORAGE_DATA[key];
        }
        
        const docPath = this.getFirestoreDocPath(key);
        const docRef = doc(db!, docPath);
        const docSnap = await getDoc(docRef);

        let data: StorageData[K];
        if (docSnap.exists()) {
          const docData = docSnap.data();
          data = docData[key] as StorageData[K];
        } else {
          // Return default value if document doesn't exist
          data = DEFAULT_STORAGE_DATA[key];
        }

        // Cache the result
        this.setCached<K>(key, data);
        return data;
      } catch (error) {
        return DEFAULT_STORAGE_DATA[key];
      }
    });
  }

  async set<K extends StorageKey>(key: K, value: StorageData[K]): Promise<void> {
    // Check if Firebase is available
    if (!db) {
      throw new Error('Firebase not available');
    }

    return this.measurePerformance(`set(${key})`, async () => {
      try {
        // Update only the specific key field in the document using merge
        if (!db) {
          throw new Error('Firebase not available');
        }
        
        const docPath = this.getFirestoreDocPath(key);
        const docRef = doc(db!, docPath);
        
        // Get existing document to preserve other fields
        const docSnap = await getDoc(docRef);
        const existingData = docSnap.exists() ? docSnap.data() : {};
        
        // Update only the specific field
        await setDoc(docRef, { ...existingData, [key]: value }, { merge: true });
        
        // Update cache
        this.setCached<K>(key, value);
      } catch (error) {
        throw error;
      }
    });
  }

  async getAll(): Promise<StorageData> {
    // Check if we have all data cached
    const allKeys: StorageKey[] = ['connections', 'presets', 'settings', 'regexScripts'];
    const allCached = allKeys.every(key => this.isCacheValid(key));
    
    if (allCached) {
      return {
        connections: this.cache.connections || DEFAULT_STORAGE_DATA.connections,
        presets: this.cache.presets || DEFAULT_STORAGE_DATA.presets,
        settings: this.cache.settings || DEFAULT_STORAGE_DATA.settings,
        regexScripts: this.cache.regexScripts || DEFAULT_STORAGE_DATA.regexScripts,
      };
    }

    return this.measurePerformance('getAll()', async () => {
      try {
        // Get the entire storage document in one operation
        const docPath = this.getFirestoreDocPath('settings');
        const docRef = doc(db!, docPath);
        const docSnap = await getDoc(docRef);

        let result: StorageData;
        if (docSnap.exists()) {
          const docData = docSnap.data();
          result = {
            connections: docData.connections || DEFAULT_STORAGE_DATA.connections,
            presets: docData.presets || DEFAULT_STORAGE_DATA.presets,
            settings: docData.settings || DEFAULT_STORAGE_DATA.settings,
            regexScripts: docData.regexScripts || DEFAULT_STORAGE_DATA.regexScripts,
          };
        } else {
          result = DEFAULT_STORAGE_DATA;
        }

        // Cache all results
        allKeys.forEach(key => {
          this.setCached(key, result[key]);
        });

        return result;
      } catch (error) {
        return DEFAULT_STORAGE_DATA;
      }
    });
  }

  async setAll(data: StorageData): Promise<void> {
    if (!db) {
      throw new Error('Firebase not available');
    }

    return this.measurePerformance('setAll()', async () => {
      try {
        // Use a single batch operation for all updates
        const docPath = this.getFirestoreDocPath('settings');
        const docRef = doc(db!, docPath);
        
        // Update all fields in one document
        await setDoc(docRef, data, { merge: true });
        
        // Update cache for all keys
        Object.keys(data).forEach(key => {
          this.setCached(key as StorageKey, data[key as StorageKey]);
        });
      } catch (error) {
        throw error;
      }
    });
  }

  private generateId(): string {
    // Generate a unique ID using timestamp and random number
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  async isAvailable(): Promise<boolean> {
    if (!db) {
      return false;
    }

    try {
      // Quick test without logging for performance
      const testDocPath = `users/${this.userId}/storage/test`;
      const docRef = doc(db!, testDocPath);
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

  // Performance monitoring methods
  getCacheStats(): { size: number; hitRate: number } {
    const totalGets = this.cacheTimestamps.size;
    const cacheHits = Array.from(this.cacheTimestamps.keys()).filter(key => 
      this.isCacheValid(key.split(':')[1] as StorageKey)
    ).length;
    
    return {
      size: Object.keys(this.cache).length,
      hitRate: totalGets > 0 ? cacheHits / totalGets : 0,
    };
  }

  // Adjust cache TTL dynamically based on usage patterns
  adjustCacheTTL(newTTL: number): void {
    this.CACHE_TTL = newTTL;
  }
}

// Singleton instance for connection pooling
let sharedInstance: OptimizedFirebaseStorageProvider | null = null;

export function getSharedFirebaseStorageProvider(userId?: string): OptimizedFirebaseStorageProvider {
  if (!sharedInstance) {
    sharedInstance = new OptimizedFirebaseStorageProvider(userId);
  }
  return sharedInstance;
}