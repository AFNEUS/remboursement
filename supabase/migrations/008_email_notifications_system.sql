-- ============================================================================
-- Migration 008: Email Notifications System
-- ============================================================================
-- Description: Système de notifications email automatiques pour les demandes
-- de remboursement avec files d'attente, templates, et tracking
-- ============================================================================

-- ============================================================================
-- 1. TABLE: email_templates
-- ============================================================================
-- Stocke les templates d'emails réutilisables avec variables dynamiques
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(100) UNIQUE NOT NULL, -- Code unique du template
  name VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL, -- Peut contenir {{variables}}
  body_html TEXT NOT NULL, -- HTML avec {{variables}}
  body_text TEXT, -- Version texte brut
  variables JSONB DEFAULT '[]'::jsonb, -- Liste des variables disponibles
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE email_templates IS 'Templates d''emails avec support de variables dynamiques';
COMMENT ON COLUMN email_templates.code IS 'CLAIM_SUBMITTED, CLAIM_VALIDATED, CLAIM_REJECTED, CLAIM_PAID, etc.';
COMMENT ON COLUMN email_templates.variables IS '["user_name", "claim_id", "amount", "event_name", etc.]';

-- ============================================================================
-- 2. TABLE: email_queue
-- ============================================================================
-- File d'attente pour l'envoi d'emails avec retry automatique
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_email VARCHAR(255) NOT NULL,
  to_name VARCHAR(255),
  cc_emails TEXT[], -- Liste d'emails en copie
  bcc_emails TEXT[], -- Liste d'emails en copie cachée
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  template_code VARCHAR(100), -- Référence au template utilisé
  template_variables JSONB, -- Variables utilisées pour ce template
  priority INTEGER DEFAULT 5, -- 1=urgent, 5=normal, 10=low
  status VARCHAR(50) DEFAULT 'pending', -- pending, sending, sent, failed
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Relations
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES expense_claims(id) ON DELETE CASCADE,
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled'))
);

COMMENT ON TABLE email_queue IS 'File d''attente pour envoi d''emails avec retry automatique';
COMMENT ON COLUMN email_queue.priority IS '1=urgent (validations), 5=normal, 10=low (notifications)';
COMMENT ON COLUMN email_queue.attempts IS 'Nombre de tentatives d''envoi';

CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_scheduled ON email_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_email_queue_claim ON email_queue(claim_id);
CREATE INDEX idx_email_queue_user ON email_queue(user_id);

-- ============================================================================
-- 3. TABLE: notification_preferences
-- ============================================================================
-- Préférences de notification par utilisateur
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Types de notifications email
  notify_claim_submitted BOOLEAN DEFAULT true, -- Confirmation de soumission
  notify_claim_validated BOOLEAN DEFAULT true, -- Demande validée
  notify_claim_rejected BOOLEAN DEFAULT true, -- Demande rejetée
  notify_claim_paid BOOLEAN DEFAULT true, -- Paiement effectué
  notify_new_claim_admin BOOLEAN DEFAULT true, -- Nouvelle demande (pour admins)
  notify_weekly_summary BOOLEAN DEFAULT false, -- Résumé hebdomadaire
  
  -- Canaux de notification (préparation future)
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE notification_preferences IS 'Préférences de notifications par utilisateur';

-- ============================================================================
-- 4. TABLE: notification_log
-- ============================================================================
-- Historique de toutes les notifications envoyées
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES expense_claims(id) ON DELETE SET NULL,
  email_queue_id UUID REFERENCES email_queue(id) ON DELETE SET NULL,
  
  notification_type VARCHAR(100) NOT NULL, -- CLAIM_SUBMITTED, CLAIM_VALIDATED, etc.
  channel VARCHAR(50) DEFAULT 'email', -- email, sms, push
  recipient_email VARCHAR(255),
  subject TEXT,
  status VARCHAR(50) DEFAULT 'sent', -- sent, failed, bounced
  
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP WITH TIME ZONE, -- Pour tracking de lecture (future)
  clicked_at TIMESTAMP WITH TIME ZONE, -- Pour tracking de clics (future)
  
  metadata JSONB, -- Données supplémentaires
  
  CONSTRAINT valid_channel CHECK (channel IN ('email', 'sms', 'push', 'in_app'))
);

