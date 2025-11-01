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
  const [type, setType] = useState('CAR');

  useEffect(() => {
    checkAdmin();
    loadUsers();
  }, []);

  function checkAdmin() {
    const role = localStorage.getItem('test_role');
    if (role !== 'treasurer') {
      router.push('/');
    }
  }

  async function loadUsers() {
    // Charger les utilisateurs depuis localStorage pour le mode test
    const testUsers = [
      { id: 'test-user-123', email: 'test@afneus.fr', name: 'Utilisateur Test' },
      { id: 'test-admin-456', email: 'admin@afneus.fr', name: 'Admin Test' },
      { id: 'user-1', email: 'marie.dupont@afneus.fr', name: 'Marie Dupont' },
      { id: 'user-2', email: 'jean.martin@afneus.fr', name: 'Jean Martin' },
      { id: 'user-3', email: 'sophie.bernard@afneus.fr', name: 'Sophie Bernard' },
    ];
    setUsers(testUsers);
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
        created_at: date,
        type,
        description,
      };

      // Pour le mode test, on sauvegarde dans localStorage
      const existingClaims = JSON.parse(localStorage.getItem('admin_created_claims') || '[]');
      const newClaim = {
        ...claimData,
        id: Date.now().toString(),
        created_by_admin: true,
      };
      existingClaims.push(newClaim);
      localStorage.setItem('admin_created_claims', JSON.stringify(existingClaims));

      alert('✅ Demande créée avec succès pour ' + users.find(u => u.id === selectedUser)?.name);
      
      // Reset
      setSelectedUser('');
      setMotive('');
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
    } catch (error: any) {
      alert('❌ Erreur : ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">👑 Créer une Demande (Admin)</h1>
        <p className="text-gray-600">
          Créez une demande de remboursement au nom d'un membre, y compris pour des dates passées
        </p>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ Mode Admin :</strong> Vous pouvez créer des demandes au nom de n'importe quel membre,
          même pour des événements passés. Ces demandes seront marquées comme créées par un administrateur.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Membre concerné *</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Sélectionnez un membre --</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
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
              Vous pouvez sélectionner n'importe quelle date, y compris passée
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Type de dépense *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="CAR">🚗 Frais kilométriques</option>
              <option value="TRAIN">🚄 Train</option>
              <option value="BUS">🚌 Bus</option>
              <option value="MEAL">🍽️ Repas</option>
              <option value="HOTEL">🏨 Hôtel</option>
              <option value="OTHER">📄 Autre</option>
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
