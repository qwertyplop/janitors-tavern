import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { LoggingSettings } from '@/types';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'server-settings.json');

interface ServerSettings {
  logging: LoggingSettings;
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
