import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from './database.types';

// Helper pour obtenir le client Supabase côté serveur (Server Components)
export function getServerSupabase() {
  const cookieStore = cookies();
  return createServerComponentClient<Database>({ cookies: () => cookieStore });
}

// Helper pour obtenir l'utilisateur courant côté serveur
export async function getCurrentUser() {
  const supabase = getServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    return null;
  }

  // Récupérer les infos complètes de l'utilisateur depuis la table users
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  return user;
}

// Helper pour vérifier si l'utilisateur a un rôle spécifique
// Accepte les rôles en lowercase (DB) ou uppercase (UI)
export async function requireRole(role: 'user' | 'validator' | 'treasurer' | 'admin_asso' | 'bn_member' | 'ADMIN' | 'VALIDATOR' | 'TREASURER' | 'BN' | 'MEMBER') {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Non authentifié');
  }

  // Mapper les rôles UI vers DB si nécessaire
  const roleMap: Record<string, string> = {
    'ADMIN': 'admin_asso',
    'VALIDATOR': 'validator',
    'TREASURER': 'treasurer',
    'BN': 'bn_member',
    'MEMBER': 'user',
  };

  const normalizedRole = roleMap[role] || role;
  const normalizedUserRole = roleMap[user.role] || user.role;

  // Admin a tous les accès
  if (normalizedUserRole === 'admin_asso') {
    return user;
  }

  if (normalizedUserRole !== normalizedRole) {
    throw new Error('Accès non autorisé');
  }

  return user;
}
