'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Image from 'next/image';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Afficher erreur si présente dans URL
    const error = searchParams.get('error');
    if (error) {
      setErrorMessage(decodeURIComponent(error));
    }
  }, [searchParams]);

  async function handleGoogleLogin() {
    try {
      setLoading(true);
      setErrorMessage('');
      
      console.log('🚀 Démarrage Google OAuth...');
      console.log('📍 Redirect URL:', `${window.location.origin}/auth/callback`);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('❌ Erreur signInWithOAuth:', error);
        throw error;
      }
      
      console.log('✅ OAuth data:', data);
      // La redirection se fait automatiquement vers Google
    } catch (error: any) {
      console.error('❌ Exception Google login:', error);
      setErrorMessage(error.message || 'Erreur de connexion avec Google');
      setLoading(false);
    }
  }

  async function handleEmailSignup() {
    if (!email || !password || !firstName || !lastName) {
      alert('⚠️ Veuillez remplir tous les champs');
      return;
    }

    if (password.length < 6) {
      alert('⚠️ Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      if (data.user?.identities?.length === 0) {
        alert('⚠️ Cet email est déjà utilisé. Essayez de vous connecter.');
        setMode('login');
        setLoading(false);
        return;
      }

      alert('✅ Compte créé ! Veuillez vérifier votre email pour confirmer votre inscription.');
      setMode('login');
      setLoading(false);
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
      setLoading(false);
    }
  }

  async function handleEmailLogin() {
    if (!email || !password) {
      alert('⚠️ Veuillez remplir tous les champs');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      alert('✅ Connexion réussie !');
      router.push('/dashboard');
    } catch (error: any) {
      if (error.message.includes('Invalid login credentials')) {
        alert('❌ Email ou mot de passe incorrect');
      } else if (error.message.includes('Email not confirmed')) {
        alert('⚠️ Veuillez confirmer votre email avant de vous connecter');
      } else {
        alert(`❌ Erreur: ${error.message}`);
      }
      setLoading(false);
    }
  }

  async function handleTestMode() {
    localStorage.setItem('test_user', JSON.stringify({
      id: 'test-user-' + Date.now(),
      email: 'test@afneus.org',
      role: 'MEMBER',
      status_code: 'APPRENANT',
      first_name: 'Test',
      last_name: 'User'
    }));
    alert('✅ Mode test activé !');
    router.push('/dashboard');
  }

  async function handleTestAdmin() {
    localStorage.setItem('test_user', JSON.stringify({
      id: 'test-admin-001',
      email: 'mohameddhia.ounally@afneus.org',
      role: 'ADMIN',
      status_code: 'BN',
      first_name: 'Mohamed Dhia',
      last_name: 'Ounally'
    }));
    alert('✅ Mode Admin test activé !');
    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <Image 
              src="/logo-afneus.png" 
              alt="AFNEUS Logo" 
              width={120} 
              height={120}
              className="rounded-2xl shadow-lg mx-auto"
            />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">
            {mode === 'login' ? 'Connexion' : 'Créer un compte'}
          </h2>
          <p className="text-gray-600 mt-2">
            Plateforme de remboursement AFNEUS
          </p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Message d'erreur */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                ❌ <strong>Erreur :</strong> {errorMessage}
              </p>
            </div>
          )}

          {/* Google OAuth */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Connexion en cours...' : 'Continuer avec Google'}
          </button>

          {/* Séparateur */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">OU</span>
            </div>
          </div>

          {/* Formulaire Email/Password */}
          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Prénom</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Jean"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Nom</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Dupont"
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2 text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="votre.email@afneus.org"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-700">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
            {mode === 'signup' && (
              <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères</p>
            )}
          </div>

          <button
            onClick={mode === 'login' ? handleEmailLogin : handleEmailSignup}
            disabled={loading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>

          {/* Toggle mode */}
          <div className="text-center text-sm text-gray-600">
            {mode === 'login' ? (
              <p>
                Pas encore de compte ?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  S'inscrire
                </button>
              </p>
            ) : (
              <p>
                Déjà un compte ?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Se connecter
                </button>
              </p>
            )}
          </div>

          {/* Mode test */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-3">Mode test (développement)</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleTestMode}
                className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-semibold hover:bg-green-200 transition"
              >
                👤 Test Utilisateur
              </button>
              <button
                onClick={handleTestAdmin}
                className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-semibold hover:bg-orange-200 transition"
              >
                👨‍💼 Test Admin
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>🔒 Vos données sont sécurisées et chiffrées</p>
          <p className="mt-2">
            Les membres BN se connectent avec leur email @afneus.org
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Chargement...</div>}>
      <AuthPageContent />
    </Suspense>
  );
}
