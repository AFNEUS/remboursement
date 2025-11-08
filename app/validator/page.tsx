// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function ValidatorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('submitted');
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [validationComment, setValidationComment] = useState('');
  const [adjustedAmount, setAdjustedAmount] = useState<string>('');
  
  useEffect(() => {
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      fetchClaims();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, user]);

  async function checkAccess() {
    const testUser = localStorage.getItem('test_user');
    if (testUser) {
      const parsedUser = JSON.parse(testUser);
      if (!['ADMIN', 'VALIDATOR', 'TREASURER'].includes(parsedUser.role)) {
        alert('❌ Accès refusé. Page réservée aux validateurs.');
        router.push('/');
        return;
      }
      setUser(parsedUser);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('❌ Vous devez être connecté.');
      router.push('/');
      return;
    }

    const { data: userData } = await supabase.rpc('get_current_user_safe');
    
    // Mapper role DB vers UI pour vérification
    const roleMap: Record<string, string> = {
      'admin_asso': 'ADMIN',
      'treasurer': 'TREASURER',
      'validator': 'VALIDATOR',
      'bn_member': 'BN',
      'user': 'MEMBER'
    };
    const mappedRole = userData ? roleMap[userData.role] || userData.role : null;
    
    if (!userData || !['ADMIN', 'VALIDATOR', 'TREASURER'].includes(mappedRole || '')) {
      alert('❌ Accès refusé. Page réservée aux validateurs.');
      router.push('/');
      return;
    }

    setUser(user);
    setLoading(false);
  }
  
  const fetchClaims = async () => {
    try {
      const { data, error } = await supabase
        .from('claims_enriched')
        .select('*')
        .eq('status', filter)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setClaims(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };
  
  async function loadClaimDetails(claimId: string) {
    try {
      const { data: items } = await supabase
        .from('expense_items')
        .select('*')
        .eq('claim_id', claimId);

      const { data: justificatifs } = await supabase
        .from('justificatifs')
        .select('*')
        .eq('claim_id', claimId);

      const claim = claims.find(c => c.id === claimId);
      if (claim) {
        setSelectedClaim({ ...claim, items: items || [], justificatifs: justificatifs || [] });
        setAdjustedAmount(claim.total_amount.toString());
        setShowDetails(true);
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  }
  
  const handleAction = async (claimId: string, action: string, reason?: string) => {
    try {
      if (action === 'validate') {
        const finalAmount = adjustedAmount ? parseFloat(adjustedAmount) : selectedClaim.total_amount;
        
        const { error } = await supabase
          .from('expense_claims')
          .update({
            status: 'validated',
            validated_amount: finalAmount,
            validator_id: user.id,
            validated_at: new Date().toISOString(),
            validation_comment: validationComment || null,
          })
          .eq('id', claimId);

        if (error) throw error;
        alert('✅ Demande validée !');
      } else if (action === 'reject') {
        const { error } = await supabase
          .from('expense_claims')
          .update({
            status: 'rejected',
            validator_id: user.id,
            validated_at: new Date().toISOString(),
            rejected_reason: reason,
          })
          .eq('id', claimId);

        if (error) throw error;
        alert('❌ Demande rejetée');
      }
      
      setShowDetails(false);
      setValidationComment('');
      setAdjustedAmount('');
      fetchClaims();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    }
  };
  
  
  function formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">✅ Validation des demandes</h1>
          <p className="text-gray-600">Vérifiez et validez les demandes de remboursement</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('submitted')}
            className={`px-4 py-2 rounded font-semibold transition ${filter === 'submitted' ? 'bg-orange-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            En attente
          </button>
          <button
            onClick={() => setFilter('validated')}
            className={`px-4 py-2 rounded font-semibold transition ${filter === 'validated' ? 'bg-green-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            Validées
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-4 py-2 rounded font-semibold transition ${filter === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            Rejetées
          </button>
        </div>
      </div>
      
      {claims.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-gray-500 text-lg">Aucune demande {filter === 'submitted' ? 'en attente' : filter === 'validated' ? 'validée' : 'rejetée'}</p>
        </div>
      ) : showDetails && selectedClaim ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">{selectedClaim.user_first_name} {selectedClaim.user_last_name}</h2>
            <button onClick={() => setShowDetails(false)} className="text-gray-500 hover:text-gray-700 text-2xl">✖️</button>
          </div>

          <div className="mb-6">
            <p className="text-gray-600 mb-2">{selectedClaim.description}</p>
            <div className="flex gap-4 text-sm">
              <span>📧 {selectedClaim.user_email}</span>
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">{selectedClaim.user_status_code}</span>
              <span>📅 {formatDate(selectedClaim.created_at)}</span>
            </div>
          </div>

          {selectedClaim.items && selectedClaim.items.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Dépenses ({selectedClaim.items.length})</h3>
              <div className="space-y-3">
                {selectedClaim.items.map((item: any, idx: number) => (
                  <div key={item.id} className="border rounded p-4 bg-gray-50">
                    <div className="flex justify-between">
                      <div>
                        <div className="font-medium">{idx + 1}. {item.description}</div>
                        <div className="text-sm text-gray-600">{formatDate(item.expense_date)}</div>
                      </div>
                      <div className="text-lg font-bold text-blue-600">{formatAmount(item.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-blue-50 rounded-lg mb-6">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold">Montant total :</span>
              <span className="text-2xl font-bold text-blue-600">{formatAmount(selectedClaim.total_amount)}</span>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Montant validé :</label>
              <input
                type="number"
                step="0.01"
                value={adjustedAmount}
                onChange={(e) => setAdjustedAmount(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="Laisser vide pour valider le montant demandé"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">Commentaire (optionnel)</label>
            <textarea
              value={validationComment}
              onChange={(e) => setValidationComment(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border rounded"
              placeholder="Remarques..."
            />
          </div>

          {selectedClaim.status === 'submitted' && (
            <div className="flex gap-3">
              <button
                onClick={() => handleAction(selectedClaim.id, 'validate')}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
              >
                ✅ Valider
              </button>
              <button
                onClick={() => {
                  const reason = prompt('Raison du rejet :');
                  if (reason) handleAction(selectedClaim.id, 'reject', reason);
                }}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
              >
                ❌ Rejeter
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Demandeur</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Montant</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {claims.map((claim) => (
                <tr key={claim.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium">{claim.user_first_name} {claim.user_last_name}</div>
                    <div className="text-xs text-gray-500">{claim.user_status_code}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">{claim.description}</td>
                  <td className="px-6 py-4 text-sm">{formatDate(claim.created_at)}</td>
                  <td className="px-6 py-4 text-right font-bold text-blue-600">{formatAmount(claim.total_amount)}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => loadClaimDetails(claim.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold"
                    >
                      📋 Voir détails
                    </button>
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
