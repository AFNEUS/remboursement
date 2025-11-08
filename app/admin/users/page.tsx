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

      // Charger profil actuel via RPC
      const { data: userDataArray } = await supabase.rpc('get_current_user_safe');
      
      if (!userDataArray || !Array.isArray(userDataArray) || (userDataArray as any[]).length === 0) {
        router.push('/auth/login');
        return;
      }
      
      const userData = (userDataArray as any[])[0];

      if (!userData || userData.role !== 'admin_asso') {
        alert('⛔ Accès refusé - Réservé aux administrateurs');
        router.push('/dashboard');
        return;
      }

      setCurrentUser(userData);

  // Charger tous les utilisateurs (whitelist + users) via nouvelle RPC
  const { data: allUsers, error } = await supabase.rpc('get_all_user_profiles');

  if (error) throw error;

  setUsers((allUsers as any[]) || []);
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
      const { error } = await supabase.rpc('admin_update_user_role', {
        target_user_id: userId,
        new_role: newRole
      });

      if (error) throw error;

      alert('✅ Rôle mis à jour');
      loadData();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  }

  async function toggleUserAccess(userId: string, currentStatus: boolean) {
    const action = currentStatus ? 'désactiver' : 'activer';
    if (!confirm(`Confirmer ${action} l'accès de cet utilisateur ?\n\n${currentStatus ? '⚠️ L\'utilisateur ne pourra plus se connecter' : '✅ L\'utilisateur pourra se connecter'}`)) return;

    try {
      const { error } = await supabase.rpc('admin_toggle_user_access', {
        target_user_id: userId,
        new_is_active: !currentStatus
      });

      if (error) throw error;

      alert(`✅ Accès ${currentStatus ? 'désactivé' : 'activé'} avec succès`);
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 mb-1">Total utilisateurs</div>
          <div className="text-2xl font-bold">{users.length}</div>
          <div className="text-xs text-gray-500 mt-1">
            ✅ {users.filter(u => u.is_active).length} actifs
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="text-sm text-gray-600 mb-1">Administrateurs</div>
          <div className="text-2xl font-bold">{users.filter(u => u.role === 'admin_asso').length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm text-gray-600 mb-1">Trésorier</div>
          <div className="text-2xl font-bold">{users.filter(u => u.role === 'treasurer').length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-600 mb-1">Bureau National</div>
          <div className="text-2xl font-bold">{users.filter(u => u.role === 'bn_member').length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
          <div className="text-sm text-gray-600 mb-1">Membres simples</div>
          <div className="text-2xl font-bold">{users.filter(u => u.role === 'user').length}</div>
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
              {filteredUsers.map((user) => {
                // Fallbacks whitelist si jamais connecté
                const displayName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || `${user.whitelist_first_name || ''} ${user.whitelist_last_name || ''}`.trim() || user.email.split('@')[0];
                const displayRole = user.user_role || user.role || user.whitelist_role || 'user';
                const displayStatus = user.status || 'MEMBER';
                const isActive = user.is_active !== undefined && user.is_active !== null ? user.is_active : true;
                const createdAt = user.user_created_at || user.whitelist_created_at;
                const lastLogin = user.last_login_at ? new Date(user.last_login_at).toLocaleString('fr-FR') : 'Jamais connecté';
                const notes = user.whitelist_notes || '';
                return (
                  <tr key={user.user_id || user.email} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{displayName}</div>
                          {user.user_id === currentUser?.id && (
                            <div className="text-xs text-indigo-600 font-medium">✨ C&apos;est vous</div>
                          )}
                          {!isActive && (
                            <div className="text-xs text-red-600 font-medium">🚫 Désactivé</div>
                          )}
                          {notes && (
                            <div className="text-xs text-gray-500">📝 {notes}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                      <div className="text-xs text-gray-500">{lastLogin}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="block text-xs font-semibold mb-1">{displayRole}</span>
                      {user.user_id && user.user_id !== currentUser?.id && (
                        <div className="mt-1">
                          <select
                            value={user.user_role || user.role || user.whitelist_role || 'user'}
                            onChange={e => updateUserRole(user.user_id, e.target.value)}
                            className="text-xs border rounded px-2 py-1"
                          >
                            <option value="admin_asso">Admin</option>
                            <option value="treasurer">Trésorier</option>
                            <option value="validator">Validateur</option>
                            <option value="bn_member">BN</option>
                            <option value="user">Membre</option>
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${
                        STATUS_LABELS[displayStatus]?.color || 'bg-gray-100 text-gray-800'
                      }`}>
                        {STATUS_LABELS[displayStatus]?.label || displayStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col gap-2">
                        {user.user_id && (
                          <button
                            onClick={() => toggleUserAccess(user.user_id, isActive)}
                            disabled={user.user_id === currentUser?.id}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                              user.user_id === currentUser?.id
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : isActive
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {isActive ? '🚫 Bloquer accès' : '✅ Autoriser accès'}
                          </button>
                        )}
                        <div className="text-xs text-gray-500">
                          Inscrit le {createdAt ? new Date(createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-4xl mb-4">👥</div>
          <p className="text-gray-600 mb-4">Aucun utilisateur trouvé dans la base de données</p>
          <p className="text-sm text-gray-500 mb-6">
            Les utilisateurs apparaîtront ici après leur première connexion.<br/>
            Ils sont créés automatiquement depuis la liste blanche (authorized_users).
          </p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            🔄 Recharger
          </button>
        </div>
      )}

      {users.length > 0 && filteredUsers.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-gray-600">Aucun utilisateur trouvé avec ce filtre</p>
        </div>
      )}
    </div>
  );
}