COMMENT ON TABLE notification_log IS 'Historique complet des notifications envoyées';

CREATE INDEX idx_notification_log_user ON notification_log(user_id);
CREATE INDEX idx_notification_log_claim ON notification_log(claim_id);
CREATE INDEX idx_notification_log_type ON notification_log(notification_type);
CREATE INDEX idx_notification_log_sent ON notification_log(sent_at DESC);

-- ============================================================================
-- 5. FUNCTION: queue_email
-- ============================================================================
-- Fonction pour ajouter un email à la file d'attente
CREATE OR REPLACE FUNCTION queue_email(
  p_to_email VARCHAR,
  p_to_name VARCHAR,
  p_subject TEXT,
  p_body_html TEXT,
  p_body_text TEXT DEFAULT NULL,
  p_template_code VARCHAR DEFAULT NULL,
  p_template_variables JSONB DEFAULT NULL,
  p_priority INTEGER DEFAULT 5,
  p_user_id UUID DEFAULT NULL,
  p_claim_id UUID DEFAULT NULL,
  p_cc_emails TEXT[] DEFAULT NULL,
  p_scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) RETURNS UUID AS $$
DECLARE
  v_email_id UUID;
BEGIN
  INSERT INTO email_queue (
    to_email, to_name, subject, body_html, body_text,
    template_code, template_variables, priority,
    user_id, claim_id, cc_emails, scheduled_for
  ) VALUES (
    p_to_email, p_to_name, p_subject, p_body_html, p_body_text,
    p_template_code, p_template_variables, p_priority,
    p_user_id, p_claim_id, p_cc_emails, p_scheduled_for
  ) RETURNING id INTO v_email_id;
  
  RETURN v_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION queue_email IS 'Ajoute un email à la file d''attente pour envoi';

-- ============================================================================
-- 6. FUNCTION: render_email_template
-- ============================================================================
-- Fonction pour rendre un template avec des variables
CREATE OR REPLACE FUNCTION render_email_template(
  p_template_code VARCHAR,
  p_variables JSONB
) RETURNS TABLE(subject TEXT, body_html TEXT, body_text TEXT) AS $$
DECLARE
  v_template RECORD;
  v_subject TEXT;
  v_body_html TEXT;
  v_body_text TEXT;
  v_key TEXT;
  v_value TEXT;
BEGIN
  -- Récupérer le template
  SELECT * INTO v_template
  FROM email_templates
  WHERE code = p_template_code AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template % non trouvé', p_template_code;
  END IF;
  
  v_subject := v_template.subject;
  v_body_html := v_template.body_html;
  v_body_text := v_template.body_text;
  
  -- Remplacer les variables
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_variables) LOOP
    v_subject := REPLACE(v_subject, '{{' || v_key || '}}', v_value);
    v_body_html := REPLACE(v_body_html, '{{' || v_key || '}}', v_value);
    IF v_body_text IS NOT NULL THEN
      v_body_text := REPLACE(v_body_text, '{{' || v_key || '}}', v_value);
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_subject, v_body_html, v_body_text;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION render_email_template IS 'Rend un template email avec remplacement des variables';

-- ============================================================================
-- 7. FUNCTION: send_claim_notification
-- ============================================================================
-- Fonction intelligente pour envoyer les notifications de demande
CREATE OR REPLACE FUNCTION send_claim_notification(
  p_claim_id UUID,
  p_notification_type VARCHAR -- SUBMITTED, VALIDATED, REJECTED, PAID
) RETURNS UUID AS $$
DECLARE
  v_claim RECORD;
  v_user RECORD;
  v_validator RECORD;
  v_template_code VARCHAR;
  v_email_id UUID;
  v_subject TEXT;
  v_body_html TEXT;
  v_body_text TEXT;
  v_variables JSONB;
  v_admin_email VARCHAR;
  v_cc_emails TEXT[];
