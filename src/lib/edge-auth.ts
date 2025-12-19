import { NextRequest } from 'next/server';

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
  const expectedApiKey = process.env.JANITOR_API_KEY;
  
  console.log('Edge auth - Checking API key:', {
    hasApiKey: !!apiKey,
    hasExpectedApiKey: !!expectedApiKey
  });
  
  // If no expected API key is set, allow access (shouldn't happen in properly configured system)
  if (!expectedApiKey) {
    console.log('Edge auth - No expected API key set, allowing request');
    return true;
  }
  
  // Check if the provided API key matches the expected one
  const isAuth = apiKey === expectedApiKey;
  console.log('Edge auth - Authentication result:', isAuth);
  return isAuth;
}

// Get auth settings (for Edge Runtime)
export async function getAuthSettings(): Promise<AuthSettings> {
  try {
    // Import Firebase functions dynamically to avoid server-side issues
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase-config');
    
    const authDoc = await getDoc(doc(db, 'system', 'auth'));
    
    if (authDoc.exists()) {
      const data = authDoc.data();
      const authSettings: AuthSettings = {
        isAuthenticated: data.isAuthenticated || false,
        username: data.username,
        passwordHash: data.passwordHash,
        janitorApiKey: data.janitorApiKey
      };
      console.log('Auth settings retrieved from Firestore (edge runtime)');
      return authSettings;
    } else {
      // If no auth document exists, return default
      console.log('No auth settings found in Firestore (edge runtime), returning default');
      return { isAuthenticated: false };
    }
  } catch (error) {
    console.error('Error fetching auth settings from Firestore in edge runtime:', error);
    // Return default settings if there's an error
    return { isAuthenticated: false };
  }
}