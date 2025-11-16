import { createClient } from '@supabase/supabase-js';
import { Database } from '../database.types';

// Lazy initialization pour éviter les erreurs de build
let _supabase: ReturnType<typeof createClient<Database>> | null = null;

function getSupabase() {
  if (_supabase) {
    return _supabase;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('URL:', supabaseUrl);
    console.error('Key:', supabaseAnonKey ? 'présente' : 'manquante');
  }

  _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return _supabase;
}

// Export un proxy qui initialise lazy
export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop) {
    const client = getSupabase();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