BEGIN
  -- Récupérer la demande avec toutes les infos
  SELECT 
    c.*,
    u.email AS user_email,
    u.first_name AS user_first_name,
    u.last_name AS user_last_name,
    e.name AS event_name,
    e.start_date AS event_date,
    v.email AS validator_email,
    v.first_name AS validator_first_name,
    v.last_name AS validator_last_name
  INTO v_claim
  FROM expense_claims c
  JOIN users u ON c.user_id = u.id
  LEFT JOIN events e ON c.event_id = e.id
  LEFT JOIN users v ON c.validated_by = v.id
  WHERE c.id = p_claim_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim % non trouvé', p_claim_id;
  END IF;
  
  -- Préparer les variables communes
  v_variables := jsonb_build_object(
    'user_name', v_claim.user_first_name || ' ' || v_claim.user_last_name,
    'user_first_name', v_claim.user_first_name,
    'claim_id', v_claim.id::text,
    'claim_number', v_claim.id::text,
    'amount', v_claim.total_amount::text || ' €',
    'event_name', COALESCE(v_claim.event_name, 'Non spécifié'),
    'event_date', TO_CHAR(v_claim.event_date, 'DD/MM/YYYY'),
    'submitted_date', TO_CHAR(v_claim.created_at, 'DD/MM/YYYY à HH24:MI'),
    'platform_url', 'https://afneus.fr/claims/' || v_claim.id::text
  );
  
  -- Déterminer le template et les destinataires selon le type
  CASE p_notification_type
    WHEN 'SUBMITTED' THEN
      v_template_code := 'CLAIM_SUBMITTED';
      
      -- Email de confirmation à l'utilisateur
      SELECT subject, body_html, body_text 
      INTO v_subject, v_body_html, v_body_text
      FROM render_email_template(v_template_code, v_variables);
      
      v_email_id := queue_email(
        v_claim.user_email,
        v_claim.user_first_name || ' ' || v_claim.user_last_name,
        v_subject,
        v_body_html,
        v_body_text,
        v_template_code,
        v_variables,
        5, -- Normal priority
        v_claim.user_id,
        p_claim_id
      );
      
      -- Email aux admins/validateurs (récupérer les emails des ADMIN et VALIDATOR)
      FOR v_admin_email IN 
        SELECT email FROM users WHERE role IN ('ADMIN', 'VALIDATOR', 'TREASURER')
      LOOP
        v_variables := v_variables || jsonb_build_object(
          'admin_name', 'Équipe de validation'
        );
        
        SELECT subject, body_html, body_text 
        INTO v_subject, v_body_html, v_body_text
        FROM render_email_template('CLAIM_NEW_ADMIN', v_variables);
        
        PERFORM queue_email(
          v_admin_email,
          'Équipe AFNEUS',
          v_subject,
          v_body_html,
          v_body_text,
          'CLAIM_NEW_ADMIN',
          v_variables,
          3, -- Higher priority for admins
          NULL,
          p_claim_id
        );
      END LOOP;
      
    WHEN 'VALIDATED' THEN
      v_template_code := 'CLAIM_VALIDATED';
      v_variables := v_variables || jsonb_build_object(
        'validated_amount', v_claim.validated_amount::text || ' €',
        'validator_name', COALESCE(v_claim.validator_first_name || ' ' || v_claim.validator_last_name, 'L''équipe AFNEUS'),
        'validation_date', TO_CHAR(v_claim.validated_at, 'DD/MM/YYYY à HH24:MI'),
        'validator_comments', COALESCE(v_claim.validator_comments, '')
      );
      
      SELECT subject, body_html, body_text 
      INTO v_subject, v_body_html, v_body_text
      FROM render_email_template(v_template_code, v_variables);
      
      v_email_id := queue_email(
        v_claim.user_email,
        v_claim.user_first_name || ' ' || v_claim.user_last_name,
        v_subject,
        v_body_html,
        v_body_text,
        v_template_code,
        v_variables,
        2, -- High priority
        v_claim.user_id,
        p_claim_id
      );
      
    WHEN 'REJECTED' THEN
      v_template_code := 'CLAIM_REJECTED';
      v_variables := v_variables || jsonb_build_object(
        'validator_name', COALESCE(v_claim.validator_first_name || ' ' || v_claim.validator_last_name, 'L''équipe AFNEUS'),
        'rejection_date', TO_CHAR(v_claim.validated_at, 'DD/MM/YYYY à HH24:MI'),
        'rejection_reason', COALESCE(v_claim.validator_comments, 'Non spécifié')
      );
      
      SELECT subject, body_html, body_text 
      INTO v_subject, v_body_html, v_body_text
      FROM render_email_template(v_template_code, v_variables);
      
      v_email_id := queue_email(
        v_claim.user_email,
        v_claim.user_first_name || ' ' || v_claim.user_last_name,
        v_subject,
        v_body_html,
        v_body_text,
        v_template_code,
        v_variables,
        2, -- High priority
        v_claim.user_id,
        p_claim_id
      );
      
    WHEN 'PAID' THEN
      v_template_code := 'CLAIM_PAID';
      v_variables := v_variables || jsonb_build_object(
        'paid_amount', v_claim.validated_amount::text || ' €',
        'payment_date', TO_CHAR(CURRENT_TIMESTAMP, 'DD/MM/YYYY')
      );
      
      SELECT subject, body_html, body_text 
      INTO v_subject, v_body_html, v_body_text
      FROM render_email_template(v_template_code, v_variables);
      
      v_email_id := queue_email(
        v_claim.user_email,
        v_claim.user_first_name || ' ' || v_claim.user_last_name,
        v_subject,
        v_body_html,
        v_body_text,
        v_template_code,
        v_variables,
        5, -- Normal priority
        v_claim.user_id,
        p_claim_id
      );
  END CASE;
  
  RETURN v_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION send_claim_notification IS 'Envoie les notifications email intelligentes pour une demande';

