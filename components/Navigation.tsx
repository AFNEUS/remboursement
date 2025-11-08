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
  const [activeRole, setActiveRole] = useState<string | null>(null); // Rôle actif pour la vue
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    checkUser();
    
    // S'abonner aux changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔄 Auth state changed:', _event, session?.user?.email);
      if (_event === 'SIGNED_OUT') {
        setUser(null);
        setUserRole(null);
        setProfileChecked(false);
      } else if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
        checkUser();
      }
    });
    
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkUser() {
    try {
      // Vérifier le mode test
      const testUser = localStorage.getItem('test_user');
      if (testUser) {
        const parsed = JSON.parse(testUser);
        setUser(parsed);
        setUserRole(parsed.role || 'MEMBER');
        setProfileChecked(true);
        setLoading(false);
        return;
      }

      // Vérifier l'authentification Supabase avec getSession()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Erreur getSession:', sessionError);
        setUser(null);
        setUserRole(null);
        setProfileChecked(true);
        setLoading(false);
        return;
      }
      
      if (session?.user) {
        const authUser = session.user;

        // UTILISER RPC pour bypasser RLS (table users n'a pas de RLS, mais sécurisé via RPC)
        const { data: userData, error: userError } = await supabase
          .rpc('get_current_user_safe');

        if (!userError && userData && userData.length > 0) {
          const dbUser = userData[0];
          
          // Mapper le rôle DB (lowercase) vers UI (uppercase)
          const mappedRole = ({
            'admin_asso': 'ADMIN',
            'treasurer': 'TREASURER',
            'validator': 'VALIDATOR',
            'bn_member': 'BN',
            'user': 'MEMBER'
          }[dbUser.role] || 'MEMBER');

          setUser({
            id: dbUser.id,
            email: dbUser.email || authUser.email,
            full_name: dbUser.full_name,
            first_name: dbUser.first_name,
            last_name: dbUser.last_name,
            status: dbUser.status,
            role: mappedRole,
          });
          setUserRole(mappedRole);
          setProfileChecked(true);
        } else if (!profileChecked) {
          // SEULEMENT si jamais vérifié, tenter un sync UNIQUE
          console.warn('⚠️ Première connexion: sync_current_user...');
          const { error: syncError } = await supabase.rpc('sync_current_user');
          setProfileChecked(true);
          
          if (!syncError) {
            // Retry avec RPC
            const { data: retryData } = await supabase.rpc('get_current_user_safe');
            if (retryData && retryData.length > 0) {
              const dbUser = retryData[0];
              const mappedRole = ({
                'admin_asso': 'ADMIN',
                'treasurer': 'TREASURER',
                'validator': 'VALIDATOR',
                'bn_member': 'BN',
                'user': 'MEMBER'
              }[dbUser.role] || 'MEMBER');

              setUser({
                id: dbUser.id,
                email: dbUser.email || authUser.email,
                full_name: dbUser.full_name,
                first_name: dbUser.first_name,
                last_name: dbUser.last_name,
                status: dbUser.status,
                role: mappedRole,
              });
              setUserRole(mappedRole);
            } else {
              // Fallback minimal
              setUser({ email: authUser.email, id: authUser.id, full_name: authUser.email.split('@')[0] });
              setUserRole('MEMBER');
            }
          } else {
            console.error('❌ Sync failed:', syncError);
            setUser({ email: authUser.email, id: authUser.id, full_name: authUser.email.split('@')[0] });
            setUserRole('MEMBER');
          }
        } else {
          // Profil déjà checké mais toujours pas de user row: fallback minimal
          setUser({ email: authUser.email, id: authUser.id, full_name: authUser.email.split('@')[0] });
          setUserRole('MEMBER');
        }
      } else {
        setUser(null);
        setUserRole(null);
        setProfileChecked(true);
      }
    } catch (error) {
      console.error('❌ Exception checkUser:', error);
      setUser(null);
      setUserRole(null);
      setProfileChecked(true);
    }
    setLoading(false);
  }

    async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem('test_user');
    setUser(null);
    setUserRole(null);
    setActiveRole(null);
    router.push('/');
    setTimeout(() => router.refresh(), 100);
  }

  function switchRole(role: string) {
    setActiveRole(role);
    // Rediriger vers la page d'accueil du nouveau rôle
    if (role === 'ADMIN') {
      router.push('/admin');
    } else if (role === 'VALIDATOR') {
      router.push('/validator');
    } else if (role === 'TREASURER') {
      router.push('/treasurer');
    } else {
      router.push('/dashboard');
    }
  }

  // Synchroniser activeRole avec userRole
  useEffect(() => {
    if (userRole && !activeRole) {
      setActiveRole(userRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  // Permissions basées sur le rôle actif (vue courante)
  const effectiveRole = activeRole || userRole;
  const canAccessDashboard = effectiveRole && ['ADMIN', 'TREASURER', 'VALIDATOR', 'BN', 'MEMBER'].includes(effectiveRole);
  const canValidate = effectiveRole && ['ADMIN', 'VALIDATOR', 'TREASURER'].includes(effectiveRole);
  const canAccessTreasurer = effectiveRole && ['ADMIN', 'TREASURER'].includes(effectiveRole);
  const isAdmin = userRole === 'ADMIN'; // Vrai rôle (pour afficher le switch uniquement)
  const isViewingAsAdmin = effectiveRole === 'ADMIN'; // Vue actuelle

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

              {isViewingAsAdmin && (
                <button
                  onClick={() => router.push('/admin')}
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
              {/* Switch de rôle (admin only) */}
              {isAdmin && (
                <div className="relative ml-2">
                  <select
                    value={activeRole || ''}
                    onChange={(e) => switchRole(e.target.value)}
                    className="px-3 py-2 rounded-lg font-semibold bg-white/20 text-white border border-white/30 hover:bg-white/30 transition cursor-pointer"
                    title="Changer de vue"
                  >
                    <option value="ADMIN" className="text-gray-900">👑 Vue Admin</option>
                    <option value="VALIDATOR" className="text-gray-900">✅ Vue Validateur</option>
                    <option value="TREASURER" className="text-gray-900">💰 Vue Trésorier</option>
                    <option value="MEMBER" className="text-gray-900">👥 Vue Membre</option>
                  </select>
                </div>
              )}

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
                  <div className="hidden lg:flex flex-col items-start text-left">
                    <span className="text-sm font-bold">
                      {(user as any).full_name || `${(user as any).first_name || ''} ${(user as any).last_name || ''}`.trim() || user.email?.split('@')[0]}
                    </span>
                    <span className="text-xs opacity-80">
                      {effectiveRole === 'ADMIN' ? '👑 Super Admin' : 
                       effectiveRole === 'BN' ? '⭐ Bureau National' :
                       effectiveRole === 'TREASURER' ? '💰 Trésorier' :
                       effectiveRole === 'VALIDATOR' ? '✅ Validateur' :
                       '👥 Membre'}
                      {isAdmin && activeRole && activeRole !== userRole && (
                        <span className="ml-1 text-yellow-300">• Vue</span>
                      )}
                    </span>
                  </div>
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
            {/* User info header for mobile */}
            <div className="px-4 py-3 mb-2 bg-white/10 rounded-lg">
              <div className="font-bold text-white">
                {(user as any).full_name || `${(user as any).first_name || ''} ${(user as any).last_name || ''}`.trim() || user.email?.split('@')[0]}
              </div>
              <div className="text-sm font-semibold text-white">
                {effectiveRole === 'ADMIN' ? '👑 Super Admin' : 
                 effectiveRole === 'BN' ? '⭐ Bureau National' :
                 effectiveRole === 'TREASURER' ? '💰 Trésorier' :
                 effectiveRole === 'VALIDATOR' ? '✅ Validateur' :
                 '👥 Membre'}
                {isAdmin && activeRole && activeRole !== userRole && (
                  <span className="ml-2 text-yellow-300 text-xs">• Vue seulement</span>
                )}
              </div>
              <div className="text-xs text-white/60 mt-1">{user.email}</div>
            </div>

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

              {isViewingAsAdmin && (
                <button
                  onClick={() => {
                    router.push('/admin');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg font-semibold text-white hover:bg-white/10 transition"
                >
                  👑 Admin
                </button>
              )}
              
              {isAdmin && (
                <div className="border-t border-white/20 mt-2 pt-2">
                  <label className="text-xs text-white/60 px-4 block mb-2">Changer de vue :</label>
                  <select
                    value={activeRole || userRole || ''}
                    onChange={(e) => {
                      switchRole(e.target.value);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 rounded-lg font-semibold bg-white/20 text-white border border-white/30 hover:bg-white/30 transition"
                  >
                    <option value="ADMIN" className="text-gray-900">👑 Vue Admin</option>
                    <option value="VALIDATOR" className="text-gray-900">✅ Vue Validateur</option>
                    <option value="TREASURER" className="text-gray-900">💰 Vue Trésorier</option>
                    <option value="MEMBER" className="text-gray-900">👥 Vue Membre</option>
                  </select>
                </div>
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
