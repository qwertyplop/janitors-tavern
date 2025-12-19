// ============================================
// Firebase Configuration
// ============================================
// Firebase configuration for the application
// This file contains the Firebase configuration and initialization

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

// Initialize Firebase only if not already initialized
let app;
let firestoreInstance: Firestore;
let authInstance: Auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  firestoreInstance = getFirestore(app);
  authInstance = getAuth(app);
} else {
  // If already initialized, get the existing instances
  app = getApps()[0];
  firestoreInstance = getFirestore(app);
  authInstance = getAuth(app);
}

export { firestoreInstance as db, authInstance as auth };
export type { FirebaseConfig };