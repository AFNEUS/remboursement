/**
 * GOOGLE APPS SCRIPT - SYNCHRONISATION SUPABASE → GOOGLE SHEETS
 * 
 * Ce script synchronise automatiquement les demandes de remboursement validées
 * depuis Supabase vers une feuille Google Sheets pour consultation par le bureau.
 * 
 * INSTALLATION :
 * 1. Ouvrir https://script.google.com
 * 2. Créer nouveau projet
 * 3. Copier-coller ce code
 * 4. Configurer les variables ci-dessous
 * 5. Déployer : Déclencheurs → Ajouter un déclencheur (quotidien)
 */

// ============================================
// CONFIGURATION (À PERSONNALISER)
// ============================================

const CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGc...', // ⚠️ À stocker dans Script Properties plutôt
  SPREADSHEET_ID: '1abc...', // ID de votre Google Sheet
  SHEET_NAME: 'Demandes Validées',
};

// ============================================
// FONCTIONS PRINCIPALES
// ============================================

/**
 * Fonction principale - synchroniser les demandes validées
 */
function syncValidatedClaims() {
  Logger.log('🔄 Début synchronisation Supabase → Sheets...');
  
  try {
    // Récupérer les demandes validées depuis Supabase
    const claims = fetchClaimsFromSupabase('validated');
    
    if (!claims || claims.length === 0) {
      Logger.log('ℹ️ Aucune demande validée à synchroniser');
      return;
    }
    
    // Mettre à jour la feuille Google Sheets
    updateSheet(claims);
    
    Logger.log(`✅ Synchronisation terminée : ${claims.length} demandes`);
  } catch (error) {
    Logger.log(`❌ Erreur synchronisation : ${error}`);
    sendErrorNotification(error);
  }
}

/**
 * Récupérer les demandes depuis Supabase
 */
function fetchClaimsFromSupabase(status = 'validated') {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/claims_enriched?status=eq.${status}&select=*&order=expense_date.desc`;
  
  const options = {
    method: 'get',
    headers: {
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();
  
  if (statusCode !== 200) {
    throw new Error(`Erreur API Supabase : ${statusCode} - ${response.getContentText()}`);
  }
  
  const data = JSON.parse(response.getContentText());
  return data;
}

/**
 * Mettre à jour la feuille Google Sheets
 */
function updateSheet(claims) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  
  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  }
  
  // Effacer le contenu existant
  sheet.clear();
  
  // En-têtes
  const headers = [
    'Date',
    'Référence',
    'Nom',
    'Email',
    'Rôle',
    'Type dépense',
    'Montant TTC',
    'Montant remboursable',
    'IBAN',
    'Validé par',
    'Date validation',
    'Statut',
  ];
  
  sheet.appendRow(headers);
  
  // Formatter les en-têtes
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285F4');
  headerRange.setFontColor('#FFFFFF');
  
  // Ajouter les données
  claims.forEach((claim) => {
    const row = [
      claim.expense_date || '',
      claim.id.substring(0, 8),
      claim.full_name || '',
      claim.email || '',
      claim.role || '',
      claim.expense_type || '',
      claim.amount_ttc || 0,
      claim.reimbursable_amount || 0,
      claim.iban || '',
      claim.validator_name || '',
      claim.validated_at ? new Date(claim.validated_at).toLocaleDateString('fr-FR') : '',
      claim.status || '',
    ];
    
    sheet.appendRow(row);
  });
  
  // Auto-dimensionner les colonnes
  sheet.autoResizeColumns(1, headers.length);
  
  // Geler la première ligne
  sheet.setFrozenRows(1);
  
  // Formater les montants
  const amountRange = sheet.getRange(2, 7, claims.length, 2); // Colonnes montants
  amountRange.setNumberFormat('#,##0.00 €');
  
  Logger.log(`📝 Feuille "${CONFIG.SHEET_NAME}" mise à jour avec ${claims.length} lignes`);
}

/**
 * Envoyer une notification d'erreur par email
 */
function sendErrorNotification(error) {
  const recipient = 'tresorier@afneus.org'; // Email du trésorier
  const subject = '⚠️ Erreur synchronisation Supabase → Sheets';
  const body = `
Une erreur s'est produite lors de la synchronisation automatique :

Erreur : ${error}

Timestamp : ${new Date().toLocaleString('fr-FR')}

Veuillez vérifier la configuration du script.
  `;
  
  try {
    MailApp.sendEmail(recipient, subject, body);
  } catch (mailError) {
    Logger.log(`❌ Impossible d'envoyer l'email d'erreur : ${mailError}`);
  }
}

/**
 * Fonction de test (à exécuter manuellement)
 */
function testSync() {
  syncValidatedClaims();
}

/**
 * Créer un rapport récapitulatif mensuel
 */
function generateMonthlyReport() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/expense_claims?status=eq.paid&paid_at=gte.${firstDay.toISOString()}&paid_at=lte.${lastDay.toISOString()}&select=*`;
  
  const options = {
    method: 'get',
    headers: {
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
    },
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const claims = JSON.parse(response.getContentText());
  
  const totalPaid = claims.reduce((sum, c) => sum + (c.reimbursable_amount || 0), 0);
  const count = claims.length;
  
  Logger.log(`📊 Rapport mensuel : ${count} paiements pour un total de ${totalPaid.toFixed(2)} €`);
  
  // Envoyer par email
  const recipient = 'tresorier@afneus.org';
  const subject = `📊 Rapport remboursements - ${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
  const body = `
Rapport mensuel des remboursements

Période : ${firstDay.toLocaleDateString('fr-FR')} - ${lastDay.toLocaleDateString('fr-FR')}

📈 Statistiques :
- Nombre de paiements : ${count}
- Montant total : ${totalPaid.toFixed(2)} €
- Montant moyen : ${(totalPaid / count).toFixed(2)} €

Consultez la feuille Google Sheets pour plus de détails.
  `;
  
  MailApp.sendEmail(recipient, subject, body);
}

// ============================================
// DÉCLENCHEURS À CONFIGURER
// ============================================

/**
 * Déclencheur quotidien : Modifier → Déclencheurs du projet actuel
 * Fonction : syncValidatedClaims
 * Type : Horaire
 * Fréquence : Quotidienne, 6h-7h
 */

/**
 * Déclencheur mensuel : rapport
 * Fonction : generateMonthlyReport
 * Type : Horaire
 * Fréquence : Mensuelle, 1er jour du mois, 8h-9h
 */
