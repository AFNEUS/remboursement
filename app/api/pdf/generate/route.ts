// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { chromium } from 'playwright';

/**
 * POST /api/pdf/generate
 * Générer un PDF pour une demande de remboursement
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Vérifier l'authentification
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const body = await request.json();
    const claimId = body.claim_id;
    const type = body.type || 'claim'; // 'claim', 'receipt', 'batch'
    
    if (!claimId) {
      return NextResponse.json({ error: 'claim_id requis' }, { status: 400 });
    }
    
    // Récupérer la demande
    const { data: claim, error: claimError } = await supabase
      .from('claims_enriched')
      .select('*')
      .eq('id', claimId)
      .single();
    
    if (claimError || !claim) {
      return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 });
    }
    
    // Générer le HTML selon le type
    let html = '';
    
    switch (type) {
      case 'claim':
        html = generateClaimHTML(claim);
        break;
      case 'receipt':
        html = generateReceiptHTML(claim);
        break;
      default:
        html = generateClaimHTML(claim);
    }
    
    // Générer le PDF avec Playwright
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'networkidle' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm',
      },
    });
    
    await browser.close();
    
    // Retourner le PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="remboursement-${claim.id.substring(0, 8)}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * Générer le HTML pour une demande de remboursement
 */
function generateClaimHTML(claim: any): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Demande de Remboursement - ${claim.id.substring(0, 8)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #2563eb;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #2563eb;
    }
    .ref {
      text-align: right;
      color: #666;
    }
    .ref .number {
      font-size: 20px;
      font-weight: bold;
      color: #2563eb;
    }
    h1 {
      color: #2563eb;
      font-size: 24px;
      margin: 30px 0 20px 0;
    }
    h2 {
      color: #1e40af;
      font-size: 18px;
      margin: 25px 0 15px 0;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin: 20px 0;
    }
    .info-item {
      padding: 10px;
      background: #f9fafb;
      border-radius: 6px;
    }
    .info-label {
      font-weight: 600;
      color: #6b7280;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .info-value {
      color: #111827;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: white;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border: 1px solid #e5e7eb;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }
    .amount {
      font-weight: bold;
      color: #059669;
    }
    .total-box {
      margin: 30px 0;
      padding: 20px;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      border-radius: 10px;
      text-align: center;
    }
    .total-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    .total-amount {
      font-size: 32px;
      font-weight: bold;
    }
    .breakdown {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
    }
    .breakdown-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .breakdown-item:last-child {
      border-bottom: none;
    }
    .validation {
      background: #dcfce7;
      border-left: 4px solid #059669;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
    .signature-box {
      margin: 40px 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .signature {
      border-top: 2px solid #000;
      padding-top: 10px;
      text-align: center;
      margin-top: 60px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">AFNEUS</div>
      <div style="color: #666;">Fédération Nationale</div>
    </div>
    <div class="ref">
      <div>Référence</div>
      <div class="number">RBT-${claim.id.substring(0, 8)}</div>
      <div style="margin-top: 10px;">${new Date(claim.created_at).toLocaleDateString('fr-FR')}</div>
    </div>
  </div>

  <h1>Demande de Remboursement</h1>

  <h2>Informations du demandeur</h2>
  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">Nom complet</div>
      <div class="info-value">${claim.full_name}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Email</div>
      <div class="info-value">${claim.email}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Rôle</div>
      <div class="info-value">${getRoleLabel(claim.role)}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Pôle</div>
      <div class="info-value">${claim.pole || 'Non renseigné'}</div>
    </div>
  </div>

  <h2>Détails de la dépense</h2>
  <table>
    <tr>
      <th>Type de dépense</th>
      <th>Date</th>
      <th>Montant TTC</th>
      ${claim.expense_type === 'car' ? '<th>Distance (km)</th>' : ''}
    </tr>
    <tr>
      <td>${getExpenseTypeLabel(claim.expense_type)}</td>
      <td>${new Date(claim.expense_date).toLocaleDateString('fr-FR')}</td>
      <td class="amount">${(claim.amount_ttc || 0).toFixed(2)} €</td>
      ${claim.expense_type === 'car' ? `<td>${claim.distance_km || 0} km</td>` : ''}
    </tr>
  </table>

  ${claim.description ? `
  <div class="info-item">
    <div class="info-label">Description</div>
    <div class="info-value">${claim.description}</div>
  </div>
  ` : ''}

  <h2>Calcul du remboursement</h2>
  <div class="breakdown">
    ${claim.expense_type === 'car' ? `
    <div class="breakdown-item">
      <span>Distance parcourue</span>
      <strong>${claim.distance_km} km</strong>
    </div>
    <div class="breakdown-item">
      <span>Barème kilométrique (${claim.cv_fiscaux} CV)</span>
      <strong>${(claim.amount_ttc / claim.distance_km).toFixed(4)} €/km</strong>
    </div>
    <div class="breakdown-item">
      <span>Montant de base</span>
      <strong>${(claim.calculated_amount || 0).toFixed(2)} €</strong>
    </div>
    ` : `
    <div class="breakdown-item">
      <span>Montant de base</span>
      <strong>${(claim.amount_ttc || 0).toFixed(2)} €</strong>
    </div>
    `}
    <div class="breakdown-item">
      <span>Taux appliqué (${getRoleLabel(claim.role)})</span>
      <strong>${((claim.taux_applied || 0) * 100).toFixed(0)} %</strong>
    </div>
  </div>

  <div class="total-box">
    <div class="total-label">Montant remboursable</div>
    <div class="total-amount">${(claim.reimbursable_amount || 0).toFixed(2)} €</div>
  </div>

  ${claim.status === 'validated' || claim.status === 'paid' ? `
  <div class="validation">
    <h3 style="margin-bottom: 10px; color: #059669;">✓ Demande validée</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <div>
        <strong>Validé par :</strong> ${claim.validator_name || 'Système'}
      </div>
      <div>
        <strong>Date :</strong> ${new Date(claim.validated_at).toLocaleDateString('fr-FR')}
      </div>
    </div>
    ${claim.validation_comment ? `
    <div style="margin-top: 10px;">
      <strong>Commentaire :</strong> ${claim.validation_comment}
    </div>
    ` : ''}
  </div>
  ` : ''}

  <h2>Coordonnées bancaires</h2>
  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">IBAN</div>
      <div class="info-value">${claim.iban || 'Non renseigné'}</div>
    </div>
    <div class="info-item">
      <div class="info-label">BIC</div>
      <div class="info-value">${claim.bic || 'Non renseigné'}</div>
    </div>
  </div>

  <div class="signature-box">
    <div>
      <div style="font-weight: 600; margin-bottom: 10px;">Le demandeur</div>
      <div class="signature">${claim.full_name}</div>
    </div>
    <div>
      <div style="font-weight: 600; margin-bottom: 10px;">Le validateur</div>
      <div class="signature">${claim.validator_name || '_________________'}</div>
    </div>
  </div>

  <div class="footer">
    <p>Document généré automatiquement le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
    <p>AFNEUS - Fédération Nationale des Étudiants</p>
  </div>
</body>
</html>
  `;
}

/**
 * Générer le HTML pour un reçu de paiement
 */
function generateReceiptHTML(claim: any): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Reçu de Paiement - ${claim.id.substring(0, 8)}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .receipt-header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      text-align: center;
      margin-bottom: 30px;
    }
    h1 { margin: 0 0 10px 0; font-size: 28px; }
    .receipt-number { font-size: 18px; opacity: 0.9; }
    .amount-box {
      background: #f0fdf4;
      border: 2px solid #10b981;
      padding: 25px;
      border-radius: 10px;
      text-align: center;
      margin: 30px 0;
    }
    .amount {
      font-size: 42px;
      font-weight: bold;
      color: #059669;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="receipt-header">
    <h1>✓ Reçu de Paiement</h1>
    <div class="receipt-number">N° ${claim.payment_reference || claim.id.substring(0, 8)}</div>
  </div>

  <div class="amount-box">
    <div style="font-size: 14px; color: #6b7280; margin-bottom: 5px;">Montant versé</div>
    <div class="amount">${(claim.reimbursable_amount || 0).toFixed(2)} €</div>
  </div>

  <table>
    <tr>
      <th>Bénéficiaire</th>
      <td>${claim.full_name}</td>
    </tr>
    <tr>
      <th>IBAN</th>
      <td>${claim.iban}</td>
    </tr>
    <tr>
      <th>Date de paiement</th>
      <td>${new Date(claim.paid_at || Date.now()).toLocaleDateString('fr-FR')}</td>
    </tr>
    <tr>
      <th>Motif</th>
      <td>Remboursement ${claim.expense_type} du ${new Date(claim.expense_date).toLocaleDateString('fr-FR')}</td>
    </tr>
    <tr>
      <th>Référence demande</th>
      <td>RBT-${claim.id.substring(0, 8)}</td>
    </tr>
  </table>

  <div style="margin-top: 50px; padding: 20px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
    <strong>Note :</strong> Ce reçu atteste du virement effectué par AFNEUS. Conservez-le pour vos archives.
  </div>

  <div style="margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px;">
    <p>Document généré le ${new Date().toLocaleDateString('fr-FR')}</p>
    <p>AFNEUS - Fédération Nationale</p>
  </div>
</body>
</html>
  `;
}

function getRoleLabel(role: string): string {
  const labels: { [key: string]: string } = {
    'bn_member': 'Bureau National',
    'admin_asso': 'Administrateur Association',
    'treasurer': 'Trésorier',
    'validator': 'Validateur',
    'user': 'Membre',
    'viewer': 'Observateur',
  };
  return labels[role] || role;
}

function getExpenseTypeLabel(type: string): string {
  const labels: { [key: string]: string } = {
    'car': '🚗 Voiture',
    'train': '🚄 Train / Bus',
    'hotel': '🏨 Hôtel',
    'meal': '🍽️ Repas',
    'registration': '📝 Inscription',
    'other': '📦 Autre',
  };
  return labels[type] || type;
}
