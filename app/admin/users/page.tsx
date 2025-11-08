// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'admin' | 'bn' | 'member'>('all');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    try {
      // Vérifier auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Charger profil actuel
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!userData || (userData.role !== 'ADMIN' && userData.role !== 'admin_asso')) {
        alert('⛔ Accès refusé - Réservé aux administrateurs');
        router.push('/dashboard');
        return;
      }

      setCurrentUser(userData);

      // Charger tous les utilisateurs
      const { data: allUsers, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(allUsers || []);
    } catch (error: any) {
      console.error('Erreur chargement:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId: string, newRole: string) {
    if (!confirm(`Confirmer le changement de rôle ?`)) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;

      alert('✅ Rôle mis à jour');
      loadData();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  }

  async function updateUserStatus(userId: string, newStatus: string) {
    if (!confirm(`Confirmer le changement de statut ?`)) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;

      alert('✅ Statut mis à jour');
      loadData();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  }

  const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    'ADMIN': { label: '👨‍💼 Admin', color: 'bg-red-100 text-red-800 border-red-300' },
    'TREASURER': { label: '💰 Trésorier', color: 'bg-green-100 text-green-800 border-green-300' },
    'VALIDATOR': { label: '✅ Validateur', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    'MEMBER': { label: '👤 Membre', color: 'bg-gray-100 text-gray-800 border-gray-300' },
  };

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    'ADMIN': { label: '🔴 Super Admin', color: 'bg-red-100 text-red-800 border-red-300' },
    'BN': { label: '⭐ Bureau National', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    'MEMBER': { label: '👥 Membre', color: 'bg-gray-100 text-gray-800 border-gray-300' },
  };

  const filteredUsers = users.filter(u => {
    if (filter === 'all') return true;
    if (filter === 'admin') return u.role === 'ADMIN' || u.role === 'admin_asso';
    if (filter === 'bn') return u.status === 'BN';
    if (filter === 'member') return u.status === 'MEMBER';
    return true;
  });

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">👥 Gestion des utilisateurs</h1>
        <p className="text-gray-600">Gérez les rôles et statuts des membres</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 mb-1">Total utilisateurs</div>
          <div className="text-2xl font-bold">{users.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="text-sm text-gray-600 mb-1">Administrateurs</div>
          <div className="text-2xl font-bold">{users.filter(u => u.role === 'ADMIN' || u.role === 'admin_asso').length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-600 mb-1">Bureau National</div>
          <div className="text-2xl font-bold">{users.filter(u => u.status === 'BN').length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
          <div className="text-sm text-gray-600 mb-1">Membres</div>
          <div className="text-2xl font-bold">{users.filter(u => u.status === 'MEMBER').length}</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🌍 Tous ({users.length})
          </button>
          <button
            onClick={() => setFilter('admin')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'admin'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            👨‍💼 Admins ({users.filter(u => u.role === 'ADMIN' || u.role === 'admin_asso').length})
          </button>
          <button
            onClick={() => setFilter('bn')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'bn'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ⭐ BN ({users.filter(u => u.status === 'BN').length})
          </button>
          <button
            onClick={() => setFilter('member')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'member'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            👥 Membres ({users.filter(u => u.status === 'MEMBER').length})
          </button>
        </div>
      </div>

      {/* Liste des utilisateurs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                        {user.id === currentUser?.id && (
                          <div className="text-xs text-indigo-600 font-medium">✨ C&apos;est vous</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.id, e.target.value)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        ROLE_LABELS[user.role]?.color || 'bg-gray-100 text-gray-800'
                      }`}
                      disabled={user.id === currentUser?.id}
                    >
                      <option value="ADMIN">👨‍💼 Admin</option>
                      <option value="TREASURER">💰 Trésorier</option>
                      <option value="VALIDATOR">✅ Validateur</option>
                      <option value="MEMBER">👤 Membre</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.status}
                      onChange={(e) => updateUserStatus(user.id, e.target.value)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        STATUS_LABELS[user.status]?.color || 'bg-gray-100 text-gray-800'
                      }`}
                      disabled={user.id === currentUser?.id}
                    >
                      <option value="ADMIN">🔴 Super Admin</option>
                      <option value="BN">⭐ Bureau National</option>
                      <option value="MEMBER">👥 Membre</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="text-xs">
                      Inscrit le {new Date(user.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-gray-600">Aucun utilisateur trouvé</p>
        </div>
      )}
    </div>
  );
}
