// ================================================================
// 🔐 CSRF PROTECTION
// ================================================================
// Double-submit cookie pattern + header validation
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';

const CSRF_COOKIE_NAME = '__Host-csrf-token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_TOKEN_LENGTH = 32;

// ================================================================
// Générer un token CSRF cryptographiquement sécurisé
// ================================================================
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

// ================================================================
// Hasher le token pour double-submit
// ================================================================
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ================================================================
// Définir le cookie CSRF sécurisé
// ================================================================
export function setCsrfCookie(res: NextResponse, token: string) {
  res.cookies.set(CSRF_COOKIE_NAME, hashToken(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 heures
  });
}

// ================================================================
// Vérifier le token CSRF
// ================================================================
export function verifyCsrfToken(req: NextRequest): boolean {
  // Skip pour GET/HEAD/OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return true;
  }

  const cookieToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = req.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    console.error('[CSRF] Missing token:', { cookieToken: !!cookieToken, headerToken: !!headerToken });
    return false;
  }

  const hashedHeaderToken = hashToken(headerToken);

  if (cookieToken !== hashedHeaderToken) {
    console.error('[CSRF] Token mismatch');
    return false;
  }

  return true;
}

// ================================================================
// Middleware CSRF (intégrer dans middleware.ts)
// ================================================================
export async function csrfMiddleware(req: NextRequest, res: NextResponse): Promise<NextResponse> {
  // Générer token pour nouvelles sessions
  if (!req.cookies.get(CSRF_COOKIE_NAME)) {
    const token = generateCsrfToken();
    setCsrfCookie(res, token);
    
    // Retourner le token dans un header pour que le client le récupère
    res.headers.set(CSRF_HEADER_NAME, token);
  }

  // Vérifier pour mutations
  if (!verifyCsrfToken(req)) {
    return NextResponse.json(
      { error: 'CSRF token invalid or missing' },
      { status: 403 }
    );
  }

  return res;
}

// ================================================================
// Hook React pour récupérer le token CSRF
// ================================================================
// À placer dans lib/hooks/useCsrfToken.ts
/*
import { useEffect, useState } from 'react';

export function useCsrfToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Récupérer depuis meta tag ou header
    const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
    if (meta) {
      setToken(meta.content);
    }
  }, []);

  return token;
}

// Utilisation dans fetch:
const csrfToken = useCsrfToken();
await fetch('/api/claims/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken || '',
  },
  body: JSON.stringify(data),
});
*/
