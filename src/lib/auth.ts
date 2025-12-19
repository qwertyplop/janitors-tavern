// This file provides authentication functions that work in both client and server contexts
// For client-side: Uses Firebase Firestore for storage
// For server-side: Uses environment variables as fallback when Firebase is not available

import { isFirebaseAvailable } from './firebase-config';

// Define auth-related types
export interface AuthSettings {
  isAuthenticated: boolean;
  username?: string;
  passwordHash?: string;
  janitorApiKey?: string;
}

/**
 * Get auth settings
 * Client-side: Reads from Firestore
 * Server-side: Falls back to environment variables
 */
export async function getAuthSettings(): Promise<AuthSettings> {
  // Check if we're in a server environment
  if (typeof window === 'undefined') {
    // Server-side fallback using environment variables
    const isAuthenticated = process.env.AUTH_IS_SETUP === 'true';
    const username = process.env.AUTH_USERNAME;
    const janitorApiKey = process.env.JANITOR_API_KEY;

    return {
      isAuthenticated,
      username,
      janitorApiKey,
      // Note: In server-side fallback, we don't store password hashes
      // Authentication is handled via API keys in this case
    };
  }

  // Client-side: use Firestore
  try {
    // Import Firebase functions dynamically
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');

    // Check if Firebase is available
    if (!db) {
      return { isAuthenticated: false };
    }

    const authDoc = await getDoc(doc(db as any, 'system', 'auth'));

    if (authDoc.exists()) {
      const data = authDoc.data();
      const authSettings: AuthSettings = {
        isAuthenticated: data.isAuthenticated || false,
        username: data.username,
        passwordHash: data.passwordHash,
        janitorApiKey: data.janitorApiKey
      };
      return authSettings;
    } else {
      // If no auth document exists, return default
      return { isAuthenticated: false };
    }
  } catch (error) {
    console.error('Error fetching auth settings from Firestore:', error);
    // Return default settings if there's an error
    return { isAuthenticated: false };
  }
}

/**
 * Save auth settings
 * Client-side: Saves to Firestore
 * Server-side: Throws error (auth should be managed via environment variables)
 */
export async function saveAuthSettings(settings: AuthSettings): Promise<void> {
  // In server-side environments, auth should be managed via environment variables
  if (typeof window === 'undefined') {
    throw new Error('Cannot save auth settings in server-side environment. Use environment variables instead.');
  }

  try {
    // Import Firebase functions dynamically
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');

    // Check if Firebase is available
    if (!db) {
      throw new Error('Firebase Firestore is not available');
    }

    await setDoc(doc(db as any, 'system', 'auth'), settings);
  } catch (error) {
    console.error('Error saving auth settings to Firestore:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

// Hash password using Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify password against hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Generate a random API key
export function generateApiKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Initialize auth settings if they don't exist
 * Client-side: Creates initial Firestore document
 * Server-side: No-op (auth should be managed via environment variables)
 */
export async function initializeAuthSettings(): Promise<void> {
  // In server-side environments, auth should be managed via environment variables
  if (typeof window === 'undefined') {
    return; // No-op for server-side
  }

  const authSettings = await getAuthSettings();
  if (!authSettings.isAuthenticated) {
    // Set default auth settings
    const settingsToSave: AuthSettings = {
      isAuthenticated: false,
      janitorApiKey: undefined
    };

    try {
      // Import Firebase functions dynamically
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase-config');

      // Check if Firebase is available
      if (!db) {
        throw new Error('Firebase Firestore is not available');
      }

      await setDoc(doc(db as any, 'system', 'auth'), settingsToSave);
    } catch (error) {
      console.error('Error initializing auth settings in Firestore:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }
}

/**
 * Set up authentication with username and password
 * Client-side: Creates auth document in Firestore
 * Server-side: Throws error (auth should be managed via environment variables)
 */
export async function setupAuth(username: string, password: string): Promise<void> {
  // In server-side environments, auth should be managed via environment variables
  if (typeof window === 'undefined') {
    throw new Error('Cannot set up authentication in server-side environment. Use environment variables instead.');
  }

  const passwordHash = await hashPassword(password);
  const apiKey = generateApiKey();
  const authSettings: AuthSettings = {
    isAuthenticated: true,
    username,
    passwordHash,
    janitorApiKey: apiKey
  };

  try {
    // Import Firebase functions dynamically
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');

    // Check if Firebase is available
    if (!db) {
      throw new Error('Firebase Firestore is not available');
    }

    await setDoc(doc(db as any, 'system', 'auth'), authSettings);
  } catch (error) {
    console.error('Error saving auth settings to Firestore:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

/**
 * Update the JanitorAI API key
 * Client-side: Updates Firestore document
 * Server-side: Throws error (auth should be managed via environment variables)
 */
export async function updateJanitorApiKey(): Promise<string> {
  // In server-side environments, auth should be managed via environment variables
  if (typeof window === 'undefined') {
    throw new Error('Cannot update API key in server-side environment. Use environment variables instead.');
  }

  const authSettings = await getAuthSettings();
  const newApiKey = generateApiKey();

  const updatedSettings: AuthSettings = {
    ...authSettings,
    janitorApiKey: newApiKey
  };

  try {
    // Import Firebase functions dynamically
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');

    // Check if Firebase is available
    if (!db) {
      throw new Error('Firebase Firestore is not available');
    }

    await setDoc(doc(db as any, 'system', 'auth'), updatedSettings);
  } catch (error) {
    console.error('Error saving auth settings to Firestore:', error);
    throw error; // Re-throw the error to be handled by the caller
  }

  return newApiKey;
}

/**
 * Clear authentication
 * Client-side: Clears Firestore document
 * Server-side: Throws error (auth should be managed via environment variables)
 */
export async function clearAuth(): Promise<void> {
  // In server-side environments, auth should be managed via environment variables
  if (typeof window === 'undefined') {
    throw new Error('Cannot clear authentication in server-side environment. Use environment variables instead.');
  }

  // Clearing authentication settings
  const settingsToSave: AuthSettings = { isAuthenticated: false };

  try {
    // Import Firebase functions dynamically
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');

    // Check if Firebase is available
    if (!db) {
      throw new Error('Firebase Firestore is not available');
    }

    await setDoc(doc(db as any, 'system', 'auth'), settingsToSave);
  } catch (error) {
    console.error('Error clearing auth settings in Firestore:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}