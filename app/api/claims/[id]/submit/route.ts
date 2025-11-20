// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/claims/[id]/submit
 * Soumettre une demande de remboursement (draft → submitted)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const claimId = params.id;

    // Authentification
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
      }

      userId = user.id;
    } else {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Vérifier que le claim existe et appartient à l'utilisateur
    const { data: claim, error: claimError } = await supabaseAdmin
      .from('expense_claims')
      .select('*')
      .eq('id', claimId)
      .eq('user_id', userId)
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 });
    }

    // Vérifier que le claim est en draft
    if (claim.status !== 'draft') {
      return NextResponse.json({
        error: `Impossible de soumettre : la demande est déjà en statut "${claim.status}"`
      }, { status: 400 });
    }

    // Mettre à jour le statut
    const { data: updatedClaim, error: updateError } = await supabaseAdmin
      .from('expense_claims')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', claimId)
      .select()
      .single();

    if (updateError) {
      console.error('[API /api/claims/[id]/submit] Erreur update:', updateError);
      return NextResponse.json({ error: 'Erreur lors de la soumission' }, { status: 500 });
    }

    // Créer une notification pour les validateurs
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'claim_submitted',
        title: 'Demande soumise',
        message: `Votre demande de ${claim.reimbursable_amount?.toFixed(2)}€ a été soumise pour validation.`,
        related_entity_type: 'expense_claim',
        related_entity_id: claimId,
      });
    } catch (notifError) {
      console.warn('[API] Notification non créée (table manquante?):', notifError);
    }

    return NextResponse.json({
      success: true,
      claim: updatedClaim,
      message: 'Demande soumise avec succès',
    });
  } catch (error) {
    console.error('Erreur POST /api/claims/[id]/submit:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
