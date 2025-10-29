'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

interface TarifConfig {
  id: string;
  category: string;
  label: string;
  default_amount: number;
  max_amount: number;
  description: string;
}

export default function TarifsAdminPage() {
  const [tarifs, setTarifs] = useState<TarifConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<TarifConfig>>({});

  useEffect(() => {
    loadTarifs();
  }, []);

  async function loadTarifs() {
    // Charger depuis la config ou créer des valeurs par défaut
    const defaultTarifs: TarifConfig[] = [
      { id: '1', category: 'TRAIN', label: '🚄 Train (2nde classe)', default_amount: 0, max_amount: 150, description: 'Prix réel du billet' },
      { id: '2', category: 'TRAIN_1ST', label: '🚄 Train (1ère classe)', default_amount: 0, max_amount: 250, description: 'Prix réel du billet' },
      { id: '3', category: 'BUS', label: '🚌 Bus/Car', default_amount: 0, max_amount: 50, description: 'Prix réel du billet' },
      { id: '4', category: 'TOLL', label: '🛣️ Péage', default_amount: 0, max_amount: 100, description: 'Prix réel du péage' },
      { id: '5', category: 'PARKING', label: '🅿️ Parking', default_amount: 0, max_amount: 30, description: 'Prix réel du parking' },
      { id: '6', category: 'MEAL', label: '🍽️ Repas', default_amount: 15, max_amount: 25, description: 'Forfait repas' },
      { id: '7', category: 'HOTEL', label: '🏨 Hôtel (par nuit)', default_amount: 0, max_amount: 120, description: 'Prix réel de la chambre' },
      { id: '8', category: 'TAXI', label: '🚕 Taxi', default_amount: 0, max_amount: 50, description: 'Prix réel de la course' },
    ];

    const saved = localStorage.getItem('admin_tarifs');
    if (saved) {
      setTarifs(JSON.parse(saved));
    } else {
      setTarifs(defaultTarifs);
      localStorage.setItem('admin_tarifs', JSON.stringify(defaultTarifs));
    }
    setLoading(false);
  }

  function handleSave() {
    if (!editing) return;

    const updated = tarifs.map(t => 
      t.id === editing 
        ? { ...t, default_amount: formData.default_amount || 0, max_amount: formData.max_amount || 0 }
        : t
    );

    setTarifs(updated);
    localStorage.setItem('admin_tarifs', JSON.stringify(updated));
    alert('✅ Tarif mis à jour !');
    setEditing(null);
  }

  function startEdit(tarif: TarifConfig) {
    setEditing(tarif.id);
    setFormData(tarif);
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">⏳ Chargement...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">💰 Gestion des Tarifs et Plafonds</h1>
        <p className="text-gray-600">
          Configuration des montants par défaut et des plafonds de remboursement
        </p>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <p className="text-sm text-blue-800">
          <strong>ℹ️ Information :</strong> Ces tarifs sont utilisés pour les calculs automatiques et les validations.
          Les montants réels peuvent varier selon les justificatifs fournis.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type de dépense
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Montant par défaut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plafond max
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tarifs.map((tarif) => (
              <tr key={tarif.id} className={editing === tarif.id ? 'bg-blue-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">{tarif.label}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600">{tarif.description}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editing === tarif.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={formData.default_amount}
                      onChange={(e) => setFormData({ ...formData, default_amount: parseFloat(e.target.value) })}
                      className="w-24 px-2 py-1 border rounded"
                    />
                  ) : (
                    <span className="text-sm text-gray-900">
                      {tarif.default_amount === 0 ? 'Prix réel' : `${tarif.default_amount.toFixed(2)} €`}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editing === tarif.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={formData.max_amount}
                      onChange={(e) => setFormData({ ...formData, max_amount: parseFloat(e.target.value) })}
                      className="w-24 px-2 py-1 border rounded"
                    />
                  ) : (
                    <span className="text-sm text-gray-900">{tarif.max_amount.toFixed(2)} €</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {editing === tarif.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        ✓ Sauvegarder
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                      >
                        ✕ Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(tarif)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      ✏️ Modifier
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">📊 Exemples de calcul</h3>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>🍽️ <strong>Repas :</strong> {tarifs.find(t => t.category === 'MEAL')?.default_amount.toFixed(2)} € par repas (max {tarifs.find(t => t.category === 'MEAL')?.max_amount} €)</li>
            <li>🏨 <strong>Hôtel :</strong> Prix réel (max {tarifs.find(t => t.category === 'HOTEL')?.max_amount} € par nuit)</li>
            <li>🚄 <strong>Train :</strong> Prix réel (max {tarifs.find(t => t.category === 'TRAIN')?.max_amount} €)</li>
          </ul>
        </div>

        <div className="bg-green-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">✅ Règles de validation</h3>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>✓ Montant ≤ Plafond : Validation automatique possible</li>
            <li>⚠️ Montant &gt; Plafond : Requiert justificatif + validation manuelle</li>
            <li>📎 Justificatif obligatoire pour tous les frais réels</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        <p>💡 <strong>Astuce :</strong> Les modifications sont sauvegardées localement et s'appliquent immédiatement.</p>
        <p>⚙️ Pour modifier les barèmes kilométriques, utilisez la page <a href="/admin/baremes" className="text-blue-600 underline">Barèmes</a>.</p>
      </div>
    </div>
  );
}
