// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface TrainBareme {
  id?: string;
  distance_min_km: number;
  distance_max_km: number;
  percentage_refund: number;
  max_amount_euros: number | null;
  description: string;
  valid_from: string;
  valid_to: string | null;
}

export default function TrainBaremesPage() {
  const router = useRouter();
  const [baremes, setBaremes] = useState<TrainBareme[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<TrainBareme>>({});

  useEffect(() => {
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAccess() {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const { data: userData } = await supabase.rpc('get_current_user_safe');
    const roleMap: Record<string, string> = {
      'admin_asso': 'ADMIN',
      'treasurer': 'TREASURER',
      'validator': 'VALIDATOR',
      'bn_member': 'BN',
      'user': 'MEMBER'
    };
    const mappedRole = userData && userData[0] ? roleMap[userData[0].role] || userData[0].role : null;

    if (mappedRole !== 'ADMIN') {
      alert('❌ Accès refusé. Réservé aux Administrateurs.');
      router.push('/');
      return;
    }

    loadBaremes();
  }

  async function loadBaremes() {
    const { data, error } = await supabase
      .from('train_baremes')
      .select('*')
      .is('valid_to', null)
      .order('distance_min_km', { ascending: true });

    if (data) {
      setBaremes(data);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!editing || !formData.percentage_refund) {
      alert('⚠️ Veuillez remplir tous les champs obligatoires');
      return;
    }

    // @ts-ignore - Supabase update
    const { error } = await supabase
      .from('train_baremes')
      .update({
        percentage_refund: formData.percentage_refund,
        max_amount_euros: formData.max_amount_euros,
        description: formData.description,
      })
      .eq('id', editing);

    if (!error) {
      alert('✅ Barème mis à jour !');
      setEditing(null);
      loadBaremes();
    } else {
      alert('❌ Erreur : ' + error.message);
    }
  }

  async function handleAdd() {
    if (!formData.distance_min_km || !formData.distance_max_km || !formData.percentage_refund) {
      alert('⚠️ Veuillez remplir tous les champs obligatoires');
      return;
    }

    const { error } = await supabase
      .from('train_baremes')
      .insert([{
        distance_min_km: formData.distance_min_km,
        distance_max_km: formData.distance_max_km,
        percentage_refund: formData.percentage_refund,
        max_amount_euros: formData.max_amount_euros,
        description: formData.description || `Trajet ${formData.distance_min_km}-${formData.distance_max_km}km`,
        valid_from: new Date().toISOString().split('T')[0],
        valid_to: null,
      }]);

    if (!error) {
      alert('✅ Barème ajouté !');
      setFormData({});
      loadBaremes();
    } else {
      alert('❌ Erreur : ' + error.message);
    }
  }

  function startEdit(bareme: TrainBareme) {
    setEditing(bareme.id || null);
    setFormData(bareme);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-xl">⏳ Chargement...</div>
    </div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🚄 Barèmes Train (Distance)</h1>
        <p className="text-gray-600">
          Gérer les pourcentages de remboursement selon la distance du trajet
        </p>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <p className="text-sm text-yellow-800">
          <strong>ℹ️ Information :</strong> Les barèmes train sont basés sur la distance du trajet. 
          Le système remboursera automatiquement le pourcentage défini du prix du billet, dans la limite du plafond si défini.
        </p>
      </div>

      {/* Formulaire d&apos;ajout */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">➕ Ajouter un nouveau barème</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Distance min (km) *</label>
            <input
              type="number"
              value={formData.distance_min_km || ''}
              onChange={(e) => setFormData({ ...formData, distance_min_km: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Distance max (km) *</label>
            <input
              type="number"
              value={formData.distance_max_km || ''}
              onChange={(e) => setFormData({ ...formData, distance_max_km: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="100"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Remboursement (%) *</label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.percentage_refund || ''}
              onChange={(e) => setFormData({ ...formData, percentage_refund: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="100"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Plafond max (€, optionnel)</label>
            <input
              type="number"
              step="0.01"
              value={formData.max_amount_euros || ''}
              onChange={(e) => setFormData({ ...formData, max_amount_euros: parseFloat(e.target.value) || null })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="150.00"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Description</label>
            <input
              type="text"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Ex: Trajets courte distance"
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
        >
          ➕ Ajouter
        </button>
      </div>

      {/* Table des barèmes */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distance (km)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remboursement</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plafond</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {baremes.map((bareme) => (
              <tr key={bareme.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-mono text-sm">
                    {bareme.distance_min_km} - {bareme.distance_max_km} km
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editing === bareme.id ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.percentage_refund || ''}
                      onChange={(e) => setFormData({ ...formData, percentage_refund: parseInt(e.target.value) })}
                      className="w-20 px-2 py-1 border rounded"
                    />
                  ) : (
                    <span className="text-green-600 font-semibold">{bareme.percentage_refund}%</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editing === bareme.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={formData.max_amount_euros || ''}
                      onChange={(e) => setFormData({ ...formData, max_amount_euros: parseFloat(e.target.value) || null })}
                      className="w-24 px-2 py-1 border rounded"
                    />
                  ) : (
                    <span>{bareme.max_amount_euros ? `${bareme.max_amount_euros}€` : 'Aucun'}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editing === bareme.id ? (
                    <input
                      type="text"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-2 py-1 border rounded"
                    />
                  ) : (
                    <span className="text-sm text-gray-600">{bareme.description}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editing === bareme.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        ✓ Valider
                      </button>
                      <button
                        onClick={() => {
                          setEditing(null);
                          setFormData({});
                        }}
                        className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm"
                      >
                        ✕ Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(bareme)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      ✏️ Modifier
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {baremes.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucun barème défini. Ajoutez-en un ci-dessus.
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={() => router.push('/admin')}
          className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
        >
          ← Retour Admin
        </button>
      </div>
    </div>
  );
}
