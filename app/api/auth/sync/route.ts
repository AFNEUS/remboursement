import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Sync via RPC function (SECURITY DEFINER)
    const { error: syncError } = await supabase.rpc('sync_current_user');
    if (syncError) {
      console.error('[API /auth/sync] Erreur sync:', syncError);
      return NextResponse.json({ error: syncError.message }, { status: 500 });
    }

    // Récupérer le profil via admin client (bypass RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('[API /auth/sync] Erreur récupération profil:', profileError);
      return NextResponse.json({ error: 'Erreur récupération profil' }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('[API /auth/sync] Erreur serveur:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Convenience: allow GET for easy manual triggering
  return POST(req);
}
