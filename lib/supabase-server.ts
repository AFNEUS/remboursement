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
export async function requireRole(role: 'member' | 'validator' | 'treasurer' | 'admin') {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Non authentifié');
  }

  if (user.role !== role && user.role !== 'admin') {
    throw new Error('Accès non autorisé');
  }

  return user;
}
