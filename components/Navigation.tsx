// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Image from 'next/image';

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkUser();
    
    // S'abonner aux changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔄 Auth state changed:', _event, session?.user?.email);
      checkUser();
    });
    
    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    try {
      // Vérifier le mode test
      const testUser = localStorage.getItem('test_user');
      if (testUser) {
        const parsed = JSON.parse(testUser);
        setUser(parsed);
        setUserRole(parsed.role);
        setLoading(false);
        return;
      }

      // Vérifier l'authentification Supabase avec getSession() au lieu de getUser()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Erreur getSession:', sessionError);
        setUser(null);
        setUserRole(null);
        setLoading(false);
        return;
      }
      
      if (session?.user) {
        const authUser = session.user;
        console.log('✅ Session trouvée:', authUser.email);

        // 1) Essayer de charger la vue user_profile (rôle mappé + full_name)
        let { data: profile, error: profileError } = await supabase
          .from('user_profile')
          .select('*')
          .single();

        // 2) Si la vue ne renvoie rien (profil pas encore backfill), synchroniser puis relire
        if (profileError || !profile) {
          console.warn('ℹ️ user_profile introuvable, tentative de sync_current_user');
          await supabase.rpc('sync_current_user').catch(() => {});
          const retried = await supabase.from('user_profile').select('*').single();
          profile = retried.data || null;
        }

        if (profile) {
          setUser({
            id: authUser.id,
            email: profile.email || authUser.email,
            full_name: profile.full_name,
            first_name: profile.first_name,
            last_name: profile.last_name,
            status: profile.status_code,
          });
          setUserRole(profile.role); // Déjà mappé: ADMIN/TREASURER/VALIDATOR/BN/MEMBER
        } else {
          // Fallback minimal
          setUser({ email: authUser.email, id: authUser.id });
          setUserRole(null);
        }
      } else {
        console.log('⚠️ Aucune session active');
        setUser(null);
        setUserRole(null);
      }
    } catch (error) {
      console.error('❌ Exception checkUser:', error);
      setUser(null);
      setUserRole(null);
    }
    setLoading(false);
  }

  async function handleLogout() {
    localStorage.removeItem('test_user');
    await supabase.auth.signOut();
    setUser(null);
    setUserRole(null);
    router.push('/');
    setTimeout(() => router.refresh(), 100);
  }

  // Permissions
  const canAccessDashboard = userRole && ['ADMIN', 'TREASURER', 'VALIDATOR'].includes(userRole);
  const canValidate = userRole && ['ADMIN', 'VALIDATOR', 'TREASURER'].includes(userRole);
  const canAccessTreasurer = userRole && ['ADMIN', 'TREASURER'].includes(userRole);
  const isAdmin = userRole === 'ADMIN';

  const isActive = (path: string) => pathname === path;

  // Ne pas afficher la navbar sur la page de login
  if (pathname === '/auth/login' || pathname === '/auth/callback') {
    return null;
  }

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 font-bold text-xl hover:text-blue-100 transition"
          >
            <Image 
              src="/logo-afneus.png" 
              alt="AFNEUS Logo" 
              width={40} 
              height={40}
              className="rounded-lg bg-white/20 p-1"
            />
            <span className="hidden sm:inline">AFNEUS</span>
          </button>

          {/* Desktop Menu */}
          {!loading && user && (
            <div className="hidden md:flex items-center gap-1">
              <button
                onClick={() => router.push('/claims/new')}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  isActive('/claims/new')
                    ? 'bg-white text-blue-600'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                📝 Nouvelle
              </button>

              <button
                onClick={() => router.push('/claims')}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  isActive('/claims')
                    ? 'bg-white text-blue-600'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                📋 Demandes
              </button>

              {canAccessDashboard && (
                <button
                  onClick={() => router.push('/dashboard')}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    isActive('/dashboard')
                      ? 'bg-white text-blue-600'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  📊 Dashboard
                </button>
              )}

              {canValidate && (
                <button
                  onClick={() => router.push('/validator')}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    isActive('/validator')
                      ? 'bg-white text-blue-600'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  ✅ Validation
                </button>
              )}

              {canAccessTreasurer && (
                <button
                  onClick={() => router.push('/treasurer')}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    isActive('/treasurer')
                      ? 'bg-white text-blue-600'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  💰 Trésorerie
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => router.push('/admin/events')}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    pathname?.startsWith('/admin')
                      ? 'bg-white text-blue-600'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  👑 Admin
                </button>
              )}

              {/* Profil dropdown */}
              <div className="relative ml-2">
                <button
                  onClick={() => router.push('/profile')}
                  className={`px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 ${
                    isActive('/profile')
                      ? 'bg-white text-blue-600'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <span>👤</span>
                  <span className="hidden lg:inline text-sm">
                    {(user as any).full_name || (user as any).first_name || user.email?.split('@')[0]}
                  </span>
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg font-semibold text-white hover:bg-red-500/20 transition ml-2"
                title="Déconnexion"
              >
                🚪
              </button>
            </div>
          )}

          {!loading && !user && (
            <button
              onClick={() => router.push('/auth/login')}
              className="px-6 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition"
            >
              🔐 Se connecter
            </button>
          )}

          {/* Mobile Menu Button */}
          {!loading && user && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg text-2xl"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          )}
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && user && (
          <div className="md:hidden py-4 border-t border-white/20">
            <div className="flex flex-col gap-1">
              <button
                onClick={() => {
                  router.push('/claims/new');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg font-semibold text-white hover:bg-white/10 transition"
              >
                📝 Nouvelle Demande
              </button>

              <button
                onClick={() => {
                  router.push('/claims');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg font-semibold text-white hover:bg-white/10 transition"
              >
                📋 Mes Demandes
              </button>

              {canAccessDashboard && (
                <button
                  onClick={() => {
                    router.push('/dashboard');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg font-semibold text-white hover:bg-white/10 transition"
                >
                  📊 Dashboard
                </button>
              )}

              {canValidate && (
                <button
                  onClick={() => {
                    router.push('/validator');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg font-semibold text-white hover:bg-white/10 transition"
                >
                  ✅ Validation
                </button>
              )}

              {canAccessTreasurer && (
                <button
                  onClick={() => {
                    router.push('/treasurer');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg font-semibold text-white hover:bg-white/10 transition"
                >
                  💰 Trésorerie
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => {
                    router.push('/admin/events');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg font-semibold text-white hover:bg-white/10 transition"
                >
                  👑 Admin
                </button>
              )}

              <button
                onClick={() => {
                  router.push('/profile');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg font-semibold text-white hover:bg-white/10 transition"
              >
                👤 Profil
              </button>

              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 rounded-lg font-semibold text-white hover:bg-red-500/20 transition border-t border-white/20 mt-2"
              >
                🚪 Déconnexion
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
