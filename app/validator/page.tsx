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
    
    if (!userData || !Array.isArray(userData) || (userData as any[]).length === 0) {
      router.push('/');
      return;
    }
    
    const dbUser = (userData as any[])[0];
    
    // Mapper role DB vers UI pour vérification
    const roleMap: Record<string, string> = {
      'admin_asso': 'ADMIN',
      'treasurer': 'TREASURER',
      'validator': 'VALIDATOR',
      'bn_member': 'BN',
      'user': 'MEMBER'
    };
    const mappedRole = roleMap[dbUser.role] || 'MEMBER';
    
    if (!['ADMIN', 'VALIDATOR', 'TREASURER'].includes(mappedRole)) {
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
        .from('expense_claims')
        .select(`
          *,
          users!expense_claims_user_id_fkey (
            full_name,
            email
          )
        `)
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
      // Note: expense_items table n'existe plus, les détails sont dans expense_claims
      const { data: justificatifs } = await supabase
        .from('justificatifs')
        .select('*')
        .eq('expense_claim_id', claimId);

      const claim = claims.find(c => c.id === claimId);
      if (claim) {
        setSelectedClaim({ ...claim, justificatifs: justificatifs || [] });
        setAdjustedAmount(claim.total_amount?.toString() || '0');
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
            <h2 className="text-2xl font-bold">
              {selectedClaim.users?.full_name || `${selectedClaim.user_first_name || ''} ${selectedClaim.user_last_name || ''}`.trim() || 'Utilisateur'}
            </h2>
            <button onClick={() => setShowDetails(false)} className="text-gray-500 hover:text-gray-700 text-2xl">✖️</button>
          </div>

          <div className="mb-6">
            <p className="text-gray-600 mb-2">{selectedClaim.description}</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>📧 {selectedClaim.users?.email || selectedClaim.user_email}</span>
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">{selectedClaim.expense_type}</span>
              <span>📅 Créé: {formatDate(selectedClaim.created_at)}</span>
              <span>📅 Dépense: {formatDate(selectedClaim.expense_date)}</span>
            </div>
          </div>

          {/* Détails de la dépense */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Détails de la dépense</h3>
            <div className="border rounded p-4 bg-gray-50 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium">{selectedClaim.expense_type}</span>
              </div>
              {selectedClaim.merchant_name && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Marchand:</span>
                  <span className="font-medium">{selectedClaim.merchant_name}</span>
                </div>
              )}
              {selectedClaim.departure_location && selectedClaim.arrival_location && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Trajet:</span>
                  <span className="font-medium">{selectedClaim.departure_location} → {selectedClaim.arrival_location}</span>
                </div>
              )}
              {selectedClaim.distance_km && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Distance:</span>
                  <span className="font-medium">{selectedClaim.distance_km} km</span>
                </div>
              )}
              {selectedClaim.cv_fiscaux && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Puissance fiscale:</span>
                  <span className="font-medium">{selectedClaim.cv_fiscaux} CV</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-gray-600">Montant TTC:</span>
                <span className="font-bold">{formatAmount(selectedClaim.amount_ttc || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Montant calculé:</span>
                <span className="font-bold">{formatAmount(selectedClaim.calculated_amount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Taux appliqué:</span>
                <span className="font-bold">{((selectedClaim.taux_applied || 0) * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Justificatifs */}
          {selectedClaim.justificatifs && selectedClaim.justificatifs.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Justificatifs ({selectedClaim.justificatifs.length})</h3>
              <div className="space-y-2">
                {selectedClaim.justificatifs.map((justif: any) => (
                  <div key={justif.id} className="border rounded p-3 bg-gray-50 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{justif.original_filename}</div>
                      <div className="text-xs text-gray-500">{justif.file_type} • {(justif.file_size / 1024).toFixed(1)} KB</div>
                    </div>
                    <a
                      href={justif.storage_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      📥 Voir
                    </a>
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
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
                    <div className="font-medium">{claim.users?.full_name || 'Utilisateur'}</div>
                    <div className="text-xs text-gray-500">{claim.users?.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-medium">
                      {claim.expense_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm max-w-xs truncate">{claim.description}</td>
                  <td className="px-6 py-4 text-sm">{formatDate(claim.expense_date || claim.created_at)}</td>
                  <td className="px-6 py-4 text-right font-bold text-blue-600">{formatAmount(claim.total_amount || claim.reimbursable_amount || 0)}</td>
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
