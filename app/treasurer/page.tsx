// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function TreasurerDashboard() {
  const router = useRouter();
  const [claims, setClaims] = useState<any[]>([]);
  const [selectedClaims, setSelectedClaims] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAccess() {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('❌ Vous devez être connecté.');
      router.push('/');
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

    if (!userData || !['ADMIN', 'TREASURER'].includes(mappedRole || '')) {
      alert('❌ Accès refusé. Page réservée aux trésoriers.');
      router.push('/');
      return;
    }

    fetchValidatedClaims();
  }

  const fetchValidatedClaims = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expense_claims')
        .select(`
          *,
          users!expense_claims_user_id_fkey (
            full_name,
            email,
            iban
          )
        `)
        .in('status', ['validated', 'in_payment_batch'])
        .order('validated_at', { ascending: true });

      if (error) throw error;

      setClaims(data || []);
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleClaim = (claimId: string) => {
    const newSelected = new Set(selectedClaims);
    if (newSelected.has(claimId)) {
      newSelected.delete(claimId);
    } else {
      newSelected.add(claimId);
    }
    setSelectedClaims(newSelected);
  };

  const selectAll = () => {
    if (selectedClaims.size === claims.filter(c => c.status === 'validated').length) {
      setSelectedClaims(new Set());
    } else {
      setSelectedClaims(new Set(claims.filter(c => c.status === 'validated').map(c => c.id)));
    }
  };

  const exportSEPA = async () => {
    if (selectedClaims.size === 0) {
      alert('Veuillez sélectionner au moins une demande');
      return;
    }

    setExporting(true);
    try {
      const response = await fetch('/api/export/sepa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important: inclure les cookies de session
        body: JSON.stringify({
          claim_ids: Array.from(selectedClaims),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur export');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sepa-export-${new Date().toISOString().split('T')[0]}.xml`;
      a.click();

      // Rafraîchir la liste
      await fetchValidatedClaims();
      setSelectedClaims(new Set());
    } catch (error: any) {
      alert(error.message);
    } finally {
      setExporting(false);
    }
  };

  const totalAmount = claims
    .filter(c => selectedClaims.has(c.id))
    .reduce((sum, c) => sum + (c.reimbursable_amount || 0), 0);

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Trésorerie - Paiements</h1>
        <div className="flex gap-3">
          <button
            onClick={() => window.open('/api/export/sepa?format=csv', '_blank')}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
          >
            📊 Export CSV
          </button>
          <button
            onClick={exportSEPA}
            disabled={selectedClaims.size === 0 || exporting}
            className={`px-6 py-2 rounded-lg font-semibold ${
              selectedClaims.size === 0 || exporting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {exporting ? '⏳ Export...' : `💳 Générer SEPA (${selectedClaims.size})`}
          </button>
        </div>
      </div>

      {/* Résumé */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">À payer</p>
          <p className="text-2xl font-bold text-blue-600">
            {claims.filter(c => c.status === 'validated').length}
          </p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">En cours</p>
          <p className="text-2xl font-bold text-orange-600">
            {claims.filter(c => c.status === 'in_payment_batch').length}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Sélectionnées</p>
          <p className="text-2xl font-bold text-green-600">{selectedClaims.size}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Montant total</p>
          <p className="text-2xl font-bold text-purple-600">{totalAmount.toFixed(2)} €</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : claims.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">Aucune demande validée en attente de paiement</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedClaims.size === claims.filter(c => c.status === 'validated').length}
                    onChange={selectAll}
                    className="w-4 h-4"
                  />
                </th>
                <th className="px-4 py-3 text-left">Bénéficiaire</th>
                <th className="px-4 py-3 text-left">IBAN</th>
                <th className="px-4 py-3 text-left">Référence</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {claims.map((claim) => (
                <tr
                  key={claim.id}
                  className={`hover:bg-gray-50 ${
                    selectedClaims.has(claim.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    {claim.status === 'validated' && (
                      <input
                        type="checkbox"
                        checked={selectedClaims.has(claim.id)}
                        onChange={() => toggleClaim(claim.id)}
                        className="w-4 h-4"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold">{claim.users?.full_name}</p>
                      <p className="text-xs text-gray-500">{claim.users?.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">
                    {claim.users?.iban ? 
                      `${claim.users.iban.slice(0, 4)} **** **** ${claim.users.iban.slice(-4)}` 
                      : '⚠️ Manquant'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {claim.reference || claim.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(claim.expense_date).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {claim.reimbursable_amount?.toFixed(2)} €
                  </td>
                  <td className="px-4 py-3 text-center">
                    {claim.status === 'validated' ? (
                      <span className="px-2 py-1 bg-green-200 text-green-800 rounded text-xs">
                        Validée
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-orange-200 text-orange-800 rounded text-xs">
                        En lot
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
