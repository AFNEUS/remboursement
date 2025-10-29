'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

export default function AuthButton() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Récupérer session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Écouter changements auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error('Erreur connexion:', error);
      alert('Erreur de connexion : ' + error.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('test_user');
    localStorage.removeItem('test_role');
    window.dispatchEvent(new Event('storage')); // Déclencher re-render Navigation
    window.location.href = '/';
  };

  const handleTestLogin = () => {
    const testUser = {
      id: 'test-user-123',
      email: 'test@afneus.fr',
      user_metadata: { full_name: 'Utilisateur Test' }
    };
    localStorage.setItem('test_user', JSON.stringify(testUser));
    localStorage.setItem('test_role', 'user');
    setUser(testUser);
    window.dispatchEvent(new Event('storage')); // Déclencher re-render Navigation
  };

  const handleTestAdminLogin = () => {
    const testAdmin = {
      id: 'test-admin-456',
      email: 'admin@afneus.fr',
      user_metadata: { full_name: 'Admin Test' }
    };
    localStorage.setItem('test_user', JSON.stringify(testAdmin));
    localStorage.setItem('test_role', 'treasurer');
    setUser(testAdmin);
    window.dispatchEvent(new Event('storage')); // Déclencher re-render Navigation
  };

  useEffect(() => {
    // Charger utilisateur test si existe
    const testUser = localStorage.getItem('test_user');
    if (testUser && !user) {
      setUser(JSON.parse(testUser));
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-200 h-10 w-32 rounded"></div>
    );
  }

  if (user) {
    const role = localStorage.getItem('test_role');
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow">
          <div className={`w-8 h-8 ${role === 'treasurer' ? 'bg-orange-600' : 'bg-blue-600'} rounded-full flex items-center justify-center text-white font-bold`}>
            {user.email?.[0].toUpperCase()}
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-medium">
              {user.email?.split('@')[0]}
            </div>
            {role && (
              <div className="text-xs text-gray-500">
                {role === 'treasurer' ? '👑 Admin/Trésorier' : '👤 Utilisateur'}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
        >
          Déconnexion
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleTestLogin}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm"
      >
        🧪 Mode Utilisateur
      </button>
      <button
        onClick={handleTestAdminLogin}
        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold text-sm"
      >
        👑 Mode Admin
      </button>
      <button
        onClick={handleSignIn}
        className="flex items-center gap-2 px-6 py-2 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition font-semibold"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Google
      </button>
    </div>
  );
}
