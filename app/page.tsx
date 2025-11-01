'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        checkUser();
      } else {
        setUser(null);
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    try {
      setLoading(true);
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setLoading(false);
        return;
      }

      setUser(user);
      
      const { data: userData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profileError && userData) {
        setUserProfile(userData);
      }
    } catch (error) {
      console.error('Erreur checkUser:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
    router.push('/');
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-block mb-6">
            <Image 
              src="/logo-afneus.png" 
              alt="AFNEUS Logo" 
              width={200} 
              height={200}
              className="rounded-2xl shadow-lg"
            />
          </div>
          <p className="text-2xl md:text-3xl font-semibold text-gray-800 mb-4">
            Plateforme de Remboursement
          </p>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Simplifiez vos demandes de remboursement de frais de déplacement, hébergement et restauration
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16 max-w-5xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition">
            <div className="text-5xl mb-4">🚗</div>
            <h3 className="text-xl font-bold mb-3 text-gray-800">Frais Kilométriques</h3>
            <p className="text-gray-600">
              Calcul automatique selon le barème fiscal 2024. Covoiturage et partage des frais intégrés.
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition">
            <div className="text-5xl mb-4">🚄</div>
            <h3 className="text-xl font-bold mb-3 text-gray-800">Transports</h3>
            <p className="text-gray-600">
              Train, bus, péage. Upload de vos billets et justificatifs en quelques clics.
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition">
            <div className="text-5xl mb-4">🏨</div>
            <h3 className="text-xl font-bold mb-3 text-gray-800">Hébergement & Repas</h3>
            <p className="text-gray-600">
              Hôtels et forfaits repas avec plafonds automatiques. Validation simplifiée.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-2xl p-12 text-center text-white max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">
            {user ? 'Accès rapide à vos fonctionnalités' : 'Prêt à soumettre votre demande ?'}
          </h2>
          <p className="text-lg mb-8 opacity-90">
            {user 
              ? 'Gérez vos demandes de remboursement en quelques clics'
              : 'Connectez-vous avec votre compte Google AFNEUS pour commencer'
            }
          </p>
          
          {user ? (
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center flex-wrap">
              <button
                onClick={() => router.push('/claims/new')}
                className="inline-block bg-white text-blue-600 px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition shadow-lg"
              >
                📝 Nouvelle Demande
              </button>
              
              <button
                onClick={() => router.push('/claims')}
                className="inline-block bg-blue-700 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-blue-800 transition border-2 border-white"
              >
                📋 Mes Demandes
              </button>
              
              {(userProfile?.role === 'ADMIN' || userProfile?.role === 'TREASURER' || userProfile?.role === 'VALIDATOR') && (
                <button
                  onClick={() => router.push('/validator')}
                  className="inline-block bg-orange-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-orange-700 transition border-2 border-white"
                >
                  ✅ Validation
                </button>
              )}
            </div>
          ) : null}
        </div>

        {/* Process Steps */}
        <div className="mt-20 max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">Comment ça marche ?</h2>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-blue-600">
                1
              </div>
              <h3 className="font-semibold mb-2">Connectez-vous</h3>
              <p className="text-sm text-gray-600">Avec votre compte AFNEUS</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-green-600">
                2
              </div>
              <h3 className="font-semibold mb-2">Créez votre demande</h3>
              <p className="text-sm text-gray-600">Formulaire intelligent avec calculs auto</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-purple-600">
                3
              </div>
              <h3 className="font-semibold mb-2">Validation rapide</h3>
              <p className="text-sm text-gray-600">Traitement sous 48-72h</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-orange-600">
                4
              </div>
              <h3 className="font-semibold mb-2">Virement SEPA</h3>
              <p className="text-sm text-gray-600">Remboursement direct</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 bg-white rounded-2xl shadow-lg p-12 max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">100%</div>
              <p className="text-gray-600">Automatisé</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-600 mb-2">&lt; 5 min</div>
              <p className="text-gray-600">Par demande</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-600 mb-2">48-72h</div>
              <p className="text-gray-600">Délai de traitement</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-gray-500 text-sm">
          <p className="mb-2">Association Fédérative Nationale des Étudiants Universitaires Scientifiques</p>
          <p>Plateforme sécurisée • Données chiffrées • Conformité RGPD</p>
        </div>
      </div>
    </main>
  );
}
