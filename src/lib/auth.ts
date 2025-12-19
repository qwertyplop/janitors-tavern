// This file provides authentication functions that work with Firestore and session cookies
// Authentication data is stored in Firestore and session state is maintained via cookies

// Define auth-related types
export interface AuthSettings {
  isAuthenticated: boolean;
  username?: string;
  passwordHash?: string;
  janitorApiKey?: string;
}

// Session cookie configuration
const SESSION_COOKIE_NAME = 'janitor_session';
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Set session cookie after successful authentication
 */
export function setSessionCookie(): void {
  if (typeof window === 'undefined') {
    return; // Only run on client-side
  }
  
  // Generate a simple session token (in production, use a more secure method)
  const sessionToken = generateApiKey();
  const expires = new Date();
  expires.setDate(expires.getDate() + 7); // 7 days from now
  
  document.cookie = `${SESSION_COOKIE_NAME}=${sessionToken}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

/**
 * Clear session cookie on logout
 */
export function clearSessionCookie(): void {
  if (typeof window === 'undefined') {
    return; // Only run on client-side
  }
  
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

/**
 * Check if session cookie exists
 */
export function hasSessionCookie(): boolean {
  if (typeof window === 'undefined') {
    return false; // Only run on client-side
  }
  
  return document.cookie.split(';').some(cookie =>
    cookie.trim().startsWith(`${SESSION_COOKIE_NAME}=`)
  );
}

/**
 * Get auth settings from Firestore
 * This function only works in client-side environments
 */
export async function getAuthSettings(): Promise<AuthSettings> {
  // Ensure we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('getAuthSettings can only be called in client-side environments');
  }

  try {
    // Import Firebase functions dynamically
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');

    // Check if Firebase is available
    if (!db) {
      throw new Error('Firebase Firestore is not initialized');
    }

    const authDoc = await getDoc(doc(db, 'system', 'auth'));

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
 * Save auth settings to Firestore
 * This function only works in client-side environments
 */
export async function saveAuthSettings(settings: AuthSettings): Promise<void> {
  // Ensure we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('saveAuthSettings can only be called in client-side environments');
  }

  try {
    // Import Firebase functions dynamically
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');

    // Check if Firebase is available
    if (!db) {
      throw new Error('Firebase Firestore is not initialized');
    }

    await setDoc(doc(db, 'system', 'auth'), settings);
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
 * Creates initial Firestore document with default values
 */
export async function initializeAuthSettings(): Promise<void> {
  // Ensure we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('initializeAuthSettings can only be called in client-side environments');
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
        throw new Error('Firebase Firestore is not initialized');
      }

      await setDoc(doc(db, 'system', 'auth'), settingsToSave);
    } catch (error) {
      console.error('Error initializing auth settings in Firestore:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }
}

/**
 * Set up authentication with username and password
 * Creates auth document in Firestore
 */
export async function setupAuth(username: string, password: string): Promise<void> {
  // Ensure we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('setupAuth can only be called in client-side environments');
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
      throw new Error('Firebase Firestore is not initialized');
    }

    await setDoc(doc(db, 'system', 'auth'), authSettings);
  } catch (error) {
    console.error('Error saving auth settings to Firestore:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

/**
 * Update the JanitorAI API key
 * Updates Firestore document with new API key
 */
export async function updateJanitorApiKey(): Promise<string> {
  // Ensure we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('updateJanitorApiKey can only be called in client-side environments');
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
      throw new Error('Firebase Firestore is not initialized');
    }

    await setDoc(doc(db, 'system', 'auth'), updatedSettings);
  } catch (error) {
    console.error('Error saving auth settings to Firestore:', error);
    throw error; // Re-throw the error to be handled by the caller
  }

  return newApiKey;
}

/**
 * Clear authentication
 * Clears Firestore document
 */
export async function clearAuth(): Promise<void> {
  // Ensure we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('clearAuth can only be called in client-side environments');
  }

  // Clearing authentication settings
  const settingsToSave: AuthSettings = { isAuthenticated: false };

  try {
    // Import Firebase functions dynamically
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');

    // Check if Firebase is available
    if (!db) {
      throw new Error('Firebase Firestore is not initialized');
    }

    await setDoc(doc(db, 'system', 'auth'), settingsToSave);
  } catch (error) {
    console.error('Error clearing auth settings in Firestore:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}