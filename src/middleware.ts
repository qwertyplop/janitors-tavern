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
  '/api/settings/auth', // Allow access to auth settings for client-side auth
  '/login',  // Allow access to login page
];

// Define routes that require authentication
const protectedRoutes = [
  '/api/proxy/chat-completion',
  '/api/settings',
  '/api/storage',
  '/api/logs',
];

// For web pages, we'll protect everything that's not explicitly public
// This means any route that doesn't start with public routes and doesn't start with /api/ or other static files

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
  
  // Check if this is a web page (not an API route) that should be protected
  const isWebPage = !pathname.startsWith('/api/') &&
                   !pathname.startsWith('/_next/') &&
                   !pathname.startsWith('/favicon.ico') &&
                   !pathname.startsWith('/public/') &&
                   !pathname.startsWith('/static/');
  
  // If it's a web page but not a public route, check authentication
  if (isWebPage && !isPublicRoute) {
    // Check authentication
    const authenticated = await isAuthenticated(request);
    
    if (!authenticated) {
      // Redirect to login page with callback URL
      const callbackUrl = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url));
    }
  }
  
  // If it's a public route, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // If it's a protected API route, check authentication
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