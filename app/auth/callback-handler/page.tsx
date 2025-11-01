'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function CallbackHandler() {
  const router = useRouter();
  const [status, setStatus] = useState('Connexion en cours...');

  useEffect(() => {
    handleCallback();
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
        
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (data) {
          profile = data;
          break;
        }
        attempts++;
      }

      if (!profile) {
        console.error('❌ Profil non créé par trigger, création manuelle...');
        setStatus('Création du profil...');
        
        // Fallback: créer manuellement avec RPC
        const fullName = session.user.user_metadata?.full_name || 
                        session.user.user_metadata?.name || 
                        session.user.email!.split('@')[0];
        const nameParts = fullName.split(' ');
        
        // @ts-ignore
        await supabase.rpc('create_user_profile', {
          user_id: session.user.id,
          user_email: session.user.email!,
          user_first_name: nameParts[0] || 'User',
          user_last_name: nameParts.slice(1).join(' ') || nameParts[0],
        });

        // Recharger le profil
        const { data: newProfile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        profile = newProfile;
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