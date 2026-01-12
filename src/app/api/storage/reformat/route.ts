import { NextRequest, NextResponse } from 'next/server';
import { storageManager } from '@/lib/storage-provider';
import { OptimizedFirebaseStorageProvider } from '@/lib/firebase-storage-provider-optimized';

// POST /api/storage/reformat - Reformat database structure from old to new format
export async function POST(request: NextRequest) {
  try {
    // Get the provider to access the reformat method
    const providerType = await storageManager.getProviderType();
    
    if (providerType !== 'firebase') {
      return NextResponse.json(
        { error: 'Database reformatting only available for Firebase storage' },
        { status: 400 }
      );
    }

    // Get the Firebase provider instance
    const firebaseProvider = storageManager.getFirebaseProvider();
    
    if (!firebaseProvider) {
      return NextResponse.json(
        { error: 'Firebase provider not available' },
        { status: 500 }
      );
    }

    // Access the underlying optimized provider
    const optimizedProvider = (firebaseProvider as any).firebaseProvider as OptimizedFirebaseStorageProvider;
    
    if (!optimizedProvider || typeof optimizedProvider.reformatDatabaseStructure !== 'function') {
      return NextResponse.json(
        { error: 'Database reformatting not supported by current provider' },
        { status: 501 }
      );
    }

    // Call the reformat method
    const result = await optimizedProvider.reformatDatabaseStructure();
    
    return NextResponse.json({
      success: true,
      migrated: result.migrated,
      errors: result.errors,
      message: `Database reformatted successfully. Migrated ${result.migrated} items with ${result.errors} errors.`
    });
    
  } catch (error) {
    console.error('Database reformatting failed:', error);
    return NextResponse.json(
      {
        error: 'Database reformatting failed',
        details: error instanceof Error ? error.message : 'Unknown error'
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