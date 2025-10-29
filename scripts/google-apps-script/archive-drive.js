/**
 * GOOGLE APPS SCRIPT - ARCHIVAGE AUTOMATIQUE DANS GOOGLE DRIVE
 * 
 * Ce script archive automatiquement les PDF des demandes validées dans Google Drive
 * et met à jour la référence dans Supabase.
 * 
 * INSTALLATION :
 * 1. Copier dans le même projet que sync-sheets.js
 * 2. Configurer DRIVE_FOLDER_ID
 * 3. Créer déclencheur quotidien
 */

const DRIVE_CONFIG = {
  FOLDER_ID: '1abc...', // ID du dossier Drive racine
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_SERVICE_KEY: 'eyJxxx...', // Service role key (⚠️ À stocker en Script Properties)
};

/**
 * Archiver les justificatifs des demandes récemment validées
 */
function archiveValidatedClaimsToDrive() {
  Logger.log('📁 Début archivage Drive...');
  
  try {
    // Récupérer les demandes validées des 7 derniers jours sans archivage Drive
    const claims = getRecentValidatedClaims();
    
    if (!claims || claims.length === 0) {
      Logger.log('ℹ️ Aucune demande à archiver');
      return;
    }
    
    // Créer un dossier pour le mois en cours
    const monthFolder = getOrCreateMonthFolder();
    
    let archivedCount = 0;
    
    claims.forEach((claim) => {
      try {
        // Générer le PDF pour cette demande
        const pdfBlob = generateClaimPDF(claim);
        
        // Uploader vers Drive
        const file = monthFolder.createFile(pdfBlob);
        const driveFileId = file.getId();
        
        Logger.log(`✅ Archivé : ${claim.id} → Drive ID ${driveFileId}`);
        
        // Mettre à jour la référence dans Supabase
        updateClaimDriveReference(claim.id, driveFileId);
        
        archivedCount++;
      } catch (error) {
        Logger.log(`❌ Erreur archivage ${claim.id} : ${error}`);
      }
    });
    
    Logger.log(`✅ Archivage terminé : ${archivedCount}/${claims.length} demandes`);
  } catch (error) {
    Logger.log(`❌ Erreur archivage Drive : ${error}`);
  }
}

/**
 * Récupérer les demandes validées récentes
 */
function getRecentValidatedClaims() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const url = `${DRIVE_CONFIG.SUPABASE_URL}/rest/v1/claims_enriched?status=eq.validated&validated_at=gte.${sevenDaysAgo.toISOString()}&select=*`;
  
  const options = {
    method: 'get',
    headers: {
      'apikey': DRIVE_CONFIG.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${DRIVE_CONFIG.SUPABASE_SERVICE_KEY}`,
    },
  };
  
  const response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
}

/**
 * Obtenir ou créer le dossier du mois en cours
 */
function getOrCreateMonthFolder() {
  const rootFolder = DriveApp.getFolderById(DRIVE_CONFIG.FOLDER_ID);
  const now = new Date();
  const monthName = Utilities.formatDate(now, 'Europe/Paris', 'yyyy-MM');
  
  // Chercher le dossier existant
  const folders = rootFolder.getFoldersByName(monthName);
  
  if (folders.hasNext()) {
    return folders.next();
  } else {
    // Créer le dossier
    return rootFolder.createFolder(monthName);
  }
}

/**
 * Générer le PDF d'une demande (HTML simple converti en PDF)
 */
function generateClaimPDF(claim) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
    .header { margin-bottom: 30px; }
    .section { margin: 20px 0; }
    .label { font-weight: bold; color: #555; }
    .value { color: #000; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f3f4f6; font-weight: bold; }
    .total { font-size: 18px; font-weight: bold; color: #2563eb; }
    .footer { margin-top: 40px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Demande de Remboursement</h1>
    <p><strong>Référence :</strong> RBT-${claim.id.substring(0, 8)}</p>
    <p><strong>Date de validation :</strong> ${new Date(claim.validated_at).toLocaleDateString('fr-FR')}</p>
  </div>
  
  <div class="section">
    <h2>Informations du demandeur</h2>
    <p><span class="label">Nom :</span> <span class="value">${claim.full_name}</span></p>
    <p><span class="label">Email :</span> <span class="value">${claim.email}</span></p>
    <p><span class="label">Rôle :</span> <span class="value">${claim.role}</span></p>
    <p><span class="label">IBAN :</span> <span class="value">${claim.iban || 'Non renseigné'}</span></p>
  </div>
  
  <div class="section">
    <h2>Détails de la dépense</h2>
    <table>
      <tr>
        <th>Type</th>
        <th>Date</th>
        <th>Montant TTC</th>
        <th>Taux appliqué</th>
        <th>Montant remboursable</th>
      </tr>
      <tr>
        <td>${claim.expense_type}</td>
        <td>${claim.expense_date}</td>
        <td>${(claim.amount_ttc || 0).toFixed(2)} €</td>
        <td>${((claim.taux_applied || 0) * 100).toFixed(0)} %</td>
        <td class="total">${(claim.reimbursable_amount || 0).toFixed(2)} €</td>
      </tr>
    </table>
    
    ${claim.description ? `<p><span class="label">Description :</span> ${claim.description}</p>` : ''}
    ${claim.merchant_name ? `<p><span class="label">Fournisseur :</span> ${claim.merchant_name}</p>` : ''}
  </div>
  
  <div class="section">
    <h2>Validation</h2>
    <p><span class="label">Validé par :</span> <span class="value">${claim.validator_name || 'Système'}</span></p>
    <p><span class="label">Date :</span> <span class="value">${new Date(claim.validated_at).toLocaleDateString('fr-FR')}</span></p>
    ${claim.validation_comment ? `<p><span class="label">Commentaire :</span> ${claim.validation_comment}</p>` : ''}
  </div>
  
  <div class="footer">
    <p>Document généré automatiquement le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
    <p>AFNEUS - Fédération Nationale</p>
  </div>
</body>
</html>
  `;
  
  // Créer un blob PDF depuis le HTML
  const blob = Utilities.newBlob(html, 'text/html', `remboursement-${claim.id}.html`)
    .getAs('application/pdf');
  
  blob.setName(`RBT-${claim.id.substring(0, 8)}-${claim.full_name.replace(/\s/g, '_')}.pdf`);
  
  return blob;
}

/**
 * Mettre à jour la référence Drive dans Supabase
 */
function updateClaimDriveReference(claimId, driveFileId) {
  const url = `${DRIVE_CONFIG.SUPABASE_URL}/rest/v1/expense_claims?id=eq.${claimId}`;
  
  const payload = {
    metadata: {
      drive_file_id: driveFileId,
      archived_at: new Date().toISOString(),
    },
  };
  
  const options = {
    method: 'patch',
    headers: {
      'apikey': DRIVE_CONFIG.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${DRIVE_CONFIG.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    payload: JSON.stringify(payload),
  };
  
  UrlFetchApp.fetch(url, options);
}

/**
 * Fonction de test
 */
function testArchive() {
  archiveValidatedClaimsToDrive();
}
