import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from './lib/edge-auth';

// Define public routes that don't require authentication
const publicRoutes = [
  '/api/health',
  '/api/proxy/test-connection',
  '/api/proxy/models',
  '/api/storage/status',
  '/api/storage/stats',
  '/api/storage/logs',
];

// Define routes that require authentication
const protectedRoutes = [
  '/api/proxy/chat-completion',
  '/api/settings',
  '/api/storage',
  '/api/logs',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // Check if this is a public route
  const isPublicRoute = publicRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // If it's a public route, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // If it's a protected route, check authentication
  if (isProtectedRoute) {
    const authenticated = await isAuthenticated(request);
    
    if (!authenticated) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized: API key required' }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
  
  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};