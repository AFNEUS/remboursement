// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AdminClaimsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [motive, setMotive] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [type, setType] = useState('car');

  useEffect(() => {
    checkAdmin();
    loadBNMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAdmin() {
    // Check if user has admin role
    const { data } = await supabase.rpc('get_current_user_safe');
    if (!data || !Array.isArray(data) || (data as any[]).length === 0) {
      router.push('/');
      return;
    }
    
    const user = (data as any[])[0];
    const roleMapping: Record<string, string> = {
      'admin_asso': 'ADMIN',
      'treasurer': 'TREASURER',
      'validator': 'VALIDATOR',
      'bn_member': 'BN',
      'user': 'MEMBER',
    };
    
    const role = roleMapping[user.role] || 'MEMBER';
    if (role !== 'ADMIN') {
      alert('⛔ Accès refusé - Réservé aux administrateurs');
      router.push('/');
    }
  }

  async function loadBNMembers() {
    try {
      // Fetch only BN members via RPC
      const { data, error } = await supabase.rpc('get_bn_members');

      if (error) {
        console.error('Error loading BN members:', error);
        alert('Erreur lors du chargement des membres BN');
        return;
      }

      setUsers(data || []);
    } catch (error) {
      console.error('Error in loadBNMembers:', error);
    }
  }

  async function handleCreateClaim() {
    if (!selectedUser || !motive || !amount) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);
    try {
      const claimData = {
        user_id: selectedUser,
        motive,
        total_amount: parseFloat(amount),
        status: 'draft',
        expense_type: type.toLowerCase(), // Ensure lowercase
        description,
        expense_date: date,
      };

      // Insert into database
      const { data, error } = await supabase
        .from('expense_claims')
        .insert([claimData])
        .select();

      if (error) {
        throw error;
      }

      const selectedUserData = users.find(u => u.id === selectedUser);
      const userName = selectedUserData?.full_name || 
                       `${selectedUserData?.first_name} ${selectedUserData?.last_name}`.trim() || 
                       selectedUserData?.email || 'Membre';
      
      alert(`✅ Demande créée avec succès pour ${userName}`);
      
      // Reset form
      setSelectedUser('');
      setMotive('');
      setAmount('');
      setDescription('');
      setType('car');
      setDate(new Date().toISOString().split('T')[0]);
    } catch (error: any) {
      console.error('Error creating claim:', error);
      alert('❌ Erreur : ' + (error.message || 'Une erreur est survenue'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">👑 Créer une Demande (Admin)</h1>
        <p className="text-gray-600">
          Créez une demande de remboursement au nom d&apos;un membre, y compris pour des dates passées
        </p>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ Mode Admin :</strong> Vous pouvez créer des demandes au nom de n&apos;importe quel membre,
          même pour des événements passés. Ces demandes seront marquées comme créées par un administrateur.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Membre BN concerné *</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Sélectionnez un membre BN --</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.full_name || `${user.first_name} ${user.last_name}`.trim() || user.email} ({user.email})
                </option>
              ))}
            </select>
            {users.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Aucun membre BN trouvé. Vérifiez que des utilisateurs ont le rôle &apos;bn_member&apos;.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Date de la dépense *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Vous pouvez sélectionner n&apos;importe quelle date, y compris passée
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Type de dépense *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="car">🚗 Frais kilométriques</option>
              <option value="train">🚄 Train</option>
              <option value="transport">🚌 Transport</option>
              <option value="meal">🍽️ Repas</option>
              <option value="hotel">🏨 Hôtel</option>
              <option value="registration">📝 Inscription</option>
              <option value="other">📄 Autre</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Motif de la demande *</label>
            <input
              type="text"
              value={motive}
              onChange={(e) => setMotive(e.target.value)}
              placeholder="Ex: Déplacement AG 2024, Formation Bureau National..."
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Description détaillée</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Paris → Sousse, 3 nuits d'hôtel, repas du 15 au 18 janvier..."
              rows={3}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Montant total (€) *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex: 245.50"
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
            />
          </div>

          <div className="pt-4 border-t">
            <button
              onClick={handleCreateClaim}
              disabled={loading}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold text-lg disabled:bg-gray-400"
            >
              {loading ? '⏳ Création en cours...' : '✅ Créer la Demande'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="font-semibold mb-3">📋 Demandes créées par les admins</h3>
        <AdminCreatedClaimsList />
      </div>
    </div>
  );
}

function AdminCreatedClaimsList() {
  const [claims, setClaims] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('admin_created_claims');
    if (saved) {
      setClaims(JSON.parse(saved));
    }
  }, []);

  if (claims.length === 0) {
    return (
      <p className="text-gray-500 text-sm">Aucune demande créée pour le moment</p>
    );
  }

  return (
    <div className="space-y-3">
      {claims.slice(-10).reverse().map((claim) => (
        <div key={claim.id} className="bg-white p-4 rounded-lg border">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold">{claim.motive}</p>
              <p className="text-sm text-gray-600">{claim.description}</p>
              <p className="text-xs text-gray-500 mt-1">
                {claim.created_at} | {claim.type}
              </p>
            </div>
            <span className="text-lg font-bold text-blue-600">
              {claim.total_amount.toFixed(2)} €
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