-- ============================================================================
-- 8. TRIGGERS: Notifications automatiques
-- ============================================================================

-- Trigger quand une demande est soumise (passe à SUBMITTED)
CREATE OR REPLACE FUNCTION notify_claim_submitted() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SUBMITTED' AND (OLD IS NULL OR OLD.status != 'SUBMITTED') THEN
    PERFORM send_claim_notification(NEW.id, 'SUBMITTED');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_claim_submitted
AFTER INSERT OR UPDATE OF status ON expense_claims
FOR EACH ROW
EXECUTE FUNCTION notify_claim_submitted();

-- Trigger quand une demande est validée
CREATE OR REPLACE FUNCTION notify_claim_validated() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'VALIDATED' AND OLD.status != 'VALIDATED' THEN
    PERFORM send_claim_notification(NEW.id, 'VALIDATED');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_claim_validated
AFTER UPDATE OF status ON expense_claims
FOR EACH ROW
WHEN (NEW.status = 'VALIDATED')
EXECUTE FUNCTION notify_claim_validated();

-- Trigger quand une demande est rejetée
CREATE OR REPLACE FUNCTION notify_claim_rejected() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'REJECTED' AND OLD.status != 'REJECTED' THEN
    PERFORM send_claim_notification(NEW.id, 'REJECTED');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_claim_rejected
AFTER UPDATE OF status ON expense_claims
FOR EACH ROW
WHEN (NEW.status = 'REJECTED')
EXECUTE FUNCTION notify_claim_rejected();

-- Trigger quand une demande est payée
CREATE OR REPLACE FUNCTION notify_claim_paid() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'PAID' AND OLD.status != 'PAID' THEN
    PERFORM send_claim_notification(NEW.id, 'PAID');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_claim_paid
AFTER UPDATE OF status ON expense_claims
FOR EACH ROW
WHEN (NEW.status = 'PAID')
EXECUTE FUNCTION notify_claim_paid();

-- ============================================================================
-- 9. TEMPLATES PAR DÉFAUT
-- ============================================================================

