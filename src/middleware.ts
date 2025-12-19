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
    // Allow access to register page for first-time setup
    if (pathname === '/register') {
      const url = request.nextUrl;
      const forceRegister = url.searchParams.get('force');
      
      // If force parameter is present, allow access to register page regardless of auth status
      if (forceRegister === 'true') {
        return NextResponse.next();
      }
      
      // If user is already authenticated, redirect to dashboard
      const authenticated = await isAuthenticated(request);
      if (authenticated) {
        return NextResponse.redirect(new URL('/', request.url));
      }
      // Otherwise, allow access to register page
      return NextResponse.next();
    }
    
    // For other pages, check authentication
    const authenticated = await isAuthenticated(request);
    
    if (!authenticated) {
      // Redirect to login page first, which will redirect to register if auth is not set up
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
    // Special case for /api/settings - allow access to get-auth-status action when not authenticated
    // This allows the UI to check if auth is set up without being authenticated
    if (pathname === '/api/settings' && request.method === 'PUT') {
      try {
        // Get the request body to check the action
        const bodyText = await request.text();
        const body = JSON.parse(bodyText);
        
        // Allow access to get-auth-status action to check if auth is set up
        if (body.action === 'get-auth-status') {
          // Continue with the request without authentication check
        } else {
          // For other actions, check authentication as normal
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
      } catch (error) {
        // If parsing the body fails, fall back to normal authentication check
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
    } else {
      // For all other protected routes, check authentication normally
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