// ============================================
// Firebase Configuration
// ============================================
// Firebase configuration for the application
// This file contains the Firebase configuration and initialization
// Note: Firebase is only initialized in client-side environments

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
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

// Initialize Firebase in both client and server environments
let app;
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;

// Check if all required config values are present
const hasValidConfig = firebaseConfig.apiKey &&
                       firebaseConfig.apiKey !== 'your_firebase_api_key_here' &&
                       firebaseConfig.apiKey !== '' &&
                       firebaseConfig.projectId &&
                       firebaseConfig.projectId !== 'your-project-id';

if (hasValidConfig) {
  try {
    if (getApps().length === 0) {
      console.log('[Firebase] Initializing Firebase with config:', {
        apiKey: firebaseConfig.apiKey ? '***' : 'MISSING',
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        environment: typeof window !== 'undefined' ? 'browser' : 'server'
      });
      
      app = initializeApp(firebaseConfig);
      firestoreInstance = getFirestore(app);
      
      // Only initialize auth in browser environment
      if (typeof window !== 'undefined') {
        authInstance = getAuth(app);
      }
      
      console.log('[Firebase] Firebase initialized successfully');
    } else {
      // If already initialized, get the existing instances
      app = getApps()[0];
      firestoreInstance = getFirestore(app);
      
      if (typeof window !== 'undefined') {
        authInstance = getAuth(app);
      }
      
      console.log('[Firebase] Using existing Firebase instance');
    }
  } catch (error) {
    console.error('[Firebase] Failed to initialize Firebase:', error);
  }
} else {
  console.warn('[Firebase] Firebase configuration is incomplete or uses placeholder values');
  console.warn('[Firebase] Config values:', {
    apiKey: firebaseConfig.apiKey ? '***' : 'MISSING',
    projectId: firebaseConfig.projectId || 'MISSING'
  });
}

// Export Firebase instances (will be null in server-side environments)
export const db = firestoreInstance;
export const auth = authInstance;
export type { FirebaseConfig };

// Helper function to check if Firebase is available
export function isFirebaseAvailable(): boolean {
  return typeof window !== 'undefined' && db !== null;
}