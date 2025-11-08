'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function CallbackHandler() {
  const router = useRouter();
  const [status, setStatus] = useState('Connexion en cours...');

  useEffect(() => {
    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCallback() {
    try {
      // Attendre que Supabase détecte le hash
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error('Pas de session:', sessionError);
        setStatus('Erreur de connexion');
        setTimeout(() => router.push('/auth/login'), 2000);
        return;
      }

      console.log('✅ Session trouvée:', session.user.email);
      setStatus('Session créée...');

      // Attendre que le trigger crée le profil (3 secondes max)
      let profile = null;
      let attempts = 0;
      
      while (!profile && attempts < 6) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data } = await supabase.rpc('get_current_user_safe');
        
        // @ts-ignore - RPC types not properly generated
        if (data && Array.isArray(data) && (data as any[]).length > 0) {
          profile = (data as any[])[0];
          break;
        }
        attempts++;
      }

      if (!profile) {
        console.error('❌ Profil non créé par trigger, création manuelle...');
        setStatus('Création du profil...');
        
        // Fallback: appeler sync_current_user
        await supabase.rpc('sync_current_user');

        // Recharger le profil via RPC
        const { data: newProfile } = await supabase.rpc('get_current_user_safe');
        
        profile = newProfile && (newProfile as any).length > 0 ? (newProfile as any)[0] : null;
      }

      if (profile) {
        console.log('✅ Profil chargé:', (profile as any).email, 'Role:', (profile as any).role);
        setStatus('Connexion réussie !');
      }

      // Redirection vers page d'accueil (pas dashboard pour éviter race condition)
      await new Promise(resolve => setTimeout(resolve, 500));
      window.location.href = '/';
      
    } catch (err: any) {
      console.error('❌ Erreur callback:', err);
      setStatus('Erreur: ' + err.message);
      setTimeout(() => router.push('/auth/login'), 2000);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-700 font-medium">{status}</p>
      </div>
    </div>
  );
}