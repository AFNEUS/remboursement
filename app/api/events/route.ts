// PUT /api/events : modifie un événement (admin only)
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...eventData } = body;
  if (!id) {
    return NextResponse.json({ error: 'ID requis pour la modification' }, { status: 400 });
  }
  const { data, error } = await (supabaseAdmin.from('events') as any)
    .update(eventData)
    .eq('id', id)
    .select();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data[0]);
}
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

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
  const body = await req.json();
  const { name, description, event_type, start_date, end_date, location, departure_city, custom_km_cap, carpooling_bonus_cap_percent, allow_carpooling_bonus, max_train_amount, max_hotel_per_night, max_meal_amount, allowed_expense_types } = body;

  const { data, error } = await (supabaseAdmin.from('events') as any)
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
      },
    ])
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data[0]);
}
