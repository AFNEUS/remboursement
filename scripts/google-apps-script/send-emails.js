/**
 * GOOGLE APPS SCRIPT - NOTIFICATIONS EMAIL VIA GMAIL API
 * 
 * Envoie des notifications email automatiques pour les événements importants
 */

const EMAIL_CONFIG = {
  FROM_EMAIL: 'noreply@afneus.org',
  FROM_NAME: 'AFNEUS - Remboursements',
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_SERVICE_KEY: 'eyJxxx...', // À stocker en Script Properties
};

/**
 * Envoyer les notifications en attente
 */
function sendPendingNotifications() {
  Logger.log('📧 Envoi des notifications email...');
  
  try {
    // Récupérer les notifications non envoyées
    const notifications = getPendingNotifications();
    
    if (!notifications || notifications.length === 0) {
      Logger.log('ℹ️ Aucune notification à envoyer');
      return;
    }
    
    let sentCount = 0;
    
    notifications.forEach((notif) => {
      try {
        // Récupérer les infos de l'utilisateur
        const user = getUserInfo(notif.user_id);
        
        if (!user || !user.email) {
          Logger.log(`⚠️ Utilisateur ${notif.user_id} non trouvé`);
          return;
        }
        
        // Construire l'email
        const emailTemplate = buildEmailTemplate(notif, user);
        
        // Envoyer via Gmail
        GmailApp.sendEmail(
          user.email,
          emailTemplate.subject,
          emailTemplate.body,
          {
            htmlBody: emailTemplate.htmlBody,
            name: EMAIL_CONFIG.FROM_NAME,
          }
        );
        
        // Marquer comme envoyé
        markNotificationAsSent(notif.id);
        
        sentCount++;
        Logger.log(`✅ Email envoyé à ${user.email}`);
      } catch (error) {
        Logger.log(`❌ Erreur envoi notification ${notif.id} : ${error}`);
      }
    });
    
    Logger.log(`✅ Envoi terminé : ${sentCount}/${notifications.length} emails`);
  } catch (error) {
    Logger.log(`❌ Erreur envoi notifications : ${error}`);
  }
}

/**
 * Récupérer les notifications en attente
 */
function getPendingNotifications() {
  const url = `${EMAIL_CONFIG.SUPABASE_URL}/rest/v1/notifications?email_sent=eq.false&select=*&limit=50`;
  
  const options = {
    method: 'get',
    headers: {
      'apikey': EMAIL_CONFIG.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${EMAIL_CONFIG.SUPABASE_SERVICE_KEY}`,
    },
  };
  
  const response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
}

/**
 * Récupérer les infos d'un utilisateur
 */
function getUserInfo(userId) {
  const url = `${EMAIL_CONFIG.SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=*`;
  
  const options = {
    method: 'get',
    headers: {
      'apikey': EMAIL_CONFIG.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${EMAIL_CONFIG.SUPABASE_SERVICE_KEY}`,
    },
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const users = JSON.parse(response.getContentText());
  return users.length > 0 ? users[0] : null;
}

/**
 * Construire le template email selon le type de notification
 */
function buildEmailTemplate(notif, user) {
  const baseUrl = 'https://remboursements.afneus.org'; // À configurer
  
  let subject = notif.title;
  let htmlBody = '';
  
  switch (notif.type) {
    case 'claim_submitted':
      subject = '✅ Demande de remboursement soumise';
      htmlBody = `
        <h2>Bonjour ${user.full_name},</h2>
        <p>Votre demande de remboursement a bien été soumise pour validation.</p>
        <p><strong>Message :</strong> ${notif.message}</p>
        <p>
          <a href="${baseUrl}/claims/${notif.related_entity_id}" 
             style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Voir ma demande
          </a>
        </p>
      `;
      break;
      
    case 'claim_validated':
      subject = '🎉 Demande de remboursement validée';
      htmlBody = `
        <h2>Bonne nouvelle ${user.full_name} !</h2>
        <p>Votre demande de remboursement a été <strong style="color: #059669;">validée</strong> ✓</p>
        <p><strong>Message :</strong> ${notif.message}</p>
        <p>Le paiement sera effectué dans les prochains jours.</p>
        <p>
          <a href="${baseUrl}/claims/${notif.related_entity_id}" 
             style="display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Voir ma demande
          </a>
        </p>
      `;
      break;
      
    case 'claim_refused':
      subject = '❌ Demande de remboursement refusée';
      htmlBody = `
        <h2>Bonjour ${user.full_name},</h2>
        <p>Malheureusement, votre demande de remboursement a été <strong style="color: #dc2626;">refusée</strong>.</p>
        <p><strong>Raison :</strong> ${notif.message}</p>
        <p>Si vous avez des questions, n'hésitez pas à contacter le trésorier.</p>
        <p>
          <a href="${baseUrl}/claims/${notif.related_entity_id}" 
             style="display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Voir ma demande
          </a>
        </p>
      `;
      break;
      
    case 'info_requested':
      subject = '⚠️ Informations complémentaires requises';
      htmlBody = `
        <h2>Bonjour ${user.full_name},</h2>
        <p>Des informations complémentaires sont nécessaires pour traiter votre demande :</p>
        <p><strong>${notif.message}</strong></p>
        <p>Merci de compléter votre demande dans les plus brefs délais.</p>
        <p>
          <a href="${baseUrl}/claims/${notif.related_entity_id}" 
             style="display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Compléter ma demande
          </a>
        </p>
      `;
      break;
      
    case 'claim_paid':
      subject = '💰 Paiement effectué';
      htmlBody = `
        <h2>Bonjour ${user.full_name},</h2>
        <p>Le virement de votre remboursement a été effectué avec succès ! 🎉</p>
        <p><strong>Message :</strong> ${notif.message}</p>
        <p>Le montant devrait apparaître sur votre compte bancaire sous 1 à 3 jours ouvrés.</p>
        <p>
          <a href="${baseUrl}/claims/${notif.related_entity_id}" 
             style="display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Télécharger le reçu
          </a>
        </p>
      `;
      break;
      
    default:
      htmlBody = `
        <h2>Bonjour ${user.full_name},</h2>
        <p>${notif.message}</p>
        ${notif.related_entity_id ? `
        <p>
          <a href="${baseUrl}/claims/${notif.related_entity_id}" 
             style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Voir les détails
          </a>
        </p>
        ` : ''}
      `;
  }
  
  // Wrapper HTML complet
  const fullHtmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">AFNEUS</h1>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Gestion des Remboursements</p>
    </div>
    <div class="content">
      ${htmlBody}
    </div>
    <div class="footer">
      <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
      <p>© ${new Date().getFullYear()} AFNEUS - Fédération Nationale</p>
    </div>
  </div>
</body>
</html>
  `;
  
  return {
    subject,
    body: notif.message, // Texte brut fallback
    htmlBody: fullHtmlBody,
  };
}

/**
 * Marquer une notification comme envoyée
 */
function markNotificationAsSent(notifId) {
  const url = `${EMAIL_CONFIG.SUPABASE_URL}/rest/v1/notifications?id=eq.${notifId}`;
  
  const payload = {
    email_sent: true,
    email_sent_at: new Date().toISOString(),
  };
  
  const options = {
    method: 'patch',
    headers: {
      'apikey': EMAIL_CONFIG.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${EMAIL_CONFIG.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    payload: JSON.stringify(payload),
  };
  
  UrlFetchApp.fetch(url, options);
}

/**
 * Envoyer un rappel pour justificatifs manquants
 */
function sendMissingJustificatifsReminders() {
  Logger.log('🔔 Envoi rappels justificatifs manquants...');
  
  // Récupérer les demandes incomplètes de plus de 7 jours
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const url = `${EMAIL_CONFIG.SUPABASE_URL}/rest/v1/claims_enriched?status=eq.incomplete&created_at=lte.${sevenDaysAgo.toISOString()}&reminder_sent_count=lte.2&select=*`;
  
  const options = {
    method: 'get',
    headers: {
      'apikey': EMAIL_CONFIG.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${EMAIL_CONFIG.SUPABASE_SERVICE_KEY}`,
    },
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const claims = JSON.parse(response.getContentText());
  
  if (!claims || claims.length === 0) {
    Logger.log('ℹ️ Aucun rappel à envoyer');
    return;
  }
  
  claims.forEach((claim) => {
    const subject = '⏰ Rappel : justificatifs manquants';
    const body = `
Bonjour ${claim.full_name},

Votre demande de remboursement est incomplète et nécessite des justificatifs.

Référence : RBT-${claim.id.substring(0, 8)}
Date de création : ${new Date(claim.created_at).toLocaleDateString('fr-FR')}

Merci d'ajouter vos justificatifs dans les plus brefs délais pour que votre demande puisse être traitée.

Lien : https://remboursements.afneus.org/claims/${claim.id}

Cordialement,
L'équipe AFNEUS
    `;
    
    try {
      GmailApp.sendEmail(claim.email, subject, body);
      
      // Incrémenter le compteur de rappels
      const updateUrl = `${EMAIL_CONFIG.SUPABASE_URL}/rest/v1/expense_claims?id=eq.${claim.id}`;
      const updatePayload = {
        reminder_sent_count: (claim.reminder_sent_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
      };
      
      UrlFetchApp.fetch(updateUrl, {
        method: 'patch',
        headers: {
          'apikey': EMAIL_CONFIG.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${EMAIL_CONFIG.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        payload: JSON.stringify(updatePayload),
      });
      
      Logger.log(`✅ Rappel envoyé à ${claim.email}`);
    } catch (error) {
      Logger.log(`❌ Erreur envoi rappel ${claim.id} : ${error}`);
    }
  });
}

/**
 * Fonction de test
 */
function testSendNotifications() {
  sendPendingNotifications();
}

function testSendReminders() {
  sendMissingJustificatifsReminders();
}
