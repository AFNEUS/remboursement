// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface Event {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  departure_city?: string;
}

interface EventBareme {
  id: string;
  event_id: string;
  expense_type: 'train' | 'avion' | 'covoiturage' | 'hebergement';
  bn_rate: number;
  admin_rate: number;
  other_rate: number;
  max_amount?: number;
  notes?: string;
  auto_calculated: boolean;
  sncf_price_young?: number;
  sncf_price_standard?: number;
  last_updated: string;
}

export default function EventBaremesPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [baremes, setBaremes] = useState<EventBareme[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [sncfPrices, setSncfPrices] = useState<any>(null);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const testUser = localStorage.getItem('test_user');
    if (testUser) {
      const parsed = JSON.parse(testUser);
      if (parsed.role !== 'ADMIN') {
        alert('❌ Accès refusé. Réservé aux Administrateurs.');
        router.push('/');
        return;
      }
      loadEvents();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = (userData as any)?.role;
    const isAdmin = role === 'ADMIN' || role === 'admin_asso';
    if (!isAdmin) {
      alert('❌ Accès refusé. Réservé aux Administrateurs.');
      router.push('/');
      return;
    }

    loadEvents();
  }

  async function loadEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: false });

    if (data) {
      setEvents(data);
      if (data.length > 0) {
        setSelectedEvent(data[0].id);
        loadBaremes(data[0].id);
      }
    }
    setLoading(false);
  }

  async function loadBaremes(eventId: string) {
    const { data, error } = await supabase
      .from('event_baremes')
      .select('*')
      .eq('event_id', eventId);

    setBaremes(data || []);
  }

  async function calculateSNCFPrices() {
    if (!selectedEvent) return;

    const event = events.find(e => e.id === selectedEvent);
    if (!event || !event.departure_city || !event.location) {
      alert('⚠️ L\'événement doit avoir une ville de départ et une destination configurées');
      return;
    }

    setCalculating(true);

    try {
      // Calculer la date 2 semaines avant l'événement
      const eventDate = new Date(event.start_date);
      const searchDate = new Date(eventDate);
      searchDate.setDate(searchDate.getDate() - 14);

      const response = await fetch('/api/sncf/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: event.departure_city,
          to: event.location,
          datetime: searchDate.toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur API SNCF');
      }

      const data = await response.json();
      setSncfPrices(data);

      // Proposer de créer/mettre à jour le barème automatiquement
      if (confirm(`Prix moyen tarif jeune trouvé : ${data.average_young_price}€\n\nVoulez-vous créer automatiquement le barème train pour cet événement ?\n\nBN: 80% = ${(data.average_young_price * 0.80).toFixed(2)}€\nAdmin: 65% = ${(data.average_young_price * 0.65).toFixed(2)}€\nAutres: 50% = ${(data.average_young_price * 0.50).toFixed(2)}€`)) {
        await createAutoBareme(data.average_young_price);
      }

    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}\n\nAssurez-vous d'avoir configuré SNCF_API_TOKEN dans les variables d'environnement.`);
    } finally {
      setCalculating(false);
    }
  }

  async function createAutoBareme(avgPrice: number) {
    if (!selectedEvent) return;

    const newBareme = {
      event_id: selectedEvent,
      expense_type: 'train',
      bn_rate: 0.80,
      admin_rate: 0.65,
      other_rate: 0.50,
      max_amount: avgPrice, // Prix moyen comme montant max
      sncf_price_young: avgPrice,
      sncf_price_standard: avgPrice * 1.30, // Estimation tarif standard
      auto_calculated: true,
      notes: `Calculé automatiquement via API SNCF le ${new Date().toLocaleDateString('fr-FR')}`,
      last_updated: new Date().toISOString(),
    };

    const existing = baremes.find(b => b.expense_type === 'train');

    if (existing) {
      const { error } = await supabase
        .from('event_baremes')
        .update(newBareme)
        .eq('id', existing.id);

      if (!error) {
        alert('✅ Barème train mis à jour automatiquement !');
        loadBaremes(selectedEvent);
      }
    } else {
      const { error } = await supabase
        .from('event_baremes')
        .insert(newBareme);

      if (!error) {
        alert('✅ Barème train créé automatiquement !');
        loadBaremes(selectedEvent);
      }
    }
  }

  async function createManualBareme(expenseType: string) {
    if (!selectedEvent) return;

    const defaultRates = {
      bn_rate: 0.80,
      admin_rate: 0.65,
      other_rate: 0.50,
    };

    const { error } = await supabase
      .from('event_baremes')
      .insert({
        event_id: selectedEvent,
        expense_type: expenseType,
        ...defaultRates,
        auto_calculated: false,
        last_updated: new Date().toISOString(),
      });

    if (!error) {
      alert('✅ Barème créé !');
      loadBaremes(selectedEvent);
    } else {
      alert(`❌ Erreur: ${error.message}`);
    }
  }

  async function updateBareme(id: string, field: string, value: number) {
    const { error } = await supabase
      .from('event_baremes')
      .update({ [field]: value, last_updated: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      loadBaremes(selectedEvent!);
    }
  }

  async function deleteBareme(id: string) {
    if (!confirm('Supprimer ce barème ?')) return;

    const { error } = await supabase
      .from('event_baremes')
      .delete()
      .eq('id', id);

    if (!error) {
      alert('✅ Barème supprimé');
      loadBaremes(selectedEvent!);
    }
  }

  const selectedEventData = events.find(e => e.id === selectedEvent);

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
        <h1 className="text-3xl font-bold mb-2">📊 Barèmes par Événement</h1>
        <p className="text-gray-600">Gérez les barèmes de remboursement pour chaque événement</p>
      </div>

      {/* Sélection événement */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="block font-semibold mb-2">Événement</label>
        <select
          value={selectedEvent || ''}
          onChange={(e) => {
            setSelectedEvent(e.target.value);
            loadBaremes(e.target.value);
            setSncfPrices(null);
          }}
          className="w-full p-3 border rounded-lg"
        >
          {events.map(event => (
            <option key={event.id} value={event.id}>
              {event.name} - {new Date(event.start_date).toLocaleDateString('fr-FR')}
              {event.departure_city && event.location && ` (${event.departure_city} → ${event.location})`}
            </option>
          ))}
        </select>
      </div>

      {selectedEventData && (
        <>
          {/* Calcul automatique SNCF */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">🚄</span>
              Calcul Automatique Prix Train (API SNCF)
            </h2>

            {selectedEventData.departure_city && selectedEventData.location ? (
              <>
                <div className="mb-4 text-sm text-gray-700">
                  <p className="mb-2">
                    <strong>Trajet:</strong> {selectedEventData.departure_city} → {selectedEventData.location}
                  </p>
                  <p className="mb-2">
                    <strong>Date recherche:</strong> 2 semaines avant l&apos;événement ({new Date(new Date(selectedEventData.start_date).setDate(new Date(selectedEventData.start_date).getDate() - 14)).toLocaleDateString('fr-FR')})
                  </p>
                  <p className="text-xs text-gray-500">
                    Le système va rechercher les prix moyens des billets train tarif jeune pour calculer automatiquement les barèmes BN/Admin/Autres
                  </p>
                </div>

                <button
                  onClick={calculateSNCFPrices}
                  disabled={calculating}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {calculating ? '⏳ Calcul en cours...' : '🔍 Calculer les prix automatiquement'}
                </button>

                {sncfPrices && (
                  <div className="mt-4 p-4 bg-white rounded border">
                    <h3 className="font-bold mb-2">Résultats API SNCF :</h3>
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Prix moyen tarif jeune</p>
                        <p className="text-2xl font-bold text-green-600">{sncfPrices.average_young_price}€</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Trajet le moins cher</p>
                        <p className="text-xl font-bold">{sncfPrices.cheapest.prices.young}€</p>
                        <p className="text-xs text-gray-500">{sncfPrices.cheapest.duration_formatted}, {sncfPrices.cheapest.transfers} corresp.</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Barèmes suggérés</p>
                        <p className="text-sm">BN: {(sncfPrices.average_young_price * 0.80).toFixed(2)}€</p>
                        <p className="text-sm">Admin: {(sncfPrices.average_young_price * 0.65).toFixed(2)}€</p>
                        <p className="text-sm">Autres: {(sncfPrices.average_young_price * 0.50).toFixed(2)}€</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{sncfPrices.note}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  ⚠️ Pour utiliser le calcul automatique, configurez la <strong>ville de départ</strong> et la <strong>destination</strong> de l&apos;événement dans la page Événements.
                </p>
              </div>
            )}
          </div>

          {/* Barèmes existants */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Barèmes configurés</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => createManualBareme('train')}
                  disabled={baremes.some(b => b.expense_type === 'train')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  + Train
                </button>
                <button
                  onClick={() => createManualBareme('avion')}
                  disabled={baremes.some(b => b.expense_type === 'avion')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  + Avion
                </button>
                <button
                  onClick={() => createManualBareme('covoiturage')}
                  disabled={baremes.some(b => b.expense_type === 'covoiturage')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  + Covoiturage
                </button>
                <button
                  onClick={() => createManualBareme('hebergement')}
                  disabled={baremes.some(b => b.expense_type === 'hebergement')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  + Hébergement
                </button>
              </div>
            </div>

            {baremes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">📋</div>
                <p>Aucun barème configuré pour cet événement</p>
                <p className="text-sm">Utilisez les boutons ci-dessus pour en créer</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">BN (80%)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin (65%)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Autres (50%)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {baremes.map((bareme) => (
                      <tr key={bareme.id} className={bareme.auto_calculated ? 'bg-blue-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold capitalize">{bareme.expense_type}</span>
                            {bareme.auto_calculated && (
                              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">Auto</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            step="0.01"
                            value={bareme.max_amount ? (bareme.max_amount * bareme.bn_rate).toFixed(2) : (bareme.bn_rate * 100).toFixed(0)}
                            onChange={(e) => updateBareme(bareme.id, 'bn_rate', parseFloat(e.target.value) / (bareme.max_amount || 100))}
                            className="w-20 px-2 py-1 border rounded"
                          />
                          <span className="ml-1 text-sm text-gray-500">{bareme.max_amount ? '€' : '%'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            step="0.01"
                            value={bareme.max_amount ? (bareme.max_amount * bareme.admin_rate).toFixed(2) : (bareme.admin_rate * 100).toFixed(0)}
                            onChange={(e) => updateBareme(bareme.id, 'admin_rate', parseFloat(e.target.value) / (bareme.max_amount || 100))}
                            className="w-20 px-2 py-1 border rounded"
                          />
                          <span className="ml-1 text-sm text-gray-500">{bareme.max_amount ? '€' : '%'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            step="0.01"
                            value={bareme.max_amount ? (bareme.max_amount * bareme.other_rate).toFixed(2) : (bareme.other_rate * 100).toFixed(0)}
                            onChange={(e) => updateBareme(bareme.id, 'other_rate', parseFloat(e.target.value) / (bareme.max_amount || 100))}
                            className="w-20 px-2 py-1 border rounded"
                          />
                          <span className="ml-1 text-sm text-gray-500">{bareme.max_amount ? '€' : '%'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            step="0.01"
                            value={bareme.max_amount || ''}
                            onChange={(e) => updateBareme(bareme.id, 'max_amount', parseFloat(e.target.value) || null)}
                            placeholder="Illimité"
                            className="w-24 px-2 py-1 border rounded"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-gray-600 max-w-xs">
                            {bareme.notes}
                            {bareme.sncf_price_young && (
                              <div className="mt-1 text-blue-600">
                                SNCF tarif jeune: {bareme.sncf_price_young}€
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => deleteBareme(bareme.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            🗑️ Suppr
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Stats récapitulatives */}
          <StatsRecap eventId={selectedEvent} />
        </>
      )}
    </div>
  );
}

function StatsRecap({ eventId }: { eventId: string }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadStats();
  }, [eventId]);

  async function loadStats() {
    const { data } = await supabase
      .from('expense_claims')
      .select('*, users!inner(status)')
      .eq('event_id', eventId);

    if (data) {
      const total = data.length;
      const validated = data.filter(d => d.status === 'VALIDATED' || d.status === 'PAID').length;
      const pending = data.filter(d => d.status === 'PENDING').length;
      const rejected = data.filter(d => d.status === 'REJECTED').length;

      const bnClaims = data.filter(d => d.users.status === 'BN');
      const adminClaims = data.filter(d => d.users.status === 'ADMIN');
      const otherClaims = data.filter(d => !['BN', 'ADMIN'].includes(d.users.status || ''));

      const totalAmount = data.reduce((sum, d) => sum + (parseFloat(d.validated_amount) || 0), 0);

      setStats({
        total,
        validated,
        pending,
        rejected,
        bnCount: bnClaims.length,
        adminCount: adminClaims.length,
        otherCount: otherClaims.length,
        totalAmount,
      });
    }
  }

  if (!stats) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">📈 Statistiques de l&apos;événement</h2>
      <div className="grid md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded">
          <p className="text-sm text-gray-600">Total demandes</p>
          <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
        </div>
        <div className="p-4 bg-green-50 rounded">
          <p className="text-sm text-gray-600">Validées/Payées</p>
          <p className="text-3xl font-bold text-green-600">{stats.validated}</p>
        </div>
        <div className="p-4 bg-yellow-50 rounded">
          <p className="text-sm text-gray-600">En attente</p>
          <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="p-4 bg-red-50 rounded">
          <p className="text-sm text-gray-600">Rejetées</p>
          <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-3 gap-4">
        <div className="p-4 border rounded">
          <p className="text-sm text-gray-600">👨‍💼 BN (80%)</p>
          <p className="text-2xl font-bold">{stats.bnCount} demandes</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-gray-600">🔧 Administrateurs (65%)</p>
          <p className="text-2xl font-bold">{stats.adminCount} demandes</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-gray-600">👤 Autres (50%)</p>
          <p className="text-2xl font-bold">{stats.otherCount} demandes</p>
        </div>
      </div>

      <div className="mt-6 p-4 bg-purple-50 rounded">
        <p className="text-sm text-gray-600">Montant total remboursé</p>
        <p className="text-4xl font-bold text-purple-600">{stats.totalAmount.toFixed(2)} €</p>
      </div>
    </div>
  );
}
