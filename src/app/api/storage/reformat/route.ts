import { NextRequest, NextResponse } from 'next/server';
import { storageManager } from '@/lib/storage-provider';
import { OptimizedFirebaseStorageProvider } from '@/lib/firebase-storage-provider-optimized';

// POST /api/storage/reformat - Reformat database structure from old to new format
export async function POST(request: NextRequest) {
  console.log('[DatabaseReformat] Starting database reformatting process');
  
  try {
    // Get the provider to access the reformat method
    console.log('[DatabaseReformat] Getting provider type...');
    const providerType = await storageManager.getProviderType();
    console.log('[DatabaseReformat] Provider type:', providerType);
    
    if (providerType !== 'firebase') {
      console.log('[DatabaseReformat] Not Firebase storage, returning error');
      return NextResponse.json(
        { error: 'Database reformatting only available for Firebase storage' },
        { status: 400 }
      );
    }

    // Get the Firebase provider instance
    console.log('[DatabaseReformat] Getting Firebase provider...');
    const firebaseProvider = storageManager.getFirebaseProvider();
    
    if (!firebaseProvider) {
      console.log('[DatabaseReformat] Firebase provider not available');
      return NextResponse.json(
        { error: 'Firebase provider not available' },
        { status: 500 }
      );
    }

    // Access the underlying optimized provider
    console.log('[DatabaseReformat] Accessing optimized provider...');
    const optimizedProvider = (firebaseProvider as any).firebaseProvider as OptimizedFirebaseStorageProvider;
    
    if (!optimizedProvider) {
      console.log('[DatabaseReformat] Optimized provider not found');
      return NextResponse.json(
        { error: 'Optimized Firebase provider not found' },
        { status: 501 }
      );
    }
    
    if (typeof optimizedProvider.reformatDatabaseStructure !== 'function') {
      console.log('[DatabaseReformat] reformatDatabaseStructure method not found');
      return NextResponse.json(
        { error: 'Database reformatting not supported by current provider' },
        { status: 501 }
      );
    }

    // Call the reformat method with timeout protection
    console.log('[DatabaseReformat] Calling reformatDatabaseStructure...');
    const result = await Promise.race([
      optimizedProvider.reformatDatabaseStructure(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database reformatting timeout after 30 seconds')), 30000)
      )
    ]);
    
    console.log('[DatabaseReformat] Reformat completed:', result);
    
    return NextResponse.json({
      success: true,
      migrated: (result as any).migrated || 0,
      errors: (result as any).errors || 0,
      message: `Database reformatted successfully. Migrated ${(result as any).migrated || 0} items with ${(result as any).errors || 0} errors.`
    });
    
  } catch (error) {
    console.error('[DatabaseReformat] Database reformatting failed:', error);
    return NextResponse.json(
      {
        error: 'Database reformatting failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET /api/storage/reformat - Check if migration is needed
export async function GET() {
  try {
    const providerType = await storageManager.getProviderType();
    
    if (providerType !== 'firebase') {
      return NextResponse.json({
        needsMigration: false,
        message: 'Migration only applicable for Firebase storage'
      });
    }

    // Get the Firebase provider instance
    const firebaseProvider = storageManager.getFirebaseProvider();
    
    if (!firebaseProvider) {
      return NextResponse.json({
        needsMigration: false,
        message: 'Firebase provider not available'
      });
    }

    // Access the underlying optimized provider
    const optimizedProvider = (firebaseProvider as any).firebaseProvider as OptimizedFirebaseStorageProvider;
    
    if (!optimizedProvider || typeof optimizedProvider.needsMigration !== 'function') {
      return NextResponse.json({
        needsMigration: false,
        message: 'Migration check not supported'
      });
    }

    const needsMigration = await optimizedProvider.needsMigration();
    
    return NextResponse.json({
      needsMigration,
      message: needsMigration
        ? 'Database migration is needed for optimal performance'
        : 'Database is already in optimized format'
    });
    
  } catch (error) {
    console.error('Migration check failed:', error);
    return NextResponse.json(
      {
        error: 'Migration check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}