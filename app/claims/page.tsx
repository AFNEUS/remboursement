// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
    fetchMyClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMyClaims = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        window.location.href = '/auth/login'; // Rediriger si non authentifié
        return;
      }

      let query = supabase
        .from('expense_claims')
        .select(`
          *,
          users!expense_claims_user_id_fkey (
            first_name,
            last_name,
            email
          )
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setClaims(data || []);
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-200 text-gray-800',
      submitted: 'bg-yellow-200 text-yellow-800',
      needs_info: 'bg-orange-200 text-orange-800',
      validated: 'bg-green-200 text-green-800',
      rejected: 'bg-red-200 text-red-800',
      paid: 'bg-blue-200 text-blue-800',
    };

    const labels: Record<string, string> = {
      draft: 'Brouillon',
      submitted: 'En attente',
      needs_info: 'Info requise',
      validated: 'Validée',
      rejected: 'Refusée',
      paid: 'Payée',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-200'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mes demandes de remboursement</h1>
        <a
          href="/claims/new"
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + Nouvelle demande
        </a>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { key: 'all', label: 'Toutes' },
          { key: 'draft', label: 'Brouillons' },
          { key: 'submitted', label: 'En attente' },
          { key: 'validated', label: 'Validées' },
          { key: 'rejected', label: 'Refusées' },
          { key: 'paid', label: 'Payées' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded whitespace-nowrap ${
              filter === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      ) : claims.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">Aucune demande trouvée</p>
          <a
            href="/claims/new"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Créer votre première demande
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">
                      {claim.expense_type === 'car' ? '🚗' :
                       claim.expense_type === 'train' ? '🚄' :
                       claim.expense_type === 'hotel' ? '🏨' :
                       claim.expense_type === 'meal' ? '🍽️' :
                       claim.expense_type === 'plane' ? '✈️' :
                       claim.expense_type === 'bus' ? '🚌' :
                       claim.expense_type === 'toll' ? '🛣️' :
                       claim.expense_type === 'parking' ? '🅿️' :
                       claim.expense_type === 'taxi' ? '🚕' : '📄'} {claim.description || 'Sans description'}
                    </h3>
                    {getStatusBadge(claim.status)}
                  </div>
                  <p className="text-sm text-gray-600">
                    Référence: <span className="font-mono">{claim.reference || claim.id.slice(0, 8)}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Date: {new Date(claim.expense_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">
                    {claim.reimbursable_amount?.toFixed(2) || '0.00'} €
                  </p>
                  <p className="text-sm text-gray-500">
                    sur {claim.amount_ttc?.toFixed(2) || '0.00'} € TTC
                  </p>
                </div>
              </div>

              {claim.expense_type === 'car' && claim.departure_location && (
                <div className="flex gap-6 text-sm text-gray-600 mb-4">
                  <span>📍 {claim.departure_location} → {claim.arrival_location}</span>
                  <span>🛣️ {claim.distance_km} km</span>
                  <span>🚙 {claim.cv_fiscaux} CV</span>
                </div>
              )}

              {claim.expense_type === 'train' && claim.departure_location && (
                <div className="flex gap-6 text-sm text-gray-600 mb-4">
                  <span>🚉 {claim.departure_location} → {claim.arrival_location}</span>
                  {claim.distance_km && <span>📏 {claim.distance_km} km</span>}
                </div>
              )}

              {claim.expense_type === 'hotel' && claim.merchant_name && (
                <div className="flex gap-6 text-sm text-gray-600 mb-4">
                  <span>🏨 {claim.merchant_name}</span>
                  {claim.arrival_location && <span>📍 {claim.arrival_location}</span>}
                </div>
              )}

              {claim.expense_type === 'meal' && claim.merchant_name && (
                <div className="flex gap-6 text-sm text-gray-600 mb-4">
                  <span>🍽️ {claim.merchant_name}</span>
                </div>
              )}

              {claim.validator_comment && (
                <div className="mt-4 p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                  <p className="text-sm font-semibold mb-1">💬 Commentaire validateur :</p>
                  <p className="text-sm text-gray-700">{claim.validator_comment}</p>
                </div>
              )}

              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <span className="text-xs text-gray-500">
                  Créée le {new Date(claim.created_at).toLocaleDateString('fr-FR')} à{' '}
                  {new Date(claim.created_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <div className="flex gap-2">
                  {claim.status === 'draft' && (
                    <button className="text-blue-600 hover:underline text-sm">
                      ✏️ Modifier
                    </button>
                  )}
                  <button className="text-gray-600 hover:underline text-sm">
                    👁️ Détails
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
