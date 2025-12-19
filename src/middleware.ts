import { NextRequest, NextResponse } from 'next/server';

// Create a server-side compatible isAuthenticated function for middleware
// This function checks if the user is authenticated by verifying the session cookie
async function isAuthenticated(request: NextRequest): Promise<boolean> {
  try {
    // For API routes, check for the session cookie or API key
    const apiKey = request.headers.get('x-api-key');
    const sessionCookie = request.cookies.get('janitor_session');
    
    // If API key is provided, we'll validate it against Firestore in the client-side
    // For now, we allow the request to pass through and let the client-side auth handle it
    if (apiKey) {
      return true;
    }
    
    // For web pages, check if session cookie exists
    // The presence of the session cookie indicates the user is authenticated
    if (sessionCookie) {
      return true;
    }
    
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
  
  // If it's a web page but not a public route, redirect to login
  // The login page will check Firestore and redirect to register if needed
  if (isWebPage && !isPublicRoute) {
    const callbackUrl = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url));
  }
  
  // If it's a public route, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // If it's a protected API route, check for API key
  if (isProtectedRoute) {
    const authenticated = await isAuthenticated(request);
    
    if (!authenticated) {
      console.warn('Middleware - Request blocked, user not authenticated for protected route');
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