'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

interface Bareme {
  id: string;
  fiscal_power: number;
  rate_0_5000: number;
  rate_5001_20000: number;
  rate_20001_plus: number;
  effective_from: string;
  active: boolean;
}

export default function BaremesAdminPage() {
  const [baremes, setBaremes] = useState<Bareme[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Bareme>>({});

  useEffect(() => {
    loadBaremes();
  }, []);

  async function loadBaremes() {
    const { data, error } = await supabase
      .from('baremes')
      .select('*')
      .order('fiscal_power', { ascending: true });
    
    if (data) setBaremes(data);
    setLoading(false);
  }

  async function handleSave() {
    if (!editing || !formData.rate_0_5000 || !formData.rate_5001_20000 || !formData.rate_20001_plus) return;

    const { error } = await supabase
      .from('baremes')
      .update({
        rate_0_5000: formData.rate_0_5000,
        rate_5001_20000: formData.rate_5001_20000,
        rate_20001_plus: formData.rate_20001_plus,
      } as never)
      .eq('id', editing);

    if (!error) {
      alert('✅ Barème mis à jour !');
      setEditing(null);
      loadBaremes();
    } else {
      alert('❌ Erreur : ' + error.message);
    }
  }

  function startEdit(bareme: Bareme) {
    setEditing(bareme.id);
    setFormData(bareme);
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
        <h1 className="text-3xl font-bold mb-2">🚗 Gestion des Barèmes Kilométriques</h1>
        <p className="text-gray-600">
          Configuration des taux de remboursement selon la puissance fiscale du véhicule
        </p>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <p className="text-sm text-yellow-800">
          <strong>ℹ️ Information :</strong> Les barèmes kilométriques incluent tous les frais liés à l'utilisation du véhicule 
          (carburant, assurance, entretien, amortissement). Les taux sont exprimés en € par kilomètre.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Puissance fiscale
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                0 à 5 000 km
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                5 001 à 20 000 km
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                + de 20 000 km
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {baremes.map((bareme) => (
              <tr key={bareme.id} className={editing === bareme.id ? 'bg-blue-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">{bareme.fiscal_power} CV</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editing === bareme.id ? (
                    <input
                      type="number"
                      step="0.001"
                      value={formData.rate_0_5000}
                      onChange={(e) => setFormData({ ...formData, rate_0_5000: parseFloat(e.target.value) })}
                      className="w-24 px-2 py-1 border rounded"
                    />
                  ) : (
                    <span className="text-sm text-gray-900">{bareme.rate_0_5000?.toFixed(3)} €</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editing === bareme.id ? (
                    <input
                      type="number"
                      step="0.001"
                      value={formData.rate_5001_20000}
                      onChange={(e) => setFormData({ ...formData, rate_5001_20000: parseFloat(e.target.value) })}
                      className="w-24 px-2 py-1 border rounded"
                    />
                  ) : (
                    <span className="text-sm text-gray-900">{bareme.rate_5001_20000?.toFixed(3)} €</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editing === bareme.id ? (
                    <input
                      type="number"
                      step="0.001"
                      value={formData.rate_20001_plus}
                      onChange={(e) => setFormData({ ...formData, rate_20001_plus: parseFloat(e.target.value) })}
                      className="w-24 px-2 py-1 border rounded"
                    />
                  ) : (
                    <span className="text-sm text-gray-900">{bareme.rate_20001_plus?.toFixed(3)} €</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {editing === bareme.id ? (
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
                      onClick={() => startEdit(bareme)}
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

      <div className="mt-6 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">📊 Exemple de calcul</h3>
        <p className="text-sm text-gray-700 mb-2">
          Pour un trajet de <strong>150 km</strong> avec un véhicule de <strong>5 CV</strong> :
        </p>
        <ul className="text-sm text-gray-600 space-y-1 ml-6 list-disc">
          <li>Montant = 150 km × {baremes.find(b => b.fiscal_power === 5)?.rate_0_5000?.toFixed(3) || '0.000'} € = {(150 * (baremes.find(b => b.fiscal_power === 5)?.rate_0_5000 || 0)).toFixed(2)} €</li>
          <li>Si aller-retour : {(300 * (baremes.find(b => b.fiscal_power === 5)?.rate_0_5000 || 0)).toFixed(2)} €</li>
        </ul>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        <p>💡 <strong>Astuce :</strong> Les barèmes kilométriques sont basés sur les barèmes fiscaux officiels 2024.</p>
        <p>Les modifications prennent effet immédiatement pour toutes les nouvelles demandes.</p>
      </div>
    </div>
  );
}
