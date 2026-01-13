import { NextRequest, NextResponse } from 'next/server';
import type { AppSettings, LoggingSettings } from '@/types';
import { storageManager } from '@/lib/storage-provider';

const DEFAULT_SERVER_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'en',
  showAdvancedOptions: false,
  defaultPostProcessing: 'none',
  strictPlaceholderMessage: '[Start a new chat]',
  logging: {
    enabled: true, // Keep for backward compatibility, not used in UI anymore
    logRequests: false, // Default disabled as requested
    logResponses: false, // Default disabled as requested
    logRawRequestBody: false, // Default disabled
  },
};

async function readServerSettings(): Promise<AppSettings> {
  try {
    // Read from storage manager (which uses Firebase if available, otherwise localStorage)
    const settings = await storageManager.get('settings');
    return settings;
  } catch (error) {
    console.error('Failed to read server settings from storage:', error);
    return DEFAULT_SERVER_SETTINGS;
  }
}

async function writeServerSettings(settings: AppSettings): Promise<void> {
  try {
    // Write to storage manager
    await storageManager.set('settings', settings);
  } catch (error) {
    console.error('Failed to write server settings to storage:', error);
    throw error;
  }
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

    // Handle regular server settings update
    const currentSettings = await readServerSettings();

    // Merge with current settings
    const newSettings: AppSettings = {
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

// This route can run in edge runtime
export const runtime = 'edge';
