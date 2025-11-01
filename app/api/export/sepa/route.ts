// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { create } from 'xmlbuilder2';
import { format } from 'date-fns';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/export/sepa
 * Générer un fichier SEPA XML pain.001.001.03 pour les paiements
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
    const claimIds = body.claim_ids; // Array d'IDs de claims validées
    
    // Vérifier les permissions (treasurer only)
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (!userProfile || userProfile.role !== 'treasurer') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }
    
    // Récupérer les claims validées
    const { data: claims, error: claimsError } = await supabase
      .from('claims_enriched')
      .select('*')
      .in('id', claimIds)
      .eq('status', 'validated');
    
    if (claimsError || !claims || claims.length === 0) {
      return NextResponse.json({ error: 'Aucune demande validée trouvée' }, { status: 404 });
    }
    
    // Vérifier que tous les bénéficiaires ont un IBAN
    const missingIban = claims.filter(c => !c.iban || !c.iban_verified);
    if (missingIban.length > 0) {
      return NextResponse.json({
        error: 'IBAN manquant ou non vérifié pour certains bénéficiaires',
        missing_iban_users: missingIban.map(c => ({ id: c.user_id, name: c.full_name })),
      }, { status: 400 });
    }
    
    // Calculer le montant total
    const totalAmount = claims.reduce((sum, c) => sum + (c.reimbursable_amount || 0), 0);
    
    // Générer un ID unique pour le batch
    const batchId = `BATCH-${format(new Date(), 'yyyyMMdd')}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const messageId = `MSG-${Date.now()}`;
    
    // Configuration du créancier (votre organisation)
    const creditorName = 'AFNEUS - Fédération Nationale';
    const creditorIban = process.env.CREDITOR_IBAN || 'FR7630001007941234567890185'; // À configurer
    const creditorBic = process.env.CREDITOR_BIC || 'BNPAFRPPXXX';
    
    // Générer le XML SEPA pain.001.001.03
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Document', {
        'xmlns': 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      })
      .ele('CstmrCdtTrfInitn');
    
    // Group Header
    const grpHdr = doc.ele('GrpHdr');
    grpHdr.ele('MsgId').txt(messageId);
    grpHdr.ele('CreDtTm').txt(new Date().toISOString());
    grpHdr.ele('NbOfTxs').txt(claims.length.toString());
    grpHdr.ele('CtrlSum').txt(totalAmount.toFixed(2));
    grpHdr.ele('InitgPty').ele('Nm').txt(creditorName);
    
    // Payment Information
    const pmtInf = doc.ele('PmtInf');
    pmtInf.ele('PmtInfId').txt(batchId);
    pmtInf.ele('PmtMtd').txt('TRF'); // Credit Transfer
    pmtInf.ele('BtchBookg').txt('true');
    pmtInf.ele('NbOfTxs').txt(claims.length.toString());
    pmtInf.ele('CtrlSum').txt(totalAmount.toFixed(2));
    
    // Payment Type Information
    const pmtTpInf = pmtInf.ele('PmtTpInf');
    pmtTpInf.ele('SvcLvl').ele('Cd').txt('SEPA');
    
    // Requested Execution Date (J+1)
    const reqdExctnDt = new Date();
    reqdExctnDt.setDate(reqdExctnDt.getDate() + 1);
    pmtInf.ele('ReqdExctnDt').txt(format(reqdExctnDt, 'yyyy-MM-dd'));
    
    // Debtor (votre organisation)
    const dbtr = pmtInf.ele('Dbtr');
    dbtr.ele('Nm').txt(creditorName);
    
    // Debtor Account
    const dbtrAcct = pmtInf.ele('DbtrAcct');
    dbtrAcct.ele('Id').ele('IBAN').txt(creditorIban);
    
    // Debtor Agent
    const dbtrAgt = pmtInf.ele('DbtrAgt');
    dbtrAgt.ele('FinInstnId').ele('BIC').txt(creditorBic);
    
    // Credit Transfer Transaction Information (une par claim)
    claims.forEach((claim, index) => {
      const cdtTrfTxInf = pmtInf.ele('CdtTrfTxInf');
      
      // Payment ID
      const pmtId = cdtTrfTxInf.ele('PmtId');
      pmtId.ele('InstrId').txt(`INSTR-${index + 1}`);
      pmtId.ele('EndToEndId').txt(claim.id.substring(0, 35)); // Max 35 chars
      
      // Amount
      const amt = cdtTrfTxInf.ele('Amt');
      amt.ele('InstdAmt', { Ccy: claim.currency || 'EUR' }).txt(claim.reimbursable_amount.toFixed(2));
      
      // Creditor Agent (banque du bénéficiaire)
      if (claim.bic) {
        const cdtrAgt = cdtTrfTxInf.ele('CdtrAgt');
        cdtrAgt.ele('FinInstnId').ele('BIC').txt(claim.bic);
      }
      
      // Creditor (bénéficiaire)
      const cdtr = cdtTrfTxInf.ele('Cdtr');
      cdtr.ele('Nm').txt(claim.full_name.substring(0, 70)); // Max 70 chars
      
      // Creditor Account
      const cdtrAcct = cdtTrfTxInf.ele('CdtrAcct');
      cdtrAcct.ele('Id').ele('IBAN').txt(claim.iban.replace(/\s/g, ''));
      
      // Remittance Information
      const rmtInf = cdtTrfTxInf.ele('RmtInf');
      const reference = `Remb ${claim.expense_type} ${format(new Date(claim.expense_date), 'dd/MM/yyyy')}`;
      rmtInf.ele('Ustrd').txt(reference.substring(0, 140)); // Max 140 chars
    });
    
    // Générer le XML
    const xml = doc.end({ prettyPrint: true });
    
    // Créer un payment batch
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('payment_batches')
      .insert({
        batch_name: batchId,
        batch_date: format(new Date(), 'yyyy-MM-dd'),
        total_amount: totalAmount,
        total_claims: claims.length,
        status: 'exported',
        exported_at: new Date().toISOString(),
        exported_by: userId,
        metadata: {
          claim_ids: claimIds,
          message_id: messageId,
        },
      })
      .select()
      .single();
    
    if (batchError) {
      console.error('Erreur création batch:', batchError);
      return NextResponse.json({ error: 'Erreur lors de la création du batch' }, { status: 500 });
    }
    
    // Mettre à jour les claims avec le batch_id et le statut
    await supabaseAdmin
      .from('expense_claims')
      .update({
        status: 'exported_for_payment',
        payment_batch_id: batch.id,
      })
      .in('id', claimIds);
    
    // Logger dans l'audit
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: userId,
      actor_email: session.user.email,
      actor_role: userProfile.role,
      action: 'export_sepa',
      entity_type: 'payment_batch',
      entity_id: batch.id,
      after_data: batch,
      metadata: {
        claim_count: claims.length,
        total_amount: totalAmount,
      },
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      user_agent: request.headers.get('user-agent'),
    });
    
    return NextResponse.json({
      success: true,
      batch,
      xml,
      filename: `SEPA-${batchId}.xml`,
      total_amount: totalAmount,
      claim_count: claims.length,
    });
  } catch (error) {
    console.error('Erreur POST /api/export/sepa:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * GET /api/export/csv
 * Exporter les demandes en CSV
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'validated';
    
    // Récupérer les claims
    const { data: claims, error } = await supabase
      .from('claims_enriched')
      .select('*')
      .eq('status', status)
      .order('expense_date', { ascending: false });
    
    if (error || !claims) {
      return NextResponse.json({ error: 'Erreur récupération données' }, { status: 500 });
    }
    
    // Générer le CSV
    const headers = [
      'ID',
      'Date',
      'Nom',
      'Email',
      'Type',
      'Montant TTC',
      'Montant Remboursable',
      'Statut',
      'IBAN',
      'Description',
    ];
    
    const rows = claims.map(c => [
      c.id,
      format(new Date(c.expense_date), 'dd/MM/yyyy'),
      c.full_name,
      c.email,
      c.expense_type,
      c.amount_ttc?.toFixed(2) || '0.00',
      c.reimbursable_amount?.toFixed(2) || '0.00',
      c.status,
      c.iban || '',
      (c.description || '').replace(/"/g, '""'), // Escape quotes
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="export-claims-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/export/csv:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
