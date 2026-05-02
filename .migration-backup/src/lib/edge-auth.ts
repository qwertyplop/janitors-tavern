import { NextRequest } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase-config';

// Define auth-related types
export interface AuthSettings {
  isAuthenticated: boolean;
  username?: string;
  passwordHash?: string;
  janitorApiKey?: string;
}

// Check if request is authenticated (for Edge Runtime)
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  console.log('=== Edge Auth Debug Start ===');
  
  // Check if authentication is enforced via environment variable
  const authEnforced = process.env.AUTH_ENFORCED === 'true' || process.env.AUTH_IS_SETUP === 'true';
  console.log('Edge auth - Auth enforced:', authEnforced);
  
  // If authentication is not enforced, allow all requests
  if (!authEnforced) {
    console.log('Edge auth - Auth not enforced, allowing request');
    console.log('=== Edge Auth Debug End (Not Enforced) ===');
    return true;
  }
  
  // If authentication is enforced, check for API key in headers
  const apiKey = request.headers.get('x-api-key');
  
  console.log('Edge auth - Checking API key:', {
    hasApiKey: !!apiKey,
    hasFirebase: !!db,
    firebaseConfig: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '***' : 'MISSING',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'MISSING'
    }
  });
  
  // If no API key is provided, deny access
  if (!apiKey) {
    console.log('Edge auth - No API key provided');
    console.log('=== Edge Auth Debug End (No API Key) ===');
    return false;
  }
  
  // If Firebase is not available, deny access
  if (!db) {
    console.log('Edge auth - Firebase not available');
    console.log('=== Edge Auth Debug End (No Firebase) ===');
    return false;
  }
  
  try {
    console.log('Edge auth - Fetching auth document from Firestore...');
    // Check if the provided API key matches the one in Firestore
    const authDoc = await getDoc(doc(db, 'system', 'auth'));
    
    if (authDoc.exists()) {
      const data = authDoc.data();
      const storedApiKey = data.janitorApiKey;
      
      console.log('Edge auth - Auth document found:', {
        hasStoredApiKey: !!storedApiKey,
        storedApiKeyPreview: storedApiKey ? storedApiKey.substring(0, 8) + '...' : 'none',
        providedApiKeyPreview: apiKey.substring(0, 8) + '...',
        match: apiKey === storedApiKey
      });
      
      const isAuth = apiKey === storedApiKey;
      console.log('Edge auth - Authentication result:', isAuth);
      console.log('=== Edge Auth Debug End (Success) ===');
      return isAuth;
    } else {
      console.log('Edge auth - No auth document found in Firestore');
      console.log('=== Edge Auth Debug End (No Document) ===');
      return false;
    }
  } catch (error) {
    console.error('Edge auth - Error validating API key:', error);
    console.log('=== Edge Auth Debug End (Error) ===');
    return false;
  }
}