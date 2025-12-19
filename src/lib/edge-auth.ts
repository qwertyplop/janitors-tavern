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
  // Check environment variables for auth settings (serverless/edge compatible)
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