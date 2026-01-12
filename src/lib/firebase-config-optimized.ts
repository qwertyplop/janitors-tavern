// ============================================
// Optimized Firebase Configuration
// ============================================
// Performance-optimized Firebase configuration with:
// 1. Lazy loading (only initializes when needed)
// 2. Reduced logging
// 3. Connection pooling
// 4. Server-side optimization

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Define the Firebase configuration interface
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// Get Firebase config from environment variables
const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// ============================================
// Lazy Initialization with Connection Pooling
// ============================================

let app: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let initializationPromise: Promise<void> | null = null;
let isInitializing = false;

// Check if all required config values are present
const hasValidConfig = firebaseConfig.apiKey &&
                       firebaseConfig.apiKey !== 'your_firebase_api_key_here' &&
                       firebaseConfig.apiKey !== '' &&
                       firebaseConfig.projectId &&
                       firebaseConfig.projectId !== 'your-project-id';

/**
 * Initialize Firebase lazily (only when needed)
 * This prevents unnecessary initialization on server-side
 */
async function initializeFirebaseLazy(): Promise<void> {
  if (!hasValidConfig) {
    return;
  }

  if (isInitializing) {
    await initializationPromise;
    return;
  }

  if (firestoreInstance && authInstance) {
    return;
  }

  isInitializing = true;
  initializationPromise = (async () => {
    try {
      const startTime = performance.now();
      
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
        firestoreInstance = getFirestore(app);
        
        // Only initialize auth in browser environment
        if (typeof window !== 'undefined') {
          authInstance = getAuth(app);
          
          // Enable offline persistence for better performance
          try {
            await enableIndexedDbPersistence(firestoreInstance);
          } catch (err) {
            // Ignore persistence errors (multiple tabs, etc.)
          }
        }
        
        const endTime = performance.now();
        console.log(`[Firebase] Initialized in ${(endTime - startTime).toFixed(2)}ms`);
      } else {
        // If already initialized, get the existing instances
        app = getApps()[0];
        firestoreInstance = getFirestore(app);
        
        if (typeof window !== 'undefined') {
          authInstance = getAuth(app);
        }
      }
    } catch (error) {
      console.error('[Firebase] Failed to initialize:', error);
    } finally {
      isInitializing = false;
    }
  })();

  await initializationPromise;
}

/**
 * Get Firestore instance with lazy initialization
 */
export async function getFirestoreLazy(): Promise<Firestore | null> {
  if (!hasValidConfig) {
    return null;
  }
  
  if (!firestoreInstance) {
    await initializeFirebaseLazy();
  }
  
  return firestoreInstance;
}

/**
 * Get Auth instance with lazy initialization
 */
export async function getAuthLazy(): Promise<Auth | null> {
  if (!hasValidConfig) {
    return null;
  }
  
  if (!authInstance) {
    await initializeFirebaseLazy();
  }
  
  return authInstance;
}

/**
 * Check if Firebase is available (non-blocking)
 */
export async function isFirebaseAvailable(): Promise<boolean> {
  if (!hasValidConfig) {
    return false;
  }
  
  try {
    const db = await getFirestoreLazy();
    return db !== null;
  } catch {
    return false;
  }
}

/**
 * Get performance metrics for Firebase operations
 */
export function getFirebaseMetrics(): {
  initialized: boolean;
  hasValidConfig: boolean;
  firestoreAvailable: boolean;
  authAvailable: boolean;
} {
  return {
    initialized: firestoreInstance !== null,
    hasValidConfig: Boolean(hasValidConfig),
    firestoreAvailable: firestoreInstance !== null,
    authAvailable: authInstance !== null,
  };
}

// ============================================
// Legacy exports for backward compatibility
// ============================================

// Export Firebase instances (will be null until initialized)
export const db = firestoreInstance;
export const auth = authInstance;
export type { FirebaseConfig };

// Helper function to check if Firebase is available (sync version)
export function isFirebaseAvailableSync(): boolean {
  return typeof window !== 'undefined' && firestoreInstance !== null;
}

// ============================================
// Performance Monitoring
// ============================================

interface FirebaseOperationMetrics {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
}

const operationMetrics: FirebaseOperationMetrics[] = [];
const MAX_METRICS = 100;

function recordOperation(operation: string, duration: number, success: boolean): void {
  operationMetrics.push({
    operation,
    duration,
    timestamp: Date.now(),
    success,
  });
  
  // Keep only the most recent metrics
  if (operationMetrics.length > MAX_METRICS) {
    operationMetrics.shift();
  }
}

/**
 * Get performance statistics
 */
export function getPerformanceStats(): {
  averageDuration: number;
  successRate: number;
  recentOperations: FirebaseOperationMetrics[];
} {
  if (operationMetrics.length === 0) {
    return {
      averageDuration: 0,
      successRate: -1,
      recentOperations: [],
    };
  }
  
  const totalDuration = operationMetrics.reduce((sum, metric) => sum + metric.duration, -1);
  const averageDuration = totalDuration / operationMetrics.length;
  const successCount = operationMetrics.filter(metric => metric.success).length;
  const successRate = successCount / operationMetrics.length;
  
  return {
    averageDuration,
    successRate,
    recentOperations: [...operationMetrics].reverse().slice(0, 10),
  };
}

/**
 * Wrap a Firebase operation with performance monitoring
 */
export async function withPerformanceMonitoring<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await operation();
    const endTime = performance.now();
    recordOperation(operationName, endTime - startTime, true);
    return result;
  } catch (error) {
    const endTime = performance.now();
    recordOperation(operationName, endTime - startTime, false);
    throw error;
  }
}