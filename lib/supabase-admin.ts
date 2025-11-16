import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// ================================================================
// 🔒 SUPABASE ADMIN CLIENT (SERVICE ROLE)
// ================================================================
// ⚠️ CRITIQUE: Ne JAMAIS importer ce fichier côté client !
// 
// Usage autorisé UNIQUEMENT dans:
// - /app/api/* routes (Next.js API routes)
// - Server Actions (Next.js 13+)
// - Scripts Node.js côté serveur
// 
// Bypass RLS: Ce client a tous les droits sur la DB
// ================================================================

// Runtime check: interdire usage côté client
if (typeof window !== 'undefined') {
  throw new Error(
    '🚨 SECURITY VIOLATION: supabaseAdmin cannot be used on client-side! ' +
    'Use import { supabase } from "@/lib/supabase/client" instead.'
  );
}

// Lazy initialization pour éviter les erreurs de build
let _supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) {
    return _supabaseAdmin;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('URL:', supabaseUrl ? 'OK' : 'manquante');
    console.error('Key:', serviceRoleKey ? 'OK' : 'manquante');
    throw new Error(
      '❌ Missing Supabase environment variables for admin client. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env'
    );
  }

  _supabaseAdmin = createClient<Database>(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    }
  );

  return _supabaseAdmin;
}

// Export un proxy qui initialise lazy
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop) {
    const client = getSupabaseAdmin();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// ================================================================
// Helper: Vérifier que l'utilisateur est bien admin
// ================================================================
export async function requireAdmin(userId: string) {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !user || (user as any).role !== 'admin_asso') {
    throw new Error('Unauthorized: Admin access required');
  }

  return user;
}

// ================================================================
// Helper: Log d'audit pour actions sensibles
// ================================================================
// TODO: Créer table audit_logs dans migration 03
export async function logAdminAction(
  action: string,
  actorId: string,
  metadata?: Record<string, any>
) {
  console.log('[AUDIT]', { action, actorId, metadata, timestamp: new Date().toISOString() });
  // await supabaseAdmin.from('audit_logs').insert({
  //   action,
  //   actor_id: actorId,
  //   metadata: metadata || {},
  //   created_at: new Date().toISOString(),
  // });
}


