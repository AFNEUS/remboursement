'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      // Récupérer le code OAuth depuis l'URL
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) throw error;

      if (data.session) {
        // Rediriger vers le dashboard
        router.push('/dashboard');
      } else {
        // Pas de session, rediriger vers login
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Erreur callback:', error);
      router.push('/auth/login?error=callback_failed');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block p-4 bg-blue-600 rounded-2xl mb-6">
          <h1 className="text-4xl font-bold text-white">AFNEUS</h1>
        </div>
        <div className="text-xl font-semibold mb-4">Connexion en cours...</div>
        <div className="flex items-center justify-center gap-2">
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}
