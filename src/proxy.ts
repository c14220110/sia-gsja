import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Global Proxy
 * 
 * Handles TWO responsibilities:
 * 1. Page-level auth: Redirect unauthenticated users away from protected pages
 * 2. API-level auth: Block all API requests without a valid access_token cookie
 *    (except auth-flow endpoints like login, force-change-password, select-role)
 */

// Jalur Rute API yang sah dibuka TANPA perlu nunjukin identitas ya
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/force-change-password',
  '/api/auth/select-role',  // Called during login flow before cookie is set (multi-role users)
  '/api/auth/forgot-password',  // No auth needed — user requests password reset
  '/api/auth/reset-password',   // No auth needed — user resets password via email token
];

// Jalur rute yang bole diumbar buat orang umum tp tetep ngeliat khusus metodenya apaan.
const PUBLIC_GET_ONLY_ROUTES = [
  '/api/kegiatan',  // Public schedule page for jemaat (GET only)
];

export default function proxy(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  const { pathname } = request.nextUrl;

  // 1. API SECURITY GUARD
  if (pathname.startsWith('/api/')) {
    // Izinin public API routes
    if (PUBLIC_API_ROUTES.some(route => pathname === route)) {
      return NextResponse.next();
    }

    // Allow GET-only public routes
    if (request.method === 'GET' && PUBLIC_GET_ONLY_ROUTES.some(route => pathname === route)) {
      return NextResponse.next();
    }

    // Block requests tanpa access_token cookie
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // Basic JWT structure validation (header.payload.signature)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Invalid token format' },
        { status: 401 }
      );
    }

    // Token ADA dan has valid structurenya — biar  route handler do full JWT verification
    return NextResponse.next();
  }

  // ═══════════════════════════════════════════════
  // 2. PAGE-LEVEL AUTH REDIRECTS
  // ═══════════════════════════════════════════════
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/reset-password');

  // Ojo ksini ! Belokan yg blom login yang nekat pgn nembus akses yg dikunci nih ya
  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Banting setir ngehalau yang udh login menjauh jauh dri ruang login page ini
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Cocokkan buat laman terlidung doang dong ya (asset yang diam-diam aja jgn diitung ege)
    '/dashboard/:path*',
    '/pengurus/:path*',
    '/pelayan/:path*',
    '/kegiatan/:path*',
    '/pegawai/:path*',
    '/buku-besar/:path*',
    '/anggaran/:path*',
    '/settings/:path*',
    '/family-tree/:path*',
    '/layanan-pastoral/:path*',
    '/login',
    '/reset-password',
  ],
};