-- Template: Demande soumise (confirmation utilisateur)
INSERT INTO email_templates (code, name, subject, body_html, body_text, variables) VALUES
('CLAIM_SUBMITTED', 'Confirmation de soumission', 
'✅ Demande de remboursement #{{claim_number}} reçue',
'<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2563eb;">✅ Demande de remboursement reçue</h2>
    <p>Bonjour <strong>{{user_first_name}}</strong>,</p>
    <p>Votre demande de remboursement a bien été reçue et enregistrée dans notre système.</p>
    
    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #1f2937;">📋 Détails de la demande</h3>
      <ul style="list-style: none; padding: 0;">
        <li><strong>Numéro :</strong> #{{claim_number}}</li>
        <li><strong>Montant :</strong> {{amount}}</li>
        <li><strong>Événement :</strong> {{event_name}}</li>
        <li><strong>Date :</strong> {{event_date}}</li>
        <li><strong>Soumise le :</strong> {{submitted_date}}</li>
      </ul>
    </div>
    
    <p>Votre demande va être examinée par notre équipe de validation. Vous recevrez un email dès qu''une décision sera prise.</p>
    
    <p style="margin-top: 30px;">
      <a href="{{platform_url}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        📊 Suivre ma demande
      </a>
    </p>
    
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #6b7280;">
      Association Française des Neurochirurgiens en Études et Spécialisation<br>
      Pour toute question : <a href="mailto:contact@afneus.org">contact@afneus.org</a>
    </p>
  </div>
</body>
</html>',
'Bonjour {{user_first_name}},

Votre demande de remboursement a bien été reçue.

Détails :
- Numéro : #{{claim_number}}
- Montant : {{amount}}
- Événement : {{event_name}}
- Date : {{event_date}}

Vous recevrez un email dès qu''une décision sera prise.

AFNEUS',
'["user_name", "user_first_name", "claim_number", "amount", "event_name", "event_date", "submitted_date", "platform_url"]'::jsonb);

-- Template: Nouvelle demande pour admins
INSERT INTO email_templates (code, name, subject, body_html, body_text, variables) VALUES
('CLAIM_NEW_ADMIN', 'Nouvelle demande à valider', 
'🔔 Nouvelle demande de {{user_name}} - {{amount}}',
'<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #dc2626;">🔔 Nouvelle demande à valider</h2>
    <p>Une nouvelle demande de remboursement nécessite votre attention.</p>
    
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
      <h3 style="margin-top: 0; color: #991b1b;">📋 Demande #{{claim_number}}</h3>
      <ul style="list-style: none; padding: 0;">
        <li><strong>Demandeur :</strong> {{user_name}}</li>
        <li><strong>Montant :</strong> {{amount}}</li>
        <li><strong>Événement :</strong> {{event_name}}</li>
        <li><strong>Date événement :</strong> {{event_date}}</li>
        <li><strong>Soumise le :</strong> {{submitted_date}}</li>
      </ul>
    </div>
    
    <p style="margin-top: 30px;">
      <a href="{{platform_url}}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        ✅ Valider la demande
      </a>
    </p>
    
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #6b7280;">
      Notification automatique AFNEUS
    </p>
  </div>
</body>
</html>',
'Nouvelle demande de remboursement

Demandeur : {{user_name}}
Montant : {{amount}}
Événement : {{event_name}}

Validez sur : {{platform_url}}',
'["user_name", "claim_number", "amount", "event_name", "event_date", "submitted_date", "platform_url"]'::jsonb);

