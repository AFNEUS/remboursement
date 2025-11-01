'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function CallbackHandler() {
  const router = useRouter();
  const [status, setStatus] = useState('🔄 Connexion en cours...');

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      setStatus('🔄 Récupération de la session...');
      
      // getSession() lit automatiquement le hash fragment
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Erreur session:', error);
        setStatus('❌ Erreur : ' + error.message);
        setTimeout(() => router.push('/auth/login'), 2000);
        return;
      }

      if (!session || !session.user) {
        console.error('❌ Pas de session');
        setStatus('❌ Pas de session trouvée');
        setTimeout(() => router.push('/auth/login'), 2000);
        return;
      }

      console.log('✅ Session OK:', session.user.email);
      setStatus('✅ Session créée pour ' + session.user.email);

      // Vérifier/créer le profil
      setStatus('🔍 Vérification du profil...');
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!profile) {
        console.log('⚠️ Profil non trouvé, création...');
        setStatus('⚙️ Création du profil...');
        
        const email = session.user.email || '';
        const role = email === 'mohameddhia.ounally@afneus.org' ? 'ADMIN' : 'MEMBER';
        
        // @ts-ignore
        const { error: insertError } = await supabase.from('users').insert({
          id: session.user.id,
          email,
          first_name: session.user.user_metadata?.first_name || session.user.user_metadata?.name?.split(' ')[0] || '',
          last_name: session.user.user_metadata?.last_name || session.user.user_metadata?.name?.split(' ').slice(1).join(' ') || '',
          role,
          status: 'ACTIVE',
        });

        if (insertError) {
          console.error('❌ Erreur création profil:', insertError);
        } else {
          console.log('✅ Profil créé avec role:', role);
        }
      } else {
        // @ts-ignore
        console.log('✅ Profil existant:', profile.email, profile.role);
      }

      setStatus('✅ Redirection...');
      
      // Redirection immédiate
      router.push('/dashboard');
      router.refresh();

    } catch (error: any) {
      console.error('❌ Exception:', error);
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
        <p className="text-xs text-gray-400 mt-4">Ouvrez la console (F12) pour voir les logs</p>
      </div>
    </div>
  );
}
