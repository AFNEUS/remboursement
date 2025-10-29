'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [iban, setIban] = useState('');

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const testUser = localStorage.getItem('test_user');
    if (testUser) {
      const parsedUser = JSON.parse(testUser);
      setUser(parsedUser);
      setFirstName(parsedUser.first_name || '');
      setLastName(parsedUser.last_name || '');
      setIban(parsedUser.iban || '');
      setProfile({
        status_label: parsedUser.status_code,
        coefficient: 1.0,
        draft_claims: 0,
        pending_claims: 0,
        validated_claims: 0,
        paid_claims: 0,
        total_reimbursed: 0,
      });
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Charger le profil complet
    const { data: profileData } = await supabase
      .from('user_profile')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      setFirstName((profileData as any).first_name || '');
      setLastName((profileData as any).last_name || '');
      setIban((profileData as any).iban || '');
    }

    setUser(user);
    setLoading(false);
  }

  async function handleSave() {
    if (!firstName || !lastName) {
      alert('⚠️ Prénom et nom sont obligatoires');
      return;
    }

    setSaving(true);
    try {
      // @ts-ignore - RPC function from migration 007
      const { error } = await supabase.rpc('update_user_profile', {
        p_first_name: firstName,
        p_last_name: lastName,
        p_iban: iban || null,
      });

      if (error) throw error;

      alert('✅ Profil mis à jour avec succès !');
      loadUser();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    localStorage.removeItem('test_user');
    await supabase.auth.signOut();
    router.push('/');
  }

  function formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  const ROLE_LABELS: Record<string, string> = {
    'ADMIN': '👨‍💼 Administrateur',
    'TREASURER': '💰 Trésorier',
    'VALIDATOR': '✅ Validateur',
    'MEMBER': '👤 Membre',
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">👤 Mon profil</h1>
        <p className="text-gray-600">Gérez vos informations personnelles</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Statistiques */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-sm opacity-90 mb-1">Demandes en attente</div>
          <div className="text-3xl font-bold">{profile?.pending_claims || 0}</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-sm opacity-90 mb-1">Demandes payées</div>
          <div className="text-3xl font-bold">{profile?.paid_claims || 0}</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-sm opacity-90 mb-1">Total remboursé</div>
          <div className="text-2xl font-bold">{formatAmount(parseFloat(profile?.total_reimbursed || 0))}</div>
        </div>
      </div>

      {/* Informations du compte */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">ℹ️ Informations du compte</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm text-gray-600">Email</div>
              <div className="font-semibold">{user?.email || profile?.email}</div>
            </div>
            <span className="text-2xl">📧</span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm text-gray-600">Rôle</div>
              <div className="font-semibold">{ROLE_LABELS[profile?.role || 'MEMBER']}</div>
            </div>
            <span className="text-2xl">🎭</span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm text-gray-600">Statut membre</div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{profile?.status_label || profile?.status_code}</span>
                <span className="text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded">
                  Coefficient: {profile?.coefficient || 1.0}
                </span>
              </div>
            </div>
            <span className="text-2xl">⭐</span>
          </div>
        </div>
      </div>

      {/* Formulaire d'édition */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">✏️ Modifier mes informations</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Prénom *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Jean"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Nom *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Dupont"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">
              IBAN (pour les remboursements)
              {profile?.iban_verified && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                  ✓ Vérifié
                </span>
              )}
            </label>
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="FR76 1234 5678 9012 3456 7890 123"
              maxLength={34}
            />
            <p className="text-xs text-gray-500 mt-1">
              Format : FR suivi de 25 chiffres (sans espaces)
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? 'Enregistrement...' : '💾 Enregistrer les modifications'}
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">⚙️ Actions</h2>
        </div>
        <div className="p-6 space-y-3">
          <button
            onClick={() => router.push('/claims/new')}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition text-left"
          >
            📝 Nouvelle demande de remboursement
          </button>

          <button
            onClick={() => router.push('/claims')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-left"
          >
            📋 Mes demandes
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition text-left"
          >
            📊 Dashboard
          </button>

          <button
            onClick={handleLogout}
            className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition text-left"
          >
            🚪 Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}
