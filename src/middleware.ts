import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Build version - changes on each deployment
const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_ID || Date.now().toString();

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add build version header to all responses
  response.headers.set('X-Build-Version', BUILD_VERSION);

  // Add cache control headers based on path
  const { pathname } = request.nextUrl;

  // API routes - no cache
  if (pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }
  // Static assets - long cache
  else if (pathname.startsWith('/_next/static/') || pathname.match(/\.(jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|otf)$/)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // HTML pages - revalidate
  else {
    response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  }

  return response;
}

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
