'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function CallbackHandler() {
  const router = useRouter();
  const [status, setStatus] = useState('Connexion en cours...');

  useEffect(() => {
    async function handleCallback() {
      try {
        // ATTENDRE que Supabase gère automatiquement le hash
        // Il détecte le #access_token et crée la session
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session error:', error);
          setStatus('Erreur de connexion');
          setTimeout(() => router.push('/auth/login'), 2000);
          return;
        }

        if (!session) {
          console.log('Pas de session, attente...');
          setStatus('Récupération de la session...');
          
          // Attendre l'event onAuthStateChange
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, newSession: any) => {
            console.log('Auth event:', event);
            
            if (newSession && event === 'SIGNED_IN') {
              console.log('Session créée:', newSession.user.email);
              
              // Vérifier/créer le profil
              const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('id', newSession.user.id)
                .single();

              if (!profile) {
                // @ts-ignore
                await supabase.from('users').insert({
                  id: newSession.user.id,
                  email: newSession.user.email!,
                  full_name: newSession.user.user_metadata?.full_name || newSession.user.email!.split('@')[0],
                  role: 'USER',
                });
              }

              subscription.unsubscribe();
              router.push('/dashboard');
            }
          });
          
          return;
        }

        // Session existe déjà
        console.log('Session trouvée:', session.user.email);
        
        // Vérifier/créer le profil
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!profile) {
          setStatus('Création du profil...');
          // @ts-ignore
          await supabase.from('users').insert({
            id: session.user.id,
            email: session.user.email!,
            full_name: session.user.user_metadata?.full_name || session.user.email!.split('@')[0],
            role: 'USER',
          });
        }

        setStatus('Connexion réussie !');
        router.push('/dashboard');

      } catch (err: any) {
        console.error('Callback error:', err);
        setStatus('Erreur: ' + err.message);
        setTimeout(() => router.push('/auth/login'), 2000);
      }
    }

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-700">{status}</p>
      </div>
    </div>
  );
}