// ================================================================
// 🔒 MIDDLEWARE SÉCURISÉ NEXT.JS
// ================================================================
// - Cookies sécurisés (__Host- prefix, HttpOnly, Secure, SameSite)
// - CSRF protection (double-submit pattern)
// - Session timeouts (idle + absolute)
// - Security headers (CSP, HSTS, etc.)
// - Device binding (UA + IP hash)
// ================================================================

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { csrfMiddleware, generateCsrfToken } from '@/lib/csrf';

// ================================================================
// CONFIGURATION
// ================================================================
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes d'inactivité
const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 heures max
const SESSION_COOKIE = '__Host-session-meta';

interface SessionMeta {
  lastActivity: number;
  sessionStart: number;
  deviceHash: string;
}

// ================================================================
// Hasher le device fingerprint (UA + IP)
// ================================================================
function hashDevice(req: NextRequest): string {
  const ua = req.headers.get('user-agent') || '';
  const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
  
  // Simple hash (SHA-256 pour prod)
  return Buffer.from(`${ua}:${ip}`).toString('base64').substring(0, 32);
}

// ================================================================
// MIDDLEWARE PRINCIPAL
// ================================================================
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const now = Date.now();

  // ================================================================
  // 1. SUPABASE AUTH (refresh session)
  // ================================================================
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  // ================================================================
  // 2. SESSION TIMEOUT CHECKS
  // ================================================================
  if (session) {
    const sessionMetaCookie = req.cookies.get(SESSION_COOKIE);
    let sessionMeta: SessionMeta | null = null;

    try {
      sessionMeta = sessionMetaCookie ? JSON.parse(sessionMetaCookie.value) : null;
    } catch (e) {
      console.error('[SESSION] Invalid session meta cookie', e);
    }

    // Première visite : créer sessionMeta
    if (!sessionMeta) {
      sessionMeta = {
        lastActivity: now,
        sessionStart: now,
        deviceHash: hashDevice(req),
      };

      res.cookies.set(SESSION_COOKIE, JSON.stringify(sessionMeta), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: ABSOLUTE_TIMEOUT_MS / 1000,
      });
    } else {
      // ================================================================
      // CHECK 1: IDLE TIMEOUT
      // ================================================================
      const idleTime = now - sessionMeta.lastActivity;
      if (idleTime > IDLE_TIMEOUT_MS) {
        console.log('[SESSION] Idle timeout exceeded, logging out');
        await supabase.auth.signOut();
        
        const loginUrl = new URL('/auth/login', req.url);
        loginUrl.searchParams.set('reason', 'idle_timeout');
        return NextResponse.redirect(loginUrl);
      }

      // ================================================================
      // CHECK 2: ABSOLUTE TIMEOUT
      // ================================================================
      const sessionAge = now - sessionMeta.sessionStart;
      if (sessionAge > ABSOLUTE_TIMEOUT_MS) {
        console.log('[SESSION] Absolute timeout exceeded, logging out');
        await supabase.auth.signOut();
        
        const loginUrl = new URL('/auth/login', req.url);
        loginUrl.searchParams.set('reason', 'session_expired');
        return NextResponse.redirect(loginUrl);
      }

      // ================================================================
      // CHECK 3: DEVICE BINDING
      // ================================================================
      const currentDeviceHash = hashDevice(req);
      if (sessionMeta.deviceHash !== currentDeviceHash) {
        console.error('[SECURITY] Device fingerprint mismatch!', {
          expected: sessionMeta.deviceHash,
          got: currentDeviceHash,
        });
        await supabase.auth.signOut();
        
        const loginUrl = new URL('/auth/login', req.url);
        loginUrl.searchParams.set('reason', 'device_changed');
        return NextResponse.redirect(loginUrl);
      }

      // ================================================================
      // UPDATE LAST ACTIVITY
      // ================================================================
      sessionMeta.lastActivity = now;
      res.cookies.set(SESSION_COOKIE, JSON.stringify(sessionMeta), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: ABSOLUTE_TIMEOUT_MS / 1000,
      });
    }
  }

  // ================================================================
  // 3. CSRF PROTECTION
  // ================================================================
  const csrfResult = await csrfMiddleware(req, res);
  if (csrfResult.status === 403) {
    return csrfResult; // CSRF failed
  }

  // ================================================================
  // 4. SECURITY HEADERS
  // ================================================================
  const isProd = process.env.NODE_ENV === 'production';

  // Content Security Policy (stricte)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live", // TODO: remove unsafe-*
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.supabase.co ${isProd ? 'https://remboursement.afneus.org' : 'http://localhost:3000'}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; ');

  res.headers.set('Content-Security-Policy', csp);

  // HSTS (Strict Transport Security)
  if (isProd) {
    res.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Déjà dans vercel.json mais on force
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.headers.set('X-XSS-Protection', '1; mode=block');

  // ================================================================
  // 5. CSRF TOKEN IN META (pour client)
  // ================================================================
  // Le token CSRF est dans le cookie, on l'expose via header
  const csrfToken = req.cookies.get('__Host-csrf-token')?.value || generateCsrfToken();
  res.headers.set('X-CSRF-Token', csrfToken);

  return res;
}

// ================================================================
// MATCHER CONFIG
// ================================================================
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (manifest, robots, etc.)
     * - API routes health check
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|api/healthz).*)',
  ],
};
