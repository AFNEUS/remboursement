import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// ================================================================
// CLIENT PUBLIC (Browser + Server Components)
// ================================================================
// Utilise NEXT_PUBLIC_ pour être disponible dans le navigateur
// ⚠️ NE JAMAIS exposer la service_role_key ici !

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ================================================================
// ⚠️ SERVICE ROLE CLIENT REMOVED
// ================================================================
// La clé service_role a été déplacée dans lib/supabase-admin.ts
// pour INTERDIRE son usage côté client.
// 
// Si vous avez besoin de supabaseAdmin, importez-le depuis:
// import { supabaseAdmin } from '@/lib/supabase-admin';
// 
// ⚠️ UNIQUEMENT dans /app/api/* routes (serveur)
// ================================================================

