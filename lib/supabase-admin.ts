import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Client admin pour usage côté serveur UNIQUEMENT
// Ne JAMAIS importer ce fichier dans un composant client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables for admin client');
}

export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
