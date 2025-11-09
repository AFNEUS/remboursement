// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET /api/events : liste tous les événements
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/events : crée un événement
export async function POST(req: NextRequest) {
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
    const { name, description, event_type, start_date, end_date, location, departure_city, custom_km_cap, carpooling_bonus_cap_percent, allow_carpooling_bonus, max_train_amount, max_hotel_per_night, max_meal_amount, allowed_expense_types } = body;

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
          created_by: session.user.id,
        },
      ])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data[0]);
  } catch (error: any) {
    console.error('Erreur POST /api/events:', error);
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
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data[0]);
  } catch (error: any) {
    console.error('Erreur PUT /api/events:', error);
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
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erreur DELETE /api/events:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