-- Template: Demande validée
INSERT INTO email_templates (code, name, subject, body_html, body_text, variables) VALUES
('CLAIM_VALIDATED', 'Demande validée', 
'✅ Votre demande #{{claim_number}} a été validée !',
'<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #16a34a;">✅ Demande validée !</h2>
    <p>Bonjour <strong>{{user_first_name}}</strong>,</p>
    <p>Bonne nouvelle ! Votre demande de remboursement a été validée par {{validator_name}}.</p>
    
    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
      <h3 style="margin-top: 0; color: #166534;">💰 Montant validé</h3>
      <p style="font-size: 32px; font-weight: bold; color: #16a34a; margin: 10px 0;">{{validated_amount}}</p>
      <ul style="list-style: none; padding: 0; margin-top: 15px;">
        <li><strong>Demande :</strong> #{{claim_number}}</li>
        <li><strong>Événement :</strong> {{event_name}}</li>
        <li><strong>Validée le :</strong> {{validation_date}}</li>
      </ul>
    </div>
    
    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0;"><strong>💬 Commentaires du validateur :</strong></p>
      <p style="margin: 10px 0 0 0; font-style: italic;">{{validator_comments}}</p>
    </div>
    
    <p>Le remboursement sera traité lors du prochain virement bancaire. Vous recevrez une notification lors du paiement.</p>
    
    <p style="margin-top: 30px;">
      <a href="{{platform_url}}" style="background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        📊 Voir ma demande
      </a>
    </p>
    
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #6b7280;">
      AFNEUS - Association Française des Neurochirurgiens en Études et Spécialisation
    </p>
  </div>
</body>
</html>',
'Bonjour {{user_first_name}},

Votre demande #{{claim_number}} a été VALIDÉE !

Montant validé : {{validated_amount}}
Événement : {{event_name}}
Validée le : {{validation_date}}

Commentaires : {{validator_comments}}

Le paiement sera effectué prochainement.

AFNEUS',
'["user_name", "user_first_name", "claim_number", "validated_amount", "validator_name", "validation_date", "validator_comments", "event_name", "platform_url"]'::jsonb);

-- Template: Demande rejetée
INSERT INTO email_templates (code, name, subject, body_html, body_text, variables) VALUES
('CLAIM_REJECTED', 'Demande rejetée', 
'❌ Votre demande #{{claim_number}} a été rejetée',
'<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #dc2626;">❌ Demande rejetée</h2>
    <p>Bonjour <strong>{{user_first_name}}</strong>,</p>
    <p>Votre demande de remboursement a été examinée et n''a malheureusement pas pu être validée.</p>
    
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
      <h3 style="margin-top: 0; color: #991b1b;">📋 Demande #{{claim_number}}</h3>
      <ul style="list-style: none; padding: 0;">
        <li><strong>Événement :</strong> {{event_name}}</li>
        <li><strong>Montant demandé :</strong> {{amount}}</li>
        <li><strong>Rejetée le :</strong> {{rejection_date}}</li>
        <li><strong>Par :</strong> {{validator_name}}</li>
      </ul>
    </div>
    
    <div style="background: #fff7ed; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ea580c;">
      <p style="margin: 0;"><strong>📝 Raison du rejet :</strong></p>
      <p style="margin: 10px 0 0 0; font-style: italic; color: #9a3412;">{{rejection_reason}}</p>
    </div>
    
    <p>Si vous pensez qu''il s''agit d''une erreur ou si vous souhaitez plus d''informations, n''hésitez pas à nous contacter.</p>
    
    <p style="margin-top: 30px;">
      <a href="mailto:tresorier@afneus.org" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        📧 Contacter le trésorier
      </a>
    </p>
    
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #6b7280;">
      AFNEUS - Pour toute question : <a href="mailto:contact@afneus.org">contact@afneus.org</a>
    </p>
  </div>
</body>
</html>',
'Bonjour {{user_first_name}},

Votre demande #{{claim_number}} a été REJETÉE.

Événement : {{event_name}}
Montant : {{amount}}
Rejetée le : {{rejection_date}}

Raison : {{rejection_reason}}

Pour plus d''informations : tresorier@afneus.org

AFNEUS',
'["user_name", "user_first_name", "claim_number", "amount", "event_name", "rejection_date", "rejection_reason", "validator_name"]'::jsonb);

