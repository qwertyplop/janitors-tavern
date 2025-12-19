import { NextResponse } from 'next/server';
import { storageManager } from '@/lib/storage-provider';

// Check if Firebase is configured
export async function GET() {
  // Check if Firebase is available by getting the provider type
  const providerType = await storageManager.getProviderType();

  return NextResponse.json({
    configured: providerType === 'firebase',
    provider: providerType,
  });
}
