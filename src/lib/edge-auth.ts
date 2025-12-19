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