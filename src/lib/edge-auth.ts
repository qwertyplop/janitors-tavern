import { NextRequest } from 'next/server';

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