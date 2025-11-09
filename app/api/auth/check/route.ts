// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/check
 * Endpoint de debug pour vérifier l'état de l'authentification
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    console.log('[API /api/auth/check] Vérification de la session');
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    return NextResponse.json({
      authenticated: !!session,
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email,
      } : null,
      error: error?.message || null,
    });
  } catch (error: any) {
    console.error('[API /api/auth/check] Erreur:', error);
    return NextResponse.json({ 
      authenticated: false, 
      error: error.message 
    }, { status: 500 });
  }
}
