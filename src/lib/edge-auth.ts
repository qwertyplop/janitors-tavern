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
  
  // If authentication is not enforced, allow all requests
  if (!authEnforced) {
    return true;
  }
  
  // If authentication is enforced, check for API key in headers
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.JANITOR_API_KEY;
  
  // If no expected API key is set, allow access (shouldn't happen in properly configured system)
  if (!expectedApiKey) {
    return true;
  }
  
  // Check if the provided API key matches the expected one
  return apiKey === expectedApiKey;
}

// Get auth settings (for Edge Runtime)
export async function getAuthSettings(): Promise<AuthSettings> {
  // Check if we're in a browser environment (client-side)
  if (typeof window !== 'undefined') {
    try {
      // Try to get auth settings from Firestore first (for modern deployments)
      // Import Firebase functions dynamically to avoid server-side issues
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase-config');
      
      const authDoc = await getDoc(doc(db, 'system', 'auth'));
      
      if (authDoc.exists()) {
        const data = authDoc.data();
        return {
          isAuthenticated: data.isAuthenticated || false,
          username: data.username,
          passwordHash: data.passwordHash,
          janitorApiKey: data.janitorApiKey
        };
      }
    } catch (error) {
      console.error('Error fetching auth settings from Firestore in edge runtime:', error);
      // Continue to fallback
    }
  }
  
  // Fallback to environment variables for compatibility and server-side rendering
  if (process.env.AUTH_IS_SETUP === 'true') {
    return {
      isAuthenticated: true,
      username: process.env.AUTH_USERNAME || undefined,
      passwordHash: process.env.AUTH_PASSWORD_HASH || undefined,
      janitorApiKey: process.env.JANITOR_API_KEY || undefined
    };
  }
  
  // If no environment variables are set, return default
  return { isAuthenticated: false };
}