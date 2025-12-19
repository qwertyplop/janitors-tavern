import { NextRequest, NextResponse } from 'next/server';
import type { LoggingSettings } from '@/types';
import { AuthSettings } from '@/types';
import { setupAuth, updateJanitorApiKey, getAuthSettings } from '@/lib/auth';

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

const SETTINGS_FILE = 'data/server-settings.json';

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

// For server settings storage, we'll use a simple in-memory approach with
// periodic sync to Firestore when in client environment
// This is a simplified approach for Edge Runtime compatibility
let serverSettingsCache: ServerSettings | null = null;

async function readServerSettings(): Promise<ServerSettings> {
  // In Edge Runtime, we'll use a simple in-memory cache
  // In a production environment, you might want to use a proper database
  if (serverSettingsCache) {
    return serverSettingsCache;
  }

  // Return default settings if no cache exists
  return DEFAULT_SERVER_SETTINGS;
}

async function writeServerSettings(settings: ServerSettings): Promise<void> {
  // Update the in-memory cache
  serverSettingsCache = settings;

  // In a production environment, you might want to persist this to a database
  // For now, we'll just keep it in memory
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
            await setupAuth(authRequest.username, authRequest.password);
            
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
            const newApiKey = await updateJanitorApiKey();
            
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

// This route can run in edge runtime since it no longer uses file system operations
export const runtime = 'edge';
