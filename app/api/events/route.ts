// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET /api/events : liste tous les événements
export async function GET() {
  try {
    // Essayer via supabaseAdmin (bypass RLS)
    try {
      const { supabaseAdmin } = await import('@/lib/supabase-admin');
      const { data, error } = await supabaseAdmin
        .from('events')
        .select('*')
        .order('start_date', { ascending: false });
      if (error) throw error;
      return NextResponse.json(data);
    } catch (e) {
      console.warn('[GET /api/events] Admin client indisponible, fallback RLS:', (e as any)?.message);
      // Fallback: utiliser le client lié aux cookies (RLS) – nécessite un user authentifié
      const supabase = createRouteHandlerClient({ cookies });
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: false });
      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (error: any) {
    console.error('Erreur serveur GET /api/events:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/events : crée un événement
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    // Récupérer session via cookies OU via Authorization: Bearer
    let userId: string | null = null;
    let role: string | null = null;

    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
      const token = authHeader?.toLowerCase().startsWith('bearer ')
        ? authHeader.split(' ')[1]
        : null;
      if (token) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const pub = createClient(supabaseUrl, supabaseAnon);
        const { data: userResp } = await pub.auth.getUser(token);
        userId = userResp.user?.id || null;
      }
    }
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    role = userProfile?.role || null;
    if (!role || role !== 'admin_asso') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, event_type, start_date, end_date, location, departure_city, custom_km_cap, carpooling_bonus_cap_percent, allow_carpooling_bonus, max_train_amount, max_hotel_per_night, max_meal_amount, allowed_expense_types } = body;

    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert([
        {
          name,
          description,
          event_type,
          start_date,
          end_date,
          location,
          departure_city,
          custom_km_cap,
          carpooling_bonus_cap_percent,
          allow_carpooling_bonus,
          max_train_amount,
          max_hotel_per_night,
          max_meal_amount,
          allowed_expense_types,
          created_by: userId,
        },
      ])
      .select();

    if (error) {
      console.error('Erreur POST /api/events:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data[0]);
  } catch (error: any) {
    console.error('Erreur serveur POST /api/events:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/events : met à jour un événement
export async function PUT(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Vérifier l'authentification
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Vérifier que l'utilisateur est admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();
    
    if (!userProfile || userProfile.role !== 'admin_asso') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    
    const body = await req.json();
    const { id, name, description, event_type, start_date, end_date, location, departure_city, custom_km_cap, carpooling_bonus_cap_percent, allow_carpooling_bonus, max_train_amount, max_hotel_per_night, max_meal_amount, allowed_expense_types } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('events')
      .update({
        name,
        description,
        event_type,
        start_date,
        end_date,
        location,
        departure_city,
        custom_km_cap,
        carpooling_bonus_cap_percent,
        allow_carpooling_bonus,
        max_train_amount,
        max_hotel_per_night,
        max_meal_amount,
        allowed_expense_types,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Erreur PUT /api/events:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data[0]);
  } catch (error: any) {
    console.error('Erreur serveur PUT /api/events:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/events : supprime un événement
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Vérifier l'authentification
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Vérifier que l'utilisateur est admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();
    
    if (!userProfile || userProfile.role !== 'admin_asso') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erreur DELETE /api/events:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erreur serveur DELETE /api/events:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
