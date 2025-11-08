// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { calculateReimbursableAmount, validateIBAN, detectDuplicates, generateClaimReference } from '@/lib/reimbursement';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Force dynamic rendering (uses cookies for auth)
export const dynamic = 'force-dynamic';

/**
 * POST /api/claims/create
 * Créer une nouvelle demande de remboursement
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Vérifier l'authentification
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const body = await request.json();
    
    // Récupérer le profil utilisateur
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'Profil utilisateur non trouvé' }, { status: 404 });
    }
    
    // Vérifier l'IBAN si fourni
    if (body.iban) {
      const ibanValidation = validateIBAN(body.iban);
      if (!ibanValidation.valid) {
        return NextResponse.json(
          { error: `IBAN invalide: ${ibanValidation.error}` },
          { status: 400 }
        );
      }
    } else if (!userProfile.iban || !userProfile.iban_verified) {
      return NextResponse.json(
        { 
          error: 'IBAN non renseigné ou non vérifié',
          action_required: 'update_iban'
        },
        { status: 400 }
      );
    }
    
    // Récupérer les barèmes, taux et plafonds
    const [baremes, taux, plafonds] = await Promise.all([
      supabase.from('baremes').select('*').is('valid_to', null),
      supabase.from('taux_remboursement').select('*').is('valid_to', null),
      supabase.from('plafonds').select('*').is('valid_to', null),
    ]);
    
    if (!baremes.data || !taux.data || !plafonds.data) {
      return NextResponse.json({ error: 'Erreur lors de la récupération des paramètres' }, { status: 500 });
    }
    
    // Calculer le montant remboursable
    const calculation = await calculateReimbursableAmount(
      body,
      userProfile.role,
      baremes.data,
      taux.data,
      plafonds.data
    );
    
    // Créer la demande (statut draft par défaut)
    const newClaim = {
      user_id: userId,
      event_id: body.event_id || null,
      expense_type: body.expense_type,
      expense_date: body.expense_date,
      motive: body.motive || null,
      description: body.description,
      merchant_name: body.merchant_name,
      amount_ttc: body.amount_ttc,
      currency: body.currency || 'EUR',
      calculated_amount: calculation.calculatedAmount,
      reimbursable_amount: calculation.reimbursableAmount,
      taux_applied: calculation.rateApplied,
      total_amount: calculation.reimbursableAmount,
      departure_location: body.departure_location,
      arrival_location: body.arrival_location,
      distance_km: body.distance_km,
      cv_fiscaux: body.cv_fiscaux,
      requires_second_validation: calculation.requiresSecondValidation,
      status: 'draft', // L'utilisateur doit uploader les justificatifs avant de soumettre
      metadata: {
        calculation_breakdown: calculation.breakdown,
        warnings: calculation.warnings,
      },
    };
    
    const { data: claim, error: claimError } = await supabase
      .from('expense_claims')
      .insert(newClaim)
      .select()
      .single();
    
    if (claimError) {
      console.error('Erreur création claim:', claimError);
      return NextResponse.json({ error: 'Erreur lors de la création de la demande' }, { status: 500 });
    }
    
    // Créer une notification
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'claim_created',
      title: 'Demande créée',
      message: `Votre demande de remboursement de ${calculation.reimbursableAmount.toFixed(2)}€ a été créée. Veuillez ajouter les justificatifs.`,
      related_entity_type: 'expense_claim',
      related_entity_id: claim.id,
    });
    
    // Logger dans l'audit
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: userId,
      actor_email: session.user.email,
      actor_role: userProfile.role,
      action: 'create',
      entity_type: 'expense_claim',
      entity_id: claim.id,
      after_data: claim,
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      user_agent: request.headers.get('user-agent'),
    });
    
    return NextResponse.json({
      success: true,
      claim,
      calculation,
      reference: generateClaimReference(claim.id),
    });
  } catch (error) {
    console.error('Erreur POST /api/claims/create:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
