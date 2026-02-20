'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AuthButton() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-10 w-32 rounded"></div>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
            {(user.email?.[0] ?? '?').toUpperCase()}
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-medium">
              {user.email?.split('@')[0]}
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Déconnexion
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => router.push('/auth/login')}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
    >
      Se connecter
    </button>
  );
}
