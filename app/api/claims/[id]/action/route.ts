// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/claims/[id]/action
 * Effectuer une action sur une demande (validate, refuse, request_info, submit, etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Vérifier l'authentification
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const claimId = params.id;
    const body = await request.json();
    const action = body.action; // 'validate', 'refuse', 'request_info', 'submit'
    
    // Récupérer le profil utilisateur
    const { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (!userProfile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }
    
    // Récupérer la demande
    const { data: claim, error: claimError } = await supabase
      .from('expense_claims')
      .select('*')
      .eq('id', claimId)
      .single();
    
    if (claimError || !claim) {
      return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 });
    }
    
    // Variables pour la mise à jour
    let updateData: any = {};
    let notificationMessage = '';
    let notificationType = '';
    
    switch (action) {
      case 'submit':
        // Soumettre la demande (passer de draft → submitted/to_validate)
        if (claim.user_id !== userId) {
          return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }
        
        if (claim.status !== 'draft') {
          return NextResponse.json({ error: 'La demande n\'est pas en brouillon' }, { status: 400 });
        }
        
        if (!claim.has_justificatifs) {
          updateData = { status: 'incomplete' };
          notificationMessage = 'Demande incomplète : justificatifs manquants';
          notificationType = 'claim_incomplete';
        } else {
          updateData = { 
            status: 'to_validate',
            submitted_at: new Date().toISOString()
          };
          notificationMessage = 'Demande soumise pour validation';
          notificationType = 'claim_submitted';
        }
        break;
      
      case 'validate':
        // Valider la demande
        if (!['treasurer', 'validator'].includes(userProfile.role)) {
          return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }
        
        if (!['submitted', 'to_validate'].includes(claim.status)) {
          return NextResponse.json({ error: 'La demande n\'est pas validable' }, { status: 400 });
        }
        
        updateData = {
          status: 'validated',
          validated_at: new Date().toISOString(),
          validated_by: userId,
          validation_comment: body.comment || null,
        };
        notificationMessage = `Votre demande de ${claim.reimbursable_amount}€ a été validée`;
        notificationType = 'claim_validated';
        break;
      
      case 'refuse':
        // Refuser la demande
        if (!['treasurer', 'validator'].includes(userProfile.role)) {
          return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }
        
        if (!body.reason) {
          return NextResponse.json({ error: 'Raison de refus obligatoire' }, { status: 400 });
        }
        
        updateData = {
          status: 'refused',
          validated_at: new Date().toISOString(),
          validated_by: userId,
          refusal_reason: body.reason,
        };
        notificationMessage = `Votre demande a été refusée : ${body.reason}`;
        notificationType = 'claim_refused';
        break;
      
      case 'request_info':
        // Demander des informations complémentaires
        if (!['treasurer', 'validator'].includes(userProfile.role)) {
          return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }
        
        updateData = {
          status: 'incomplete',
          validation_comment: body.comment || 'Informations complémentaires requises',
        };
        notificationMessage = `Informations complémentaires requises : ${body.comment}`;
        notificationType = 'info_requested';
        break;
      
      default:
        return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }
    
    // Mettre à jour la demande
    const { data: updatedClaim, error: updateError } = await supabase
      .from('expense_claims')
      .update(updateData)
      .eq('id', claimId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Erreur mise à jour claim:', updateError);
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
    }
    
    // Créer une notification
    await supabase.from('notifications').insert({
      user_id: claim.user_id,
      type: notificationType,
      title: 'Mise à jour de votre demande',
      message: notificationMessage,
      related_entity_type: 'expense_claim',
      related_entity_id: claimId,
    });
    
    // Logger dans l'audit
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: userId,
      actor_email: session.user.email,
      actor_role: userProfile.role,
      action,
      entity_type: 'expense_claim',
      entity_id: claimId,
      before_data: claim,
      after_data: updatedClaim,
      diff: {
        status: { from: claim.status, to: updatedClaim.status },
      },
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      user_agent: request.headers.get('user-agent'),
    });
    
    // TODO: Envoyer email via Gmail API
    
    return NextResponse.json({
      success: true,
      claim: updatedClaim,
      action,
    });
  } catch (error) {
    console.error('Erreur POST /api/claims/[id]/action:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