-- Template: Demande payée
INSERT INTO email_templates (code, name, subject, body_html, body_text, variables) VALUES
('CLAIM_PAID', 'Remboursement effectué', 
'💰 Remboursement effectué - {{paid_amount}}',
'<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #7c3aed;">💰 Remboursement effectué !</h2>
    <p>Bonjour <strong>{{user_first_name}}</strong>,</p>
    <p>Votre remboursement a été traité et le virement bancaire a été effectué.</p>
    
    <div style="background: #faf5ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
      <h3 style="margin-top: 0; color: #6b21a8;">💸 Virement effectué</h3>
      <p style="font-size: 32px; font-weight: bold; color: #7c3aed; margin: 10px 0;">{{paid_amount}}</p>
      <ul style="list-style: none; padding: 0; margin-top: 15px;">
        <li><strong>Demande :</strong> #{{claim_number}}</li>
        <li><strong>Événement :</strong> {{event_name}}</li>
        <li><strong>Date de paiement :</strong> {{payment_date}}</li>
      </ul>
    </div>
    
    <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0;"><strong>ℹ️ Informations bancaires</strong></p>
      <p style="margin: 10px 0 0 0; font-size: 14px;">
        Le virement devrait apparaître sur votre compte bancaire sous 2 à 3 jours ouvrés.
        Le libellé du virement contiendra la référence de votre demande.
      </p>
    </div>
    
    <p>Merci de votre participation aux événements de l''AFNEUS !</p>
    
    <p style="margin-top: 30px;">
      <a href="{{platform_url}}" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        📊 Voir ma demande
      </a>
    </p>
    
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #6b7280;">
      AFNEUS - Association Française des Neurochirurgiens en Études et Spécialisation
    </p>
  </div>
</body>
</html>',
'Bonjour {{user_first_name}},

Votre remboursement a été effectué !

Montant : {{paid_amount}}
Demande : #{{claim_number}}
Date : {{payment_date}}

Le virement apparaîtra sur votre compte sous 2-3 jours.

AFNEUS',
'["user_name", "user_first_name", "claim_number", "paid_amount", "event_name", "payment_date", "platform_url"]'::jsonb);

-- ============================================================================
-- 10. RLS POLICIES
-- ============================================================================

-- Email templates: lecture publique, modification admin uniquement
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique des templates actifs"
  ON email_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins peuvent tout faire sur templates"
  ON email_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- Email queue: utilisateurs voient leurs emails, admins voient tout
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs voient leurs emails"
  ON email_queue FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins voient tous les emails"
  ON email_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'TREASURER')
    )
  );

-- Notification preferences: chaque utilisateur gère ses préférences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs gèrent leurs préférences"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid());

-- Notification log: utilisateurs voient leur historique, admins voient tout
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs voient leur historique"
  ON notification_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins voient tout l'historique"
  ON notification_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'TREASURER')
    )
  );

-- ============================================================================
-- 11. VUES UTILES
-- ============================================================================

-- Vue des emails en attente d'envoi
CREATE OR REPLACE VIEW pending_emails AS
SELECT 
  eq.*,
  u.email AS user_email,
  u.first_name || ' ' || u.last_name AS user_name,
  c.status AS claim_status
FROM email_queue eq
LEFT JOIN users u ON eq.user_id = u.id
LEFT JOIN expense_claims c ON eq.claim_id = c.id
WHERE eq.status = 'pending'
  AND eq.scheduled_for <= CURRENT_TIMESTAMP
ORDER BY eq.priority ASC, eq.scheduled_for ASC;

COMMENT ON VIEW pending_emails IS 'Emails prêts à être envoyés, triés par priorité';

-- Vue statistiques d'emails
CREATE OR REPLACE VIEW email_statistics AS
SELECT 
  template_code,
  COUNT(*) AS total_sent,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) AS successful,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed,
  AVG(attempts) AS avg_attempts,
  MAX(created_at) AS last_sent
FROM email_queue
WHERE status IN ('sent', 'failed')
GROUP BY template_code;

COMMENT ON VIEW email_statistics IS 'Statistiques d''envoi par type de template';

-- ============================================================================
-- FIN DE LA MIGRATION 008
-- ============================================================================

COMMENT ON SCHEMA public IS 'Migration 008: Système complet de notifications email avec templates, file d''attente, et triggers automatiques';
