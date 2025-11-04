// ================================================================
// API Route: /api/csrf
// ================================================================
// Retourne le token CSRF pour les clients
// ================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateCsrfToken } from '@/lib/csrf';

export async function GET(req: NextRequest) {
  const token = generateCsrfToken();
  
  const response = NextResponse.json({ token }, { status: 200 });
  
  // Set cookie
  response.cookies.set('__Host-csrf-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 heures
  });

  // Expose token via header
  response.headers.set('X-CSRF-Token', token);

  return response;
}

export const dynamic = 'force-dynamic';
