// @ts-nocheck - Types Supabase incompatibles avec schéma actuel
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Force dynamic rendering (uses cookies for auth)
export const dynamic = 'force-dynamic';

/**
 * GET /api/claims/list
 * Lister les demandes de remboursement (avec filtres)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Vérifier l'authentification
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    // Paramètres de filtrage
    const status = searchParams.get('status');
    const userIdParam = searchParams.get('user_id');
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const expenseType = searchParams.get('expense_type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Récupérer le profil utilisateur via admin client (bypass RLS)
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      console.error('Erreur récupération profil:', profileError);
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    // Construire la requête avec jointures (utiliser la table directe, pas la vue)
    let query = supabaseAdmin
      .from('expense_claims')
      .select(`
        *,
        user:users!expense_claims_user_id_fkey(id, email, full_name, first_name, last_name, role),
        event:events(id, name, event_type, start_date, end_date, location)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Si pas treasurer/validator/admin, filtrer sur l'utilisateur
    const staffRoles = ['treasurer', 'validator', 'admin_asso'];
    if (!staffRoles.includes(userProfile.role)) {
      query = query.eq('user_id', userId);
    } else if (userIdParam) {
      query = query.eq('user_id', userIdParam);
    }

    // Appliquer les filtres
    if (status) {
      query = query.eq('status', status);
    }
    if (fromDate) {
      query = query.gte('expense_date', fromDate);
    }
    if (toDate) {
      query = query.lte('expense_date', toDate);
    }
    if (expenseType) {
      query = query.eq('expense_type', expenseType);
    }

    const { data: claims, error, count } = await query;

    if (error) {
      console.error('Erreur récupération claims:', error);
      return NextResponse.json({ error: 'Erreur lors de la récupération des demandes' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      claims,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Erreur GET /api/claims/list:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
