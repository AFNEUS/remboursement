// @ts-nocheck - Types Supabase incompatibles avec schéma actuel
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { calculateReimbursableAmount, validateIBAN, generateClaimReference, detectDuplicates } from '@/lib/reimbursement';
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
    
    console.log('[API /api/claims/create] Nouvelle requête reçue');
    
    // Vérifier l'authentification
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    console.log('[API /api/claims/create] Session:', session ? 'Présente' : 'Absente');
    console.log('[API /api/claims/create] Auth error:', authError);
    
    if (authError || !session) {
      console.error('[API /api/claims/create] Authentification échouée');
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const userId = session.user.id;
    console.log('[API /api/claims/create] User ID:', userId);
    
    const body = await request.json();
    
    // Récupérer le profil utilisateur via admin client (bypass RLS)
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      console.error('[API /api/claims/create] Erreur profil:', profileError);
      return NextResponse.json({ error: 'Profil utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier l'IBAN si fourni (optionnel - pas bloquant pour création)
    if (body.iban) {
      const ibanValidation = validateIBAN(body.iban);
      if (!ibanValidation.valid) {
        console.warn('[API /api/claims/create] IBAN invalide:', ibanValidation.error);
        // On continue quand même, l'IBAN peut être corrigé plus tard
      }
    }
    // NOTE: On ne bloque plus si l'IBAN n'est pas vérifié - cela sera requis au moment du paiement

    // Récupérer les barèmes, taux et plafonds via admin client (bypass RLS)
    const [baremes, taux, plafonds] = await Promise.all([
      supabaseAdmin.from('baremes').select('*').is('valid_to', null),
      supabaseAdmin.from('taux_remboursement').select('*').is('valid_to', null),
      supabaseAdmin.from('plafonds').select('*').is('valid_to', null),
    ]);

    if (!baremes.data || !taux.data || !plafonds.data) {
      console.error('[API /api/claims/create] Erreur récupération paramètres:', {
        baremes: baremes.error,
        taux: taux.error,
        plafonds: plafonds.error,
      });
      return NextResponse.json({ error: 'Erreur lors de la récupération des paramètres' }, { status: 500 });
    }
    
    // Vérifier les doublons : chercher les demandes récentes du même utilisateur
    const { data: existingClaims } = await supabaseAdmin
      .from('expense_claims')
      .select('*')
      .eq('user_id', userId)
      .gte('expense_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (existingClaims) {
      const { isDuplicate, duplicates } = await detectDuplicates(
        { user_id: userId, expense_date: body.expense_date, amount_ttc: body.amount_ttc },
        existingClaims
      );
      if (isDuplicate) {
        console.warn('[API /api/claims/create] Doublon détecté:', duplicates.map(d => d.id));
        return NextResponse.json(
          {
            error: 'Une demande similaire existe déjà (même date et même montant). Veuillez vérifier avant de soumettre.',
            duplicates: duplicates.map(d => ({ id: d.id, status: d.status, created_at: d.created_at })),
          },
          { status: 409 }
        );
      }
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
    
    const { data: claim, error: claimError } = await supabaseAdmin
      .from('expense_claims')
      .insert(newClaim)
      .select()
      .single();
    
    if (claimError) {
      console.error('Erreur création claim:', claimError);
      return NextResponse.json({ error: 'Erreur lors de la création de la demande' }, { status: 500 });
    }
    
    // Créer une notification
    await supabaseAdmin.from('notifications').insert({
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
