import { NextResponse } from 'next/server';
import { getAuthSettings } from '@/lib/auth';

// GET /api/settings/auth - Get authentication settings
export async function GET() {
  try {
    const authSettings = await getAuthSettings();

    // In server-side environments, we might get auth settings from environment variables
    // Return them in the same format as Firestore data
    return NextResponse.json(authSettings);
  } catch (error) {
    console.error('Error getting auth settings:', error);
    return NextResponse.json(
      { error: `Failed to get auth settings: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// This route can run in edge runtime
export const runtime = 'edge';