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

// Path for storing auth settings on the server
const AUTH_SETTINGS_FILE = path.join(process.cwd(), 'data', 'auth-settings.json');

async function ensureDataDirectory(): Promise<void> {
  const dir = path.dirname(AUTH_SETTINGS_FILE);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Get auth settings from server storage
export async function getAuthSettings(): Promise<AuthSettings> {
  try {
    await ensureDataDirectory();
    const content = await fs.readFile(AUTH_SETTINGS_FILE, 'utf-8');
    return { isAuthenticated: false, ...JSON.parse(content) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, return default settings
      return { isAuthenticated: false };
    }
    console.error('Error reading auth settings:', error);
    return { isAuthenticated: false };
  }
}

// Save auth settings to server storage
export async function saveAuthSettings(settings: AuthSettings): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(AUTH_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
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
    await saveAuthSettings({
      isAuthenticated: false,
      janitorApiKey: undefined
    });
  }
}

// Set up authentication with username and password
export async function setupAuth(username: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  const authSettings: AuthSettings = {
    isAuthenticated: true,
    username,
    passwordHash,
    janitorApiKey: generateApiKey()
  };
  
  await saveAuthSettings(authSettings);
}

// Update the JanitorAI API key
export async function updateJanitorApiKey(): Promise<string> {
  const authSettings = await getAuthSettings();
  const newApiKey = generateApiKey();
  
  const updatedSettings: AuthSettings = {
    ...authSettings,
    janitorApiKey: newApiKey
  };
  
  await saveAuthSettings(updatedSettings);
  return newApiKey;
}

// Clear authentication
export async function clearAuth(): Promise<void> {
  await saveAuthSettings({ isAuthenticated: false });
}