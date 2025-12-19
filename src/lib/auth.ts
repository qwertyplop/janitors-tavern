// This file is for server-side authentication functions only
// It should not be imported by edge runtime components like middleware

import { promises as fs } from 'fs';
import path from 'path';

// Define auth-related types
export interface AuthSettings {
  isAuthenticated: boolean;
  username?: string;
  passwordHash?: string;
  janitorApiKey?: string;
}

// For serverless environments like Vercel, we'll use environment variables
// For traditional deployments, we'll use file-based storage
function getAuthSettingsPath(): string {
  return path.join(process.cwd(), 'data', 'auth-settings.json');
}

// Get auth settings from Firestore (server-side compatible)
export async function getAuthSettings(): Promise<AuthSettings> {
  // Check if we're in a browser environment (client-side)
  if (typeof window !== 'undefined') {
    try {
      // Import Firebase functions dynamically to avoid server-side issues
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
  } else {
    // Server-side execution - read from file
    // This is needed when the function is called from server-side code
    try {
      const { promises: fs } = await import('fs');
      const path = await import('path');
      
      const authSettingsPath = path.join(process.cwd(), 'data', 'auth-settings.json');
      const fileContent = await fs.readFile(authSettingsPath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      // If file doesn't exist or there's an error, return default
      return { isAuthenticated: false };
    }
  }
}

// Save auth settings to Firestore (server-side compatible)
export async function saveAuthSettings(settings: AuthSettings): Promise<void> {
  // Check if we're in a browser environment (client-side)
  if (typeof window !== 'undefined') {
    try {
      // Import Firebase functions dynamically to avoid server-side issues
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase-config');
      
      await setDoc(doc(db, 'system', 'auth'), settings);
    } catch (error) {
      console.error('Error saving auth settings to Firestore:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  } else {
    // Server-side execution - save to file
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    const authSettingsPath = path.join(process.cwd(), 'data', 'auth-settings.json');
    const dir = path.dirname(authSettingsPath);
    
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
    
    await fs.writeFile(authSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
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

// Initialize auth settings if they don't exist
export async function initializeAuthSettings(): Promise<void> {
  const authSettings = await getAuthSettings();
  if (!authSettings.isAuthenticated) {
    // Set default auth settings
    
    const settingsToSave: AuthSettings = {
      isAuthenticated: false,
      janitorApiKey: undefined
    };
    
    // Check if we're in a browser environment (client-side)
    if (typeof window !== 'undefined') {
      // In browser, save to Firestore
      try {
        // Import Firebase functions dynamically to avoid server-side issues
        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('./firebase-config');
        
        await setDoc(doc(db, 'system', 'auth'), settingsToSave);
      } catch (error) {
        console.error('Error initializing auth settings in Firestore:', error);
        throw error; // Re-throw the error to be handled by the caller
      }
    } else {
      // Server-side execution - save to file
      const { promises: fs } = await import('fs');
      const path = await import('path');
      
      const authSettingsPath = path.join(process.cwd(), 'data', 'auth-settings.json');
      const dir = path.dirname(authSettingsPath);
      
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
      
      await fs.writeFile(authSettingsPath, JSON.stringify(settingsToSave, null, 2), 'utf-8');
    }
  }
}

// Set up authentication with username and password
export async function setupAuth(username: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  const apiKey = generateApiKey();
  const authSettings: AuthSettings = {
    isAuthenticated: true,
    username,
    passwordHash,
    janitorApiKey: apiKey
  };
  
  // Check if we're in a browser environment (client-side)
  if (typeof window !== 'undefined') {
    // In browser, save to Firestore
    try {
      // Import Firebase functions dynamically to avoid server-side issues
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase-config');
      
      await setDoc(doc(db, 'system', 'auth'), authSettings);
    } catch (error) {
      console.error('Error saving auth settings to Firestore:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  } else {
    // Server-side execution - save to file
    // This is for the API route to handle server-side auth setup
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    const authSettingsPath = path.join(process.cwd(), 'data', 'auth-settings.json');
    const dir = path.dirname(authSettingsPath);
    
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
    
    await fs.writeFile(authSettingsPath, JSON.stringify(authSettings, null, 2), 'utf-8');
  }
}

// Update the JanitorAI API key
export async function updateJanitorApiKey(): Promise<string> {
  const authSettings = await getAuthSettings();
  const newApiKey = generateApiKey();
  
  const updatedSettings: AuthSettings = {
    ...authSettings,
    janitorApiKey: newApiKey
  };
  
  // Check if we're in a browser environment (client-side)
  if (typeof window !== 'undefined') {
    // In browser, save to Firestore
    try {
      // Import Firebase functions dynamically to avoid server-side issues
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase-config');
      
      await setDoc(doc(db, 'system', 'auth'), updatedSettings);
    } catch (error) {
      console.error('Error saving auth settings to Firestore:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  } else {
    // Server-side execution - save to file
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    const authSettingsPath = path.join(process.cwd(), 'data', 'auth-settings.json');
    const dir = path.dirname(authSettingsPath);
    
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
    
    await fs.writeFile(authSettingsPath, JSON.stringify(updatedSettings, null, 2), 'utf-8');
  }
  
  return newApiKey;
}

// Clear authentication
export async function clearAuth(): Promise<void> {
  // Clearing authentication settings
  
  const settingsToSave: AuthSettings = { isAuthenticated: false };
  
  // Check if we're in a browser environment (client-side)
  if (typeof window !== 'undefined') {
    // In browser, save to Firestore
    try {
      // Import Firebase functions dynamically to avoid server-side issues
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase-config');
      
      await setDoc(doc(db, 'system', 'auth'), settingsToSave);
    } catch (error) {
      console.error('Error clearing auth settings in Firestore:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  } else {
    // Server-side execution - save to file
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    const authSettingsPath = path.join(process.cwd(), 'data', 'auth-settings.json');
    const dir = path.dirname(authSettingsPath);
    
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
    
    await fs.writeFile(authSettingsPath, JSON.stringify(settingsToSave, null, 2), 'utf-8');
  }
}