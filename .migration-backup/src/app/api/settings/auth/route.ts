import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';

// GET /api/settings/auth - Get authentication settings
export async function GET() {
  try {
    console.log('API /api/settings/auth - Fetching auth settings');
    
    // Check if Firebase is available
    if (!db) {
      console.error('API /api/settings/auth - Firebase not available');
      return NextResponse.json(
        { error: 'Firebase not initialized' },
        { status: 500 }
      );
    }
    
    // Fetch auth settings from Firestore
    const authDoc = await getDoc(doc(db, 'system', 'auth'));
    
    if (authDoc.exists()) {
      const data = authDoc.data();
      console.log('API /api/settings/auth - Auth document found:', {
        hasApiKey: !!data.janitorApiKey,
        isAuthenticated: data.isAuthenticated
      });
      
      const authSettings = {
        isAuthenticated: data.isAuthenticated || false,
        username: data.username,
        passwordHash: data.passwordHash,
        janitorApiKey: data.janitorApiKey
      };
      
      return NextResponse.json(authSettings);
    } else {
      console.log('API /api/settings/auth - No auth document found');
      return NextResponse.json({ isAuthenticated: false });
    }
  } catch (error) {
    console.error('API /api/settings/auth - Error:', error);
    return NextResponse.json(
      { error: `Failed to get auth settings: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// This route can run in edge runtime
export const runtime = 'edge';