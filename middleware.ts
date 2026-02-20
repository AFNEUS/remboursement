import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes accessibles uniquement avec une session authentifiée
const PROTECTED_ROUTES = [
  '/dashboard',
  '/claims',
  '/profile',
  '/validator',
  '/treasurer',
  '/admin',
  '/debug',
];

// Routes réservées aux rôles spécifiques (vérification côté client en complément)
// La vérification du rôle fin reste côté API/page, le middleware assure juste l'auth de base

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Rafraîchir la session
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // Vérifier si la route est protégée
  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

  if (isProtected && !session) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Rediriger un utilisateur connecté qui tente d'accéder à la page de login
  if (pathname === '/auth/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|logo|manifest|api).*)',
  ],
};
