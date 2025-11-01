'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function CallbackHandler() {
  const router = useRouter();
  const [status, setStatus] = useState('Démarrage...');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(msg);
    setLogs(prev => [...prev, msg]);
  };

  useEffect(() => {
    addLog('START CallbackHandler');
    addLog('URL: ' + window.location.href);
    addLog('Hash: ' + window.location.hash);
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      setStatus('Lecture session...');
      addLog('1. Appel getSession()...');
      
      const { data, error } = await supabase.auth.getSession();
      
      addLog('2. getSession() terminé');
      addLog('Session: ' + (data.session ? 'EXISTS' : 'NULL'));
      addLog('Error: ' + (error ? error.message : 'none'));

      if (error) {
        addLog('ERREUR SESSION: ' + error.message);
        setStatus('Erreur: ' + error.message);
        return;
      }

      if (!data.session) {
        addLog('PAS DE SESSION - Essai onAuthStateChange...');
        setStatus('Pas de session - Tentative recuperation...');
        
        supabase.auth.onAuthStateChange((event, session) => {
          addLog('AuthStateChange Event: ' + event);
          if (session) {
            addLog('Session recuperee via event');
            createProfileAndRedirect(session);
          }
        });
        
        setTimeout(() => {
          addLog('Timeout - redirect login');
          router.push('/auth/login?error=Pas+de+session');
        }, 5000);
        return;
      }

      addLog('SESSION OK: ' + data.session.user.email);
      setStatus('Session: ' + data.session.user.email);
      
      await createProfileAndRedirect(data.session);

    } catch (err: any) {
      addLog('EXCEPTION: ' + err.message);
      setStatus('Exception: ' + err.message);
    }
  }

  async function createProfileAndRedirect(session: any) {
    try {
      addLog('4. Check profil...');
      setStatus('Verification profil...');

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      addLog('Profile: ' + (profile ? 'EXISTS' : 'NULL'));

      if (!profile) {
        addLog('5. Creation profil...');
        setStatus('Creation profil...');

        const email = session.user.email || '';
        const role = email === 'mohameddhia.ounally@afneus.org' ? 'ADMIN' : 'MEMBER';
        
        addLog('Email: ' + email);
        addLog('Role: ' + role);

        // @ts-ignore
        const { error: insertError } = await supabase.from('users').insert({
          id: session.user.id,
          email,
          first_name: session.user.user_metadata?.name?.split(' ')[0] || '',
          last_name: session.user.user_metadata?.name?.split(' ').slice(1).join(' ') || '',
          role,
          status: 'ACTIVE',
        });

        if (insertError) {
          addLog('ERREUR INSERT: ' + insertError.message);
        } else {
          addLog('Profil cree');
        }
      } else {
        addLog('Profil existe');
      }

      addLog('6. Redirection /dashboard');
      setStatus('Redirection...');
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);

    } catch (err: any) {
      addLog('EXCEPTION createProfile: ' + err.message);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Debug OAuth</h1>
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <p className="text-xl">{status}</p>
        </div>
        <div className="bg-black rounded-lg p-4 font-mono text-sm">
          <div className="text-green-400 mb-2">Logs:</div>
          {logs.map((log, i) => (
            <div key={i} className="text-gray-300 mb-1">{log}</div>
          ))}
        </div>
        <div className="mt-4 text-sm text-gray-400">
          <p>URL: {typeof window !== 'undefined' ? window.location.href : 'loading...'}</p>
          <p>Hash: {typeof window !== 'undefined' ? window.location.hash : 'loading...'}</p>
        </div>
      </div>
    </div>
  );
}
