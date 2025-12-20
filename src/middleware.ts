import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated as checkEdgeAuth } from '@/lib/edge-auth';

// Create a server-side compatible isAuthenticated function for middleware
// This function checks if the user is authenticated by verifying the session cookie or API key
async function isAuthenticated(request: NextRequest): Promise<boolean> {
  try {
    // For API routes, check for the session cookie or API key
    const apiKey = request.headers.get('x-api-key');
    const sessionCookie = request.cookies.get('janitor_session');
    
    // If API key is provided, use the edge auth function to validate against Firebase
    if (apiKey) {
      console.log('Middleware - Validating API key via Firebase');
      return await checkEdgeAuth(request);
    }
    
    // For web pages, check if session cookie exists
    // The presence of the session cookie indicates the user is authenticated
    if (sessionCookie) {
      console.log('Middleware - Session cookie authentication successful');
      return true;
    }
    
    console.log('Middleware - No authentication credentials found');
    return false;
  } catch (error) {
    console.error('Error checking authentication in middleware:', error);
    return false;
  }
}

// Define public routes that don't require authentication
const publicRoutes = [
  '/api/health',
  '/api/proxy/test-connection',
  '/api/proxy/models',
  '/api/storage/status',
  '/api/storage/stats',
  '/api/storage/logs',
  '/login',  // Allow access to login page
  '/register', // Allow access to register page for first-time setup
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
  
  // Check if this is a web page (not an API route) that should be protected
  const isWebPage = !pathname.startsWith('/api/') &&
                   !pathname.startsWith('/_next/') &&
                   !pathname.startsWith('/favicon.ico') &&
                   !pathname.startsWith('/public/') &&
                   !pathname.startsWith('/static/');
  
  // DEBUG LOGGING
  console.log(`Middleware - Processing: ${pathname}, Public: ${isPublicRoute}, WebPage: ${isWebPage}, Protected: ${isProtectedRoute}`);
  
  // If it's a public route, allow access regardless of authentication
  if (isPublicRoute) {
    console.log(`Middleware - Allowing access to public route: ${pathname}`);
    return NextResponse.next();
  }
  
  // Check authentication status
  const authenticated = await isAuthenticated(request);
  console.log(`Middleware - Authenticated: ${authenticated}`);
  
  // If it's a web page and user is not authenticated, redirect to login
  if (isWebPage && !authenticated) {
    console.log(`Middleware - Redirecting to login from ${pathname}`);
    const callbackUrl = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url));
  }
  
  // If it's a protected API route and user is not authenticated, block access
  if (isProtectedRoute && !authenticated) {
    console.warn(`Middleware - Request blocked for ${pathname}, user not authenticated`);
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized: API key or session required' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // If authenticated or not a protected route, allow access
  console.log(`Middleware - Allowing access to ${pathname}`);
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