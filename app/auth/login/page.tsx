// @ts-nocheck
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Image from 'next/image';

/**
 * 🔒 PAGE DE CONNEXION SÉCURISÉE
 * 
 * Modes disponibles :
 * - login : Connexion avec email/password ou Google OAuth
 * - reset : Réinitialisation mot de passe (via Supabase Auth)
 * 
 * ⚠️ SÉCURITÉ :
 * - Signup désactivé (création compte uniquement sur invitation)
 * - Rate limiting via Supabase Auth
 * - Validation email obligatoire
 * - Google OAuth préféré pour @afneus.org
 */
function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setErrorMessage(decodeURIComponent(error));
    }
  }, [searchParams]);

  // ═══════════════════════════════════════════════════════════
  // 🔒 GOOGLE OAUTH (Méthode recommandée)
  // ═══════════════════════════════════════════════════════════
  async function handleGoogleLogin() {
    try {
      setLoading(true);
      setErrorMessage('');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback-handler`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
      
    } catch (error: any) {
      setErrorMessage(error.message || 'Erreur de connexion avec Google');
      setLoading(false);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🔒 CONNEXION EMAIL/PASSWORD
  // ═══════════════════════════════════════════════════════════
  async function handleEmailLogin() {
    // Validation
    if (!email || !password) {
      setErrorMessage('⚠️ Veuillez remplir tous les champs');
      return;
    }

    // Vérifier format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('⚠️ Format d\'email invalide');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error('Utilisateur non trouvé');
      }

      // Vérifier que le profil existe
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (!profile) {
        // Profil non créé, déconnecter
        await supabase.auth.signOut();
        setErrorMessage('❌ Profil non trouvé. Contactez un administrateur.');
        setLoading(false);
        return;
      }

      setSuccessMessage('✅ Connexion réussie !');
      
      // Redirection selon rôle
      if (['ADMIN', 'TREASURER', 'VALIDATOR'].includes(profile.role)) {
        router.push('/dashboard');
      } else {
        router.push('/claims');
      }
      
    } catch (error: any) {
      if (error.message.includes('Invalid login credentials')) {
        setErrorMessage('❌ Email ou mot de passe incorrect');
      } else if (error.message.includes('Email not confirmed')) {
        setErrorMessage('⚠️ Veuillez confirmer votre email avant de vous connecter');
      } else {
        setErrorMessage(`❌ ${error.message}`);
      }
      setLoading(false);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🔒 RÉINITIALISATION MOT DE PASSE
  // ═══════════════════════════════════════════════════════════
  async function handlePasswordReset() {
    if (!email) {
      setErrorMessage('⚠️ Veuillez entrer votre email');
      return;
    }

    // Vérifier format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('⚠️ Format d\'email invalide');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }
      );

      if (error) throw error;

      setSuccessMessage('✅ Email de réinitialisation envoyé ! Vérifiez votre boîte mail.');
      setMode('login');
      setLoading(false);
    } catch (error: any) {
      setErrorMessage(`❌ ${error.message}`);
      setLoading(false);
    }
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
            {mode === 'login' ? 'Connexion' : 'Mot de passe oublié'}
          </h2>
          <p className="text-gray-600 mt-2">
            Plateforme de remboursement AFNEUS
          </p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Message de succès */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                {successMessage}
              </p>
            </div>
          )}
          
          {/* Message d'erreur */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                {errorMessage}
              </p>
            </div>
          )}

          {mode !== 'reset' && (
            <>
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
            </>
          )}

          {/* Email */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2 text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  if (mode === 'login') handleEmailLogin();
                  else handlePasswordReset();
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="votre.email@afneus.org"
              required
              autoComplete="email"
            />
          </div>

          {/* Password (mode login uniquement) */}
          {mode !== 'reset' && (
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-700">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleEmailLogin()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <div className="text-right mt-2">
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </div>
          )}

          {/* Bouton principal */}
          <button
            onClick={mode === 'login' ? handleEmailLogin : handlePasswordReset}
            disabled={loading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Envoyer le lien'}
          </button>

          {/* Retour à la connexion (mode reset) */}
          {mode === 'reset' && (
            <div className="text-center text-sm text-gray-600">
              <button
                onClick={() => setMode('login')}
                className="text-blue-600 font-semibold hover:underline"
              >
                ← Retour à la connexion
              </button>
            </div>
          )}
        </div>

        {/* Info sécurité */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>🔒 Connexion sécurisée et chiffrée</p>
          <p className="mt-2">
            Membres BN : Utilisez votre email @afneus.org
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}
