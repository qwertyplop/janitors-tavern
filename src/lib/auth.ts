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

// Get auth settings from server storage (file or environment)
export async function getAuthSettings(): Promise<AuthSettings> {
  // Check if we're in a serverless environment by trying to access the file system
  try {
    // For traditional deployments, use file-based storage
    const filePath = path.join(process.cwd(), 'data', 'auth-settings.json');
    const content = await fs.readFile(filePath, 'utf-8');
    return { isAuthenticated: false, ...JSON.parse(content) };
  } catch (error) {
    // If file access fails (e.g., in serverless), check environment variables
    if (process.env.AUTH_IS_SETUP === 'true') {
      // Use environment variables for serverless
      return {
        isAuthenticated: true,
        username: process.env.AUTH_USERNAME || undefined,
        passwordHash: process.env.AUTH_PASSWORD_HASH || undefined,
        janitorApiKey: process.env.JANITOR_API_KEY || undefined
      };
    }
    
    // If neither file nor environment variables are available, return default
    return { isAuthenticated: false };
  }
}

// Save auth settings to server storage (file or environment)
export async function saveAuthSettings(settings: AuthSettings): Promise<void> {
  try {
    // For traditional deployments, save to file
    const filePath = path.join(process.cwd(), 'data', 'auth-settings.json');
    const dir = path.dirname(filePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
    
    await fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    // If file writing fails (e.g., in serverless), we can't persist the settings
    // In a serverless environment, the user needs to configure via environment variables
    console.warn('Could not save auth settings to file. In serverless environments, configure authentication via environment variables.');
    console.warn('Required environment variables:');
    console.warn(`AUTH_IS_SETUP=${settings.isAuthenticated}`);
    console.warn(`AUTH_USERNAME=${settings.username || ''}`);
    console.warn(`AUTH_PASSWORD_HASH=${settings.passwordHash || ''}`);
    console.warn(`JANITOR_API_KEY=${settings.janitorApiKey || ''}`);
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