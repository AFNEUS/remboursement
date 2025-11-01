'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function CallbackHandler() {
  const router = useRouter();
  const [status, setStatus] = useState('Connexion en cours...');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(msg);
    setLogs(prev => [...prev, msg]);
  };

  useEffect(() => {
    async function handleCallback() {
      try {
        addLog('🔄 Démarrage callback handler');
        
        // Supabase détecte automatiquement le hash (#access_token)
        // On attend qu'il finisse de traiter
        addLog('⏳ Attente traitement Supabase (2s)...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        addLog('🔍 Vérification session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          addLog(`❌ Erreur session: ${sessionError.message}`);
          setStatus('Erreur de connexion');
          setTimeout(() => router.push('/auth/login'), 2000);
          return;
        }

        if (!session) {
          addLog('⚠️ Pas de session immédiate, attente event...');
          setStatus('Récupération de la session...');
          
          // Écouter l'event SIGNED_IN
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, newSession: any) => {
            addLog(`📡 Event: ${event}`);
            
            if (event === 'SIGNED_IN' && newSession) {
              addLog(`✅ Session créée: ${newSession.user.email}`);
              
              // Créer le profil si nécessaire
              await ensureProfile(newSession.user);
              
              subscription.unsubscribe();
              addLog('🚀 Redirection dashboard...');
              router.push('/dashboard');
            }
          });
          
          // Timeout si rien après 10s
          setTimeout(() => {
            addLog('⏱️ Timeout - pas de session');
            subscription.unsubscribe();
            router.push('/auth/login');
          }, 10000);
          
          return;
        }

        // Session existe immédiatement
        addLog(`✅ Session trouvée: ${session.user.email}`);
        
        // Créer le profil si nécessaire
        await ensureProfile(session.user);
        
        addLog('🚀 Redirection dashboard...');
        setStatus('Connexion réussie !');
        router.push('/dashboard');

      } catch (err: any) {
        addLog(`💥 Erreur: ${err.message}`);
        console.error('Callback error:', err);
        setStatus('Erreur: ' + err.message);
        setTimeout(() => router.push('/auth/login'), 2000);
      }
    }

    async function ensureProfile(user: any) {
      addLog('👤 Vérification profil...');
      
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        addLog(`⚠️ Erreur vérification profil: ${profileError.message}`);
      }

      if (!profile) {
        addLog('📝 Création profil via RPC...');
        setStatus('Création du profil...');
        
        // Extraire prénom/nom depuis Google ou email
        const fullName = user.user_metadata?.full_name || user.email!.split('@')[0];
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // Utiliser la fonction RPC qui bypass RLS
        // @ts-ignore
        const { error: rpcError } = await supabase.rpc('create_user_profile', {
          user_id: user.id,
          user_email: user.email!,
          user_first_name: firstName,
          user_last_name: lastName || firstName,
        });

        if (rpcError) {
          addLog(`❌ Erreur RPC: ${rpcError.message}`);
          // Pas grave, on continue quand même (peut-être déjà créé)
        } else {
          addLog('✅ Profil créé via RPC');
        }
      } else {
        addLog('✅ Profil existe déjà');
      }
    }

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-700 font-medium">{status}</p>
        </div>
        
        {logs.length > 0 && (
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs max-h-96 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="mb-1">{log}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}