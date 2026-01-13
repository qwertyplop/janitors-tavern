import { NextRequest, NextResponse } from 'next/server';
import { invalidateCache } from '@/lib/server-storage';
import { storageManager } from '@/lib/storage-provider';

import { StorageData } from '@/lib/storage-provider';

const DEFAULTS: StorageData = {
  connections: [],
  presets: [],
  settings: {
    theme: 'system',
    language: 'en',
    showAdvancedOptions: false,
    defaultPostProcessing: 'none',
    logging: {
      enabled: true, // Keep for backward compatibility, not used in UI anymore
      logRequests: false, // Default disabled as requested
      logResponses: false, // Default disabled as requested
      logRawRequestBody: false, // Default disabled
    },
  },
  regexScripts: [],
};

// GET /api/storage/all - Get all storage data
export async function GET() {
  try {
    const data = await storageManager.getAll();
    
    return NextResponse.json({
      connections: data.connections,
      presets: data.presets,
      settings: data.settings,
      regexScripts: data.regexScripts,
    });
  } catch (error) {
    console.error('Error fetching all data:', error);
    return NextResponse.json(DEFAULTS);
  }
}

// PUT /api/storage/all - Save all storage data (used for import)
export async function PUT(request: NextRequest) {
  try {
    const data: Partial<StorageData> = await request.json();

    // Get current data and merge with incoming data
    const currentData = await storageManager.getAll();
    const updatedData = {
      ...currentData,
      ...data
    };

    await storageManager.setAll(updatedData);

    // Invalidate server-side cache so proxy picks up new data
    invalidateCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving all data:', error);
    return NextResponse.json(
      { error: `Failed to save data: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// DELETE /api/storage/all - Clear all storage data
export async function DELETE() {
  try {
    // Set all data to empty/default values
    await storageManager.setAll(DEFAULTS);

    // Invalidate server-side cache
    invalidateCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing storage:', error);
    return NextResponse.json(
      { error: `Failed to clear storage: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
