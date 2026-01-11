import { NextRequest, NextResponse } from 'next/server';
import { invalidateCache } from '@/lib/server-storage';
import { storageManager } from '@/lib/storage-provider';
import { RegexScript } from '@/types';

// Valid storage keys
const VALID_KEYS = ['connections', 'presets', 'settings', 'regexScripts'] as const;
type StorageKey = (typeof VALID_KEYS)[number];

function isValidKey(key: string): key is StorageKey {
  return VALID_KEYS.includes(key as StorageKey);
}

// Default values for each key
const DEFAULTS: Record<StorageKey, unknown> = {
  connections: [],
  presets: [],
  settings: {
    theme: 'system',
    language: 'en',
    showAdvancedOptions: false,
    logging: {
      enabled: true, // Keep for backward compatibility, not used in UI anymore
      logRequests: false, // Default disabled as requested
      logResponses: false, // Default disabled as requested
      logFilePath: 'logs/proxy.log',
    },
  },
  regexScripts: [],
};

// GET /api/storage/[key] - Get data for a specific key
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  if (!isValidKey(key)) {
    return NextResponse.json(
      { error: `Invalid storage key: ${key}` },
      { status: 400 }
    );
  }

  try {
    const data = await storageManager.get(key as any);
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error fetching ${key}:`, error);
    return NextResponse.json(DEFAULTS[key]);
  }
}

// PUT /api/storage/[key] - Save data for a specific key
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  if (!isValidKey(key)) {
    return NextResponse.json(
      { error: `Invalid storage key: ${key}` },
      { status: 400 }
    );
  }

  try {
    const data = await request.json();
    
    // Use storage manager to save the data
    await storageManager.set(key as any, data);

    // Invalidate server-side cache so proxy picks up new data
    invalidateCache(key);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
    return NextResponse.json(
      { error: `Failed to save ${key}: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// POST /api/storage/[key] - Import data (merge with existing)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  if (!isValidKey(key)) {
    return NextResponse.json(
      { error: `Invalid storage key: ${key}` },
      { status: 400 }
    );
  }

  // Only support regexScripts for now
  if (key !== 'regexScripts') {
    return NextResponse.json(
      { error: `Import not supported for key: ${key}` },
      { status: 400 }
    );
  }

  try {
    const incoming = await request.json();

    // Fetch existing data
    let existing: RegexScript[] = [];
    try {
      const existingData = await storageManager.get('regexScripts');
      existing = Array.isArray(existingData) ? existingData : [];
    } catch {
      // If there's an error fetching, start with empty array
      existing = [];
    }

    if (!Array.isArray(existing)) {
      existing = [];
    }

    // Normalize incoming to array
    const incomingArray = Array.isArray(incoming) ? incoming : [incoming];

    // Process each script: assign new ID if missing, update timestamps
    const now = new Date().toISOString();
    const merged = [...existing];
    for (const script of incomingArray) {
      // Ensure script has required fields (basic validation)
      if (typeof script !== 'object' || script === null) {
        continue;
      }
      const newScript = { ...script };
      // Generate new ID if missing or conflict
      if (!newScript.id || existing.some(s => s.id === newScript.id)) {
        newScript.id = crypto.randomUUID();
      }
      // Update timestamps
      newScript.createdAt = newScript.createdAt || now;
      newScript.updatedAt = now;
      // Add to merged, replace if same ID already exists (by overwriting)
      const index = merged.findIndex(s => s.id === newScript.id);
      if (index >= 0) {
        merged[index] = newScript;
      } else {
        merged.push(newScript);
      }
    }

    // Save merged data
    await storageManager.set('regexScripts', merged);

    // Invalidate server-side cache
    invalidateCache(key);

    return NextResponse.json({
      success: true,
      imported: incomingArray.length,
      total: merged.length,
    });
  } catch (error) {
    console.error(`Error importing ${key}:`, error);
    return NextResponse.json(
      { error: `Failed to import ${key}: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
