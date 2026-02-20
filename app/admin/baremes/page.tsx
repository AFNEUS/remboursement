'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface Bareme {
  id: string;
  cv_fiscaux: number;
  rate_per_km: number;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
}

export default function BaremesAdminPage() {
  const router = useRouter();
  const [baremes, setBaremes] = useState<Bareme[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Bareme>>({});
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAdmin() {

    const { data } = await supabase.rpc('get_current_user_safe');
    if (!data || !Array.isArray(data) || (data as any[]).length === 0) {
      router.push('/');
      return;
    }

    const user = (data as any[])[0];
    if (user.role !== 'admin_asso') {
      alert('❌ Accès refusé - Réservé aux administrateurs');
      router.push('/');
      return;
    }

    setCheckingAuth(false);
    loadBaremes();
  }

  async function loadBaremes() {
    const { data, error } = await supabase
      .from('baremes')
      .select('*')
      .is('valid_to', null)
      .order('cv_fiscaux', { ascending: true });
    
    if (data) setBaremes(data);
    setLoading(false);
  }

  async function handleSave() {
    if (!editing || !formData.rate_per_km) return;

    const { error } = await supabase
      .from('baremes')
      // @ts-ignore - Supabase generated types incorrectly mark update as 'never'
      .update({ rate_per_km: formData.rate_per_km })
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

  if (checkingAuth || loading) {
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
          <strong>ℹ️ Information :</strong> Les barèmes kilométriques incluent tous les frais liés à l&apos;utilisation du véhicule 
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
                Taux par km (€)
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
                  <span className="text-sm font-medium text-gray-900">{bareme.cv_fiscaux} CV</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editing === bareme.id ? (
                    <input
                      type="number"
                      step="0.001"
                      value={formData.rate_per_km}
                      onChange={(e) => setFormData({ ...formData, rate_per_km: parseFloat(e.target.value) })}
                      className="w-32 px-2 py-1 border rounded"
                    />
                  ) : (
                    <span className="text-sm text-gray-900">{bareme.rate_per_km?.toFixed(3)} €</span>
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
          <li>Montant = 150 km × {baremes.find(b => b.cv_fiscaux === 5)?.rate_per_km?.toFixed(3) || '0.000'} € = {(150 * (baremes.find(b => b.cv_fiscaux === 5)?.rate_per_km || 0)).toFixed(2)} €</li>
          <li>Si aller-retour : {(300 * (baremes.find(b => b.cv_fiscaux === 5)?.rate_per_km || 0)).toFixed(2)} €</li>
        </ul>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        <p>💡 <strong>Astuce :</strong> Les barèmes kilométriques sont basés sur les barèmes fiscaux officiels 2024.</p>
        <p>Les modifications prennent effet immédiatement pour toutes les nouvelles demandes.</p>
      </div>
    </div>
  );
}
