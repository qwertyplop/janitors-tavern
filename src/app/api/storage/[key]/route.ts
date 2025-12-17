import { NextRequest, NextResponse } from 'next/server';
import { put, head } from '@vercel/blob';
import { invalidateCache } from '@/lib/server-storage';

// Valid storage keys
const VALID_KEYS = ['connections', 'presets', 'settings', 'regexScripts'] as const;
type StorageKey = (typeof VALID_KEYS)[number];

function isValidKey(key: string): key is StorageKey {
  return VALID_KEYS.includes(key as StorageKey);
}

function getBlobPath(key: StorageKey): string {
  return `janitors-tavern/${key}.json`;
}

// Default values for each key
const DEFAULTS: Record<StorageKey, unknown> = {
  connections: [],
  presets: [],
  settings: {
    theme: 'system',
    showAdvancedOptions: false,
    logging: {
      enabled: false,
      logRequests: true,
      logResponses: true,
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

  // Check if blob is configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Blob storage not configured' },
      { status: 503 }
    );
  }

  try {
    const blobPath = getBlobPath(key);

    // Check if blob exists
    try {
      const blobInfo = await head(blobPath);
      if (blobInfo) {
        // Fetch the blob content
        const response = await fetch(blobInfo.url);
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch {
      // Blob doesn't exist, return default
      return NextResponse.json(DEFAULTS[key]);
    }

    return NextResponse.json(DEFAULTS[key]);
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

  // Check if blob is configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Blob storage not configured' },
      { status: 503 }
    );
  }

  try {
    const data = await request.json();
    const blobPath = getBlobPath(key);

    // put() with addRandomSuffix: false already overwrites existing blobs
    // No need for head() + del() - saves 1 simple + 1 advanced operation!
    const blob = await put(blobPath, JSON.stringify(data, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    // Invalidate server-side cache so proxy picks up new data
    invalidateCache(key);

    return NextResponse.json({
      success: true,
      url: blob.url,
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

  // Check if blob is configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Blob storage not configured' },
      { status: 503 }
    );
  }

  try {
    const incoming = await request.json();
    const blobPath = getBlobPath(key);

    // Fetch existing data
    let existing: any[] = [];
    try {
      const blobInfo = await head(blobPath);
      if (blobInfo) {
        const response = await fetch(blobInfo.url);
        existing = await response.json();
      }
    } catch {
      // Blob doesn't exist, keep empty array
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
    const blob = await put(blobPath, JSON.stringify(merged, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    // Invalidate server-side cache
    invalidateCache(key);

    return NextResponse.json({
      success: true,
      imported: incomingArray.length,
      total: merged.length,
      url: blob.url,
    });
  } catch (error) {
    console.error(`Error importing ${key}:`, error);
    return NextResponse.json(
      { error: `Failed to import ${key}: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
