'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Image from 'next/image';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Vérifier que l'utilisateur a un token de récupération
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setErrorMessage('Session invalide ou expirée. Veuillez redemander un lien de réinitialisation.');
      }
    });
  }, []);

  async function handleResetPassword() {
    if (!password || !confirmPassword) {
      setErrorMessage('⚠️ Veuillez remplir tous les champs');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('⚠️ Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('⚠️ Les mots de passe ne correspondent pas');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setSuccessMessage('✅ Mot de passe réinitialisé avec succès !');
      
      // Rediriger vers la page de connexion après 2 secondes
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);

    } catch (error: any) {
      setErrorMessage(`❌ Erreur: ${error.message}`);
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
            Nouveau mot de passe
          </h2>
          <p className="text-gray-600 mt-2">
            Choisissez un nouveau mot de passe sécurisé
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
              <p className="text-xs text-green-600 mt-2">
                Redirection vers la connexion...
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

          {!successMessage && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                onClick={handleResetPassword}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
              </button>

              <div className="text-center text-sm text-gray-600">
                <button
                  onClick={() => router.push('/auth/login')}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  ← Retour à la connexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
