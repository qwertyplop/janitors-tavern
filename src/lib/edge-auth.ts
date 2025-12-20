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
  // Check if authentication is enforced via environment variable
  const authEnforced = process.env.AUTH_ENFORCED === 'true' || process.env.AUTH_IS_SETUP === 'true';
  console.log('Edge auth - Auth enforced:', authEnforced);
  
  // If authentication is not enforced, allow all requests
  if (!authEnforced) {
    console.log('Edge auth - Auth not enforced, allowing request');
    return true;
  }
  
  // If authentication is enforced, check for API key in headers
  const apiKey = request.headers.get('x-api-key');
  
  console.log('Edge auth - Checking API key:', {
    hasApiKey: !!apiKey,
    hasFirebase: !!db
  });
  
  // If no API key is provided, deny access
  if (!apiKey) {
    console.log('Edge auth - No API key provided');
    return false;
  }
  
  // If Firebase is not available, deny access
  if (!db) {
    console.log('Edge auth - Firebase not available');
    return false;
  }
  
  try {
    // Check if the provided API key matches the one in Firestore
    const authDoc = await getDoc(doc(db, 'system', 'auth'));
    
    if (authDoc.exists()) {
      const data = authDoc.data();
      const storedApiKey = data.janitorApiKey;
      
      console.log('Edge auth - API key validation:', {
        provided: apiKey.substring(0, 8) + '...',
        stored: storedApiKey ? storedApiKey.substring(0, 8) + '...' : 'none',
        match: apiKey === storedApiKey
      });
      
      const isAuth = apiKey === storedApiKey;
      console.log('Edge auth - Authentication result:', isAuth);
      return isAuth;
    } else {
      console.log('Edge auth - No auth document found in Firestore');
      return false;
    }
  } catch (error) {
    console.error('Edge auth - Error validating API key:', error);
    return false;
  }
}