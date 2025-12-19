// This file provides authentication functions that work in both client and server contexts
// All functions are Edge Runtime compatible and use Firebase Firestore for storage

// Define auth-related types
export interface AuthSettings {
  isAuthenticated: boolean;
  username?: string;
  passwordHash?: string;
  janitorApiKey?: string;
}

/**
 * Get auth settings from Firestore
 * Works in both client and server contexts
 */
export async function getAuthSettings(): Promise<AuthSettings> {
  try {
    // Import Firebase functions dynamically to work in both environments
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');

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
 * Works in both client and server contexts
 */
export async function saveAuthSettings(settings: AuthSettings): Promise<void> {
  try {
    // Import Firebase functions dynamically to work in both environments
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');

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
 * Works in both client and server contexts
 */
export async function initializeAuthSettings(): Promise<void> {
  const authSettings = await getAuthSettings();
  if (!authSettings.isAuthenticated) {
    // Set default auth settings
    const settingsToSave: AuthSettings = {
      isAuthenticated: false,
      janitorApiKey: undefined
    };

    try {
      // Import Firebase functions dynamically to work in both environments
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase-config');

      await setDoc(doc(db, 'system', 'auth'), settingsToSave);
    } catch (error) {
      console.error('Error initializing auth settings in Firestore:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }
}

/**
 * Set up authentication with username and password
 * Works in both client and server contexts
 */
export async function setupAuth(username: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  const apiKey = generateApiKey();
  const authSettings: AuthSettings = {
    isAuthenticated: true,
    username,
    passwordHash,
    janitorApiKey: apiKey
  };

  try {
    // Import Firebase functions dynamically to work in both environments
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');

    await setDoc(doc(db, 'system', 'auth'), authSettings);
  } catch (error) {
    console.error('Error saving auth settings to Firestore:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

/**
 * Update the JanitorAI API key
 * Works in both client and server contexts
 */
export async function updateJanitorApiKey(): Promise<string> {
  const authSettings = await getAuthSettings();
  const newApiKey = generateApiKey();

  const updatedSettings: AuthSettings = {
    ...authSettings,
    janitorApiKey: newApiKey
  };

  try {
    // Import Firebase functions dynamically to work in both environments
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');

    await setDoc(doc(db, 'system', 'auth'), updatedSettings);
  } catch (error) {
    console.error('Error saving auth settings to Firestore:', error);
    throw error; // Re-throw the error to be handled by the caller
  }

  return newApiKey;
}

/**
 * Clear authentication
 * Works in both client and server contexts
 */
export async function clearAuth(): Promise<void> {
  // Clearing authentication settings
  const settingsToSave: AuthSettings = { isAuthenticated: false };

  try {
    // Import Firebase functions dynamically to work in both environments
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');

    await setDoc(doc(db, 'system', 'auth'), settingsToSave);
  } catch (error) {
    console.error('Error clearing auth settings in Firestore:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}