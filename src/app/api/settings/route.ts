import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { LoggingSettings } from '@/types';
import { getAuthSettings, saveAuthSettings, setupAuth, updateJanitorApiKey, hashPassword, verifyPassword } from '@/lib/auth';

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
          
          await setupAuth(authRequest.username, authRequest.password);
          return NextResponse.json({ success: true, message: 'Authentication set up successfully' });
          
        case 'update-api-key':
          // Update the JanitorAI API key
          const newApiKey = await updateJanitorApiKey();
          return NextResponse.json({ success: true, apiKey: newApiKey });
          
        case 'get-auth-status':
          // Return authentication status
          const currentAuthSettings = await getAuthSettings();
          return NextResponse.json({
            isAuthenticated: currentAuthSettings.isAuthenticated,
            hasApiKey: !!currentAuthSettings.janitorApiKey
          });
          
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
