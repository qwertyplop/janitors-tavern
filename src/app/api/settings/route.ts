import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { LoggingSettings } from '@/types';
import { AuthSettings } from '@/types';
import { setupAuth, updateJanitorApiKey, hashPassword, verifyPassword } from '@/lib/auth';

// Server-side auth settings functions that work in API routes
async function getAuthSettings(): Promise<AuthSettings> {
  // For server-side execution, we'll use a file-based approach
  // since Firebase can't be used server-side in this context
  const authSettingsPath = path.join(process.cwd(), 'data', 'auth-settings.json');
  
  try {
    const fileContent = await fs.readFile(authSettingsPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    // If file doesn't exist or there's an error, return default
    return { isAuthenticated: false };
  }
}

async function saveAuthSettings(settings: AuthSettings): Promise<void> {
  // For server-side execution, save to file
  const authSettingsPath = path.join(process.cwd(), 'data', 'auth-settings.json');
  const dir = path.dirname(authSettingsPath);
  
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
  
  await fs.writeFile(authSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

// Function to sync auth settings to Firestore (client-side only)
async function syncAuthSettingsToFirestore(settings: AuthSettings): Promise<void> {
  // Only attempt to sync to Firestore if we're in a browser environment
  if (typeof window !== 'undefined') {
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase-config');
      
      await setDoc(doc(db, 'system', 'auth'), settings);
      console.log('Auth settings synced to Firestore successfully');
    } catch (error) {
      console.error('Error syncing auth settings to Firestore:', error);
      // Don't throw error as this is just a sync operation
    }
  }
}

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'server-settings.json');

interface ServerSettings {
  logging: LoggingSettings;
}

interface AuthRequest {
  action: 'setup' | 'update-api-key' | 'get-auth-status';
  username?: string;
  password?: string;
  currentPassword?: string;
}

const DEFAULT_SERVER_SETTINGS: ServerSettings = {
  logging: {
    enabled: false,
    logRequests: true,
    logResponses: true,
    logFilePath: 'logs/proxy.log',
  },
};

async function ensureDataDirectory(): Promise<void> {
  const dir = path.dirname(SETTINGS_FILE);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function readServerSettings(): Promise<ServerSettings> {
  try {
    await ensureDataDirectory();
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return { ...DEFAULT_SERVER_SETTINGS, ...JSON.parse(content) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return DEFAULT_SERVER_SETTINGS;
    }
    throw error;
  }
}

async function writeServerSettings(settings: ServerSettings): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

// GET /api/settings - Get server settings
export async function GET() {
  try {
    const settings = await readServerSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to read settings: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update server settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if this is an auth-related request
    if (body.action) {
      const authRequest = body as AuthRequest;
      
      switch (authRequest.action) {
        case 'setup':
          // Setup authentication (one-time only)
          const authSettings = await getAuthSettings();
          if (authSettings.isAuthenticated) {
            return NextResponse.json(
              { error: 'Authentication is already set up and cannot be changed' },
              { status: 400 }
            );
          }
          
          if (!authRequest.username || !authRequest.password) {
            return NextResponse.json(
              { error: 'Username and password are required' },
              { status: 400 }
            );
          }
          
          try {
            console.log('API - Setting up authentication for user:', authRequest.username);
            await setupAuth(authRequest.username, authRequest.password);
            console.log('API - Authentication set up successfully for user:', authRequest.username);
            
            // Sync to Firestore if possible (client-side)
            const newAuthSettings = await getAuthSettings();
            await syncAuthSettingsToFirestore(newAuthSettings);
            
            return NextResponse.json({ success: true, message: 'Authentication set up successfully' });
          } catch (error) {
            console.error('Error setting up auth:', error);
            return NextResponse.json(
              { error: `Failed to set up authentication: ${error instanceof Error ? error.message : 'Unknown error'}` },
              { status: 500 }
            );
          }
          
        case 'update-api-key':
          // Update the JanitorAI API key
          try {
            console.log('API - Updating Janitor API key');
            const newApiKey = await updateJanitorApiKey();
            console.log('API - New API key generated successfully');
            
            // Sync to Firestore if possible (client-side)
            const newAuthSettings = await getAuthSettings();
            await syncAuthSettingsToFirestore(newAuthSettings);
            
            return NextResponse.json({ success: true, apiKey: newApiKey });
          } catch (error) {
            console.error('Error updating API key:', error);
            return NextResponse.json(
              { error: `Failed to update API key: ${error instanceof Error ? error.message : 'Unknown error'}` },
              { status: 500 }
            );
          }
          
        case 'get-auth-status':
          // Return authentication status
          try {
            const currentAuthSettings = await getAuthSettings();
            console.log('API - Auth settings retrieved for status check:', currentAuthSettings);
            
            // Return the auth status
            const authStatus = {
              isAuthenticated: currentAuthSettings.isAuthenticated,
              hasApiKey: !!currentAuthSettings.janitorApiKey,
              janitorApiKey: currentAuthSettings.janitorApiKey
            };
            
            return NextResponse.json(authStatus);
          } catch (error) {
            console.error('Error getting auth status:', error);
            return NextResponse.json(
              { error: `Failed to get auth status: ${error instanceof Error ? error.message : 'Unknown error'}` },
              { status: 500 }
            );
          }
          
        default:
          return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
          );
      }
    }
    
    // Handle regular server settings update
    const currentSettings = await readServerSettings();

    // Merge with current settings
    const newSettings: ServerSettings = {
      ...currentSettings,
      ...body,
      logging: body.logging ? { ...currentSettings.logging, ...body.logging } : currentSettings.logging,
    };

    await writeServerSettings(newSettings);

    return NextResponse.json({ success: true, settings: newSettings });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to update settings: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// Ensure this route runs in Node.js runtime, not edge runtime
// because it uses file system operations
export const runtime = 'nodejs';
