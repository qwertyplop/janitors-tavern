import { NextRequest, NextResponse } from 'next/server';
import { put, head, list, del } from '@vercel/blob';
import { invalidateCache } from '@/lib/server-storage';

const STORAGE_PREFIX = 'janitors-tavern/';

interface StorageData {
  connections: unknown[];
  presets: unknown[];
  settings: unknown;
}

const DEFAULTS: StorageData = {
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
};

async function fetchBlobData(key: string): Promise<unknown> {
  try {
    const blobPath = `${STORAGE_PREFIX}${key}.json`;
    const blobInfo = await head(blobPath);
    if (blobInfo) {
      const response = await fetch(blobInfo.url);
      return await response.json();
    }
  } catch {
    // Blob doesn't exist
  }
  return DEFAULTS[key as keyof StorageData];
}

async function saveBlobData(key: string, data: unknown): Promise<void> {
  const blobPath = `${STORAGE_PREFIX}${key}.json`;

  // put() with addRandomSuffix: false already overwrites existing blobs
  // No need for head() + del() - saves 1 simple + 1 advanced operation!
  await put(blobPath, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
}

// GET /api/storage/all - Get all storage data
export async function GET() {
  // Check if blob is configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Blob storage not configured' },
      { status: 503 }
    );
  }

  try {
    const [connections, presets, settings] = await Promise.all([
      fetchBlobData('connections'),
      fetchBlobData('presets'),
      fetchBlobData('settings'),
    ]);

    return NextResponse.json({
      connections,
      presets,
      settings,
    });
  } catch (error) {
    console.error('Error fetching all data:', error);
    return NextResponse.json(DEFAULTS);
  }
}

// PUT /api/storage/all - Save all storage data (used for import)
export async function PUT(request: NextRequest) {
  // Check if blob is configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Blob storage not configured' },
      { status: 503 }
    );
  }

  try {
    const data: Partial<StorageData> = await request.json();

    // Save each key that was provided
    const savePromises: Promise<void>[] = [];

    if (data.connections !== undefined) {
      savePromises.push(saveBlobData('connections', data.connections));
    }
    if (data.presets !== undefined) {
      savePromises.push(saveBlobData('presets', data.presets));
    }
    if (data.settings !== undefined) {
      savePromises.push(saveBlobData('settings', data.settings));
    }

    await Promise.all(savePromises);

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
  // Check if blob is configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Blob storage not configured' },
      { status: 503 }
    );
  }

  try {
    // List all blobs with our prefix
    const { blobs } = await list({ prefix: STORAGE_PREFIX });

    // Delete all blobs
    if (blobs.length > 0) {
      await del(blobs.map(b => b.url));
    }

    // Invalidate server-side cache
    invalidateCache();

    return NextResponse.json({ success: true, deleted: blobs.length });
  } catch (error) {
    console.error('Error clearing storage:', error);
    return NextResponse.json(
      { error: `Failed to clear storage: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
