// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface DashboardData {
  global: any;
  recent_months: any[];
  carpooling: any[];
  pending_claims: any[];
  recent_events: any[];
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  'CONGRES_ANNUEL': '🎓 Congrès annuel',
  'WEEKEND_PASSATION': '🔄 Week-end de passation',
  'FORMATION': '📚 Formation',
  'REUNION_BN': '🏛️ Réunion BN',
  'REUNION_REGION': '🗺️ Réunion régionale',
  'EVENEMENT_EXTERNE': '🤝 Événement externe',
  'AUTRE': '📌 Autre',
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [user, setUser] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  async function loadUser() {
    try {

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.push('/auth/login');
        return;
      }

      // Récupérer profil avec retry simple
      let userData = null;
      let attempts = 0;
      
      while (!userData && attempts < 5) {
        const { data } = await supabase.rpc('get_current_user_safe');
        if (data) {
          userData = data;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        attempts++;
      }

      if (!userData) {
        router.push('/auth/login');
        return;
      }

      setUser(userData);
      setLoading(false);
    } catch (error) {
      router.push('/auth/login');
    }
  }

  async function loadDashboardData() {
    setLoading(true);
    try {
      // Note: Vues statistiques à créer ultérieurement
      // Pour l'instant, requêtes basiques
      
            // Charger récents claims en attente
      const { data: recentClaims } = await supabase
        .from('expense_claims')
        .select('*, users(full_name, email)')
        .in('status', ['submitted', 'to_validate', 'incomplete'])
        .order('created_at', { ascending: false })
        .limit(10);

      // Charger événements récents
      const { data: recentEvents } = await supabase
        .from('events')
        .select('*')
        .gte('start_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('start_date', { ascending: false })
        .limit(5);

      // Stats basiques
      const { count: totalClaims } = await supabase
        .from('expense_claims')
        .select('*', { count: 'exact', head: true });

      setData({
        global: { total_claims: totalClaims || 0 },
        recent_months: [],
        carpooling: [],
        pending_claims: pendingClaims || [],
        recent_events: recentEvents || [],
      });
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function formatMonth(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
    });
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.global) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-gray-600">Aucune donnée disponible</p>
        </div>
      </div>
    );
  }

  const global = data.global;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">📊 Dashboard AFNEUS</h1>
        <p className="text-gray-600">Vue d&apos;ensemble et statistiques de remboursement</p>
      </div>

      {/* STATISTIQUES GLOBALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-sm opacity-90 mb-1">Total demandes</div>
          <div className="text-3xl font-bold">{global.total_claims || 0}</div>
          <div className="text-xs opacity-75 mt-2">
            {global.active_members || 0} membres actifs
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-sm opacity-90 mb-1">En attente validation</div>
          <div className="text-3xl font-bold">{global.pending_validation || 0}</div>
          <div className="text-xs opacity-75 mt-2">
            {global.pending_payment || 0} à payer
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-sm opacity-90 mb-1">Total payé</div>
          <div className="text-3xl font-bold">{formatAmount(parseFloat(global.total_paid || 0))}</div>
          <div className="text-xs opacity-75 mt-2">
            {global.paid_claims || 0} demandes
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6">
          <div className="text-sm opacity-90 mb-1">Économies covoiturage</div>
          <div className="text-3xl font-bold">{formatAmount(parseFloat(global.total_carpooling_savings || 0))}</div>
          <div className="text-xs opacity-75 mt-2">
            {global.total_carpooling_trips || 0} trajets partagés
          </div>
        </div>
      </div>

      {/* DÉTAILS KILOMÈTRES ET TGV MAX */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">🚗 Kilomètres totaux</h3>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {(parseInt(global.total_kilometers || 0)).toLocaleString('fr-FR')} km
          </div>
          <div className="text-sm text-gray-500 mt-2">
            {global.total_expense_items || 0} lignes de dépense
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">🚄 TGV Max</h3>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {global.members_with_tgvmax || 0} membres
          </div>
          <div className="text-sm text-gray-500 mt-2">
            avec abonnement actif
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">❌ Rejets</h3>
          </div>
          <div className="text-2xl font-bold text-red-600">
            {global.rejected_claims || 0}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            demandes rejetées
          </div>
        </div>
      </div>

      {/* COMPTABILITÉ MENSUELLE */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">💰 Comptabilité mensuelle</h2>
        </div>
        <div className="p-6 overflow-x-auto">
          {data.recent_months.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune donnée disponible</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Mois</th>
                  <th className="text-right py-3 px-4 font-semibold text-sm text-gray-700">Demandes</th>
                  <th className="text-right py-3 px-4 font-semibold text-sm text-gray-700">Demandé</th>
                  <th className="text-right py-3 px-4 font-semibold text-sm text-gray-700">Validé</th>
                  <th className="text-right py-3 px-4 font-semibold text-sm text-gray-700">Payé</th>
                  <th className="text-right py-3 px-4 font-semibold text-sm text-gray-700">À payer</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_months.map((month: any, idx: number) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{formatMonth(month.month)}</td>
                    <td className="py-3 px-4 text-sm text-right">{month.claims_count || 0}</td>
                    <td className="py-3 px-4 text-sm text-right">{formatAmount(parseFloat(month.requested_amount || 0))}</td>
                    <td className="py-3 px-4 text-sm text-right text-blue-600">{formatAmount(parseFloat(month.validated_amount || 0))}</td>
                    <td className="py-3 px-4 text-sm text-right text-green-600">{formatAmount(parseFloat(month.paid_amount || 0))}</td>
                    <td className="py-3 px-4 text-sm text-right text-orange-600">{formatAmount(parseFloat(month.pending_payment || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ANALYSE COVOITURAGE */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">🚗 Analyse covoiturage & économies</h2>
        </div>
        <div className="p-6 overflow-x-auto">
          {data.carpooling.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune donnée de covoiturage</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Mois</th>
                  <th className="text-right py-3 px-4 font-semibold text-sm text-gray-700">Trajets covoiturage</th>
                  <th className="text-right py-3 px-4 font-semibold text-sm text-gray-700">Trajets solo</th>
                  <th className="text-right py-3 px-4 font-semibold text-sm text-gray-700">Passagers moy.</th>
                  <th className="text-right py-3 px-4 font-semibold text-sm text-gray-700">Bonus versé</th>
                  <th className="text-right py-3 px-4 font-semibold text-sm text-gray-700">Économie AFNEUS</th>
                </tr>
              </thead>
              <tbody>
                {data.carpooling.map((carp: any, idx: number) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{formatMonth(carp.month)}</td>
                    <td className="py-3 px-4 text-sm text-right text-green-600">{carp.carpooling_trips || 0}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-500">{carp.solo_trips || 0}</td>
                    <td className="py-3 px-4 text-sm text-right">{parseFloat(carp.avg_passengers_per_car || 0).toFixed(1)}</td>
                    <td className="py-3 px-4 text-sm text-right text-orange-600">{formatAmount(parseFloat(carp.total_bonus_paid || 0))}</td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-purple-600">
                      {formatAmount(parseFloat(carp.savings_for_afneus || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ÉVÉNEMENTS RÉCENTS */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">📅 Événements récents</h2>
        </div>
        <div className="p-6">
          {data.recent_events.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun événement récent</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.recent_events.map((event: any) => (
                <div key={event.event_id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold text-sm">{event.event_name}</div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mb-3">
                    📍 {event.location || 'Non précisé'}<br/>
                    📅 {formatDate(event.start_date)} {event.end_date !== event.start_date && `→ ${formatDate(event.end_date)}`}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-gray-500">Demandes</div>
                      <div className="font-semibold">{event.total_claims || 0}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Membres</div>
                      <div className="font-semibold">{event.unique_members || 0}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Montant payé</div>
                      <div className="font-semibold text-green-600">{formatAmount(parseFloat(event.total_paid || 0))}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">En attente</div>
                      <div className="font-semibold text-orange-600">{event.pending_claims || 0}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DEMANDES EN ATTENTE */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">⏳ Demandes en attente de validation</h2>
        </div>
        <div className="p-6">
          {data.pending_claims.length === 0 ? (
            <p className="text-gray-500 text-center py-8">✅ Aucune demande en attente</p>
          ) : (
            <div className="space-y-3">
              {data.pending_claims.map((claim: any) => (
                <div key={claim.id} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push('/validator')}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1">
                        {claim.user_first_name} {claim.user_last_name}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">{claim.description}</div>
                      <div className="text-xs text-gray-500">
                        Créée le {formatDate(claim.created_at)}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-blue-600">
                        {formatAmount(parseFloat(claim.total_amount))}
                      </div>
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                        En attente
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
