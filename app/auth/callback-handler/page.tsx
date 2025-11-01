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
      // Supabase gère automatiquement le hash fragment (#access_token=...)
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Erreur session:', error);
        setStatus('❌ Erreur de connexion');
        setTimeout(() => router.push('/auth/login?error=Session+invalide'), 2000);
        return;
      }

      if (!session) {
        setStatus('❌ Pas de session');
        setTimeout(() => router.push('/auth/login?error=Pas+de+session'), 2000);
        return;
      }

      // Vérifier que le profil existe
      const { data: profile } = await supabase
        .from('users')
        .select('id, email, role, status')
        .eq('id', session.user.id)
        .single();

      if (!profile) {
        setStatus('⏳ Création du profil...');
        
        // Attendre que le trigger crée le profil
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { data: retryProfile } = await supabase
          .from('users')
          .select('id, email, role, status')
          .eq('id', session.user.id)
          .single();

        if (!retryProfile) {
          // Créer le profil manuellement
          const email = session.user.email || '';
          const role = email === 'mohameddhia.ounally@afneus.org' ? 'ADMIN' : 'MEMBER';
          
          // @ts-ignore
          await supabase.from('users').insert({
            id: session.user.id,
            email,
            first_name: session.user.user_metadata?.first_name || '',
            last_name: session.user.user_metadata?.last_name || '',
            role,
            status: 'ACTIVE',
          });
        }
      }

      setStatus('✅ Connexion réussie !');
      
      // Rediriger vers le dashboard
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 500);

    } catch (error: any) {
      console.error('Erreur callback:', error);
      setStatus('❌ Erreur : ' + error.message);
      setTimeout(() => router.push('/auth/login'), 3000);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">AFNEUS Remboursement</h2>
        <p className="text-gray-600 text-lg">{status}</p>
      </div>
    </div>
  );
}
