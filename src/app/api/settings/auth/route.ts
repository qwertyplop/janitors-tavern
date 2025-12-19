import { NextResponse } from 'next/server';
import { getAuthSettings } from '@/lib/edge-auth';

// GET /api/settings/auth - Get authentication settings
export async function GET() {
  try {
    const authSettings = await getAuthSettings();
    return NextResponse.json(authSettings);
  } catch (error) {
    console.error('Error getting auth settings:', error);
    return NextResponse.json(
      { error: `Failed to get auth settings: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}