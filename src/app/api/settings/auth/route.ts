import { NextResponse } from 'next/server';

// GET /api/settings/auth - Get authentication settings
export async function GET() {
  try {
    console.log('API /api/settings/auth - Fetching auth settings');
    
    // Use Firebase Admin SDK for server-side operations
    // For now, return a mock response to test the flow
    console.log('API /api/settings/auth - Using mock data for testing');
    
    // Mock auth settings for testing
    const mockAuthSettings = {
      isAuthenticated: true,
      username: 'admin',
      janitorApiKey: 'sk-test1234567890abcdef'
    };
    
    return NextResponse.json(mockAuthSettings);
  } catch (error) {
    console.error('API /api/settings/auth - Error:', error);
    return NextResponse.json(
      { error: `Failed to get auth settings: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}