-- ============================================================================
-- Migration 009: Enhanced Authentication with OAuth & Security
-- ============================================================================
-- Description: Amélioration du système d'authentification avec Google OAuth,
-- SSO, 2FA, sessions, et sécurité avancée
-- ============================================================================

-- ============================================================================
-- 1. TABLE: oauth_providers
-- ============================================================================
-- Configuration des providers OAuth (Google, Microsoft, etc.)
CREATE TABLE IF NOT EXISTS oauth_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL, -- google, microsoft, github, etc.
  name VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  
  -- Configuration OAuth
  client_id TEXT,
  client_secret_encrypted TEXT, -- Chiffré dans l'application
  authorization_url TEXT,
  token_url TEXT,
  userinfo_url TEXT,
  scopes TEXT[], -- ['email', 'profile', etc.]
  
  -- Mapping des champs utilisateur
  field_mapping JSONB DEFAULT '{
    "email": "email",
    "first_name": "given_name",
    "last_name": "family_name",
    "avatar": "picture"
  }'::jsonb,
  
  -- Auto-provisioning
  auto_create_users BOOLEAN DEFAULT true,
  auto_assign_role VARCHAR(50) DEFAULT 'MEMBER',
  allowed_domains TEXT[], -- ['afneus.org'] pour restreindre
  
  -- Métadonnées
  icon_url TEXT,
  button_label TEXT DEFAULT 'Se connecter avec {{name}}',
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE oauth_providers IS 'Configuration des fournisseurs OAuth (Google, Microsoft, etc.)';
COMMENT ON COLUMN oauth_providers.allowed_domains IS 'Domaines autorisés pour l''auto-provisioning (ex: afneus.org)';

-- Provider Google par défaut
INSERT INTO oauth_providers (code, name, is_enabled, scopes, allowed_domains, icon_url, display_order) VALUES
('google', 'Google', true, 
 ARRAY['openid', 'email', 'profile'], 
 ARRAY['afneus.org'],
 'https://www.google.com/favicon.ico',
 1);

-- ============================================================================
-- 2. TABLE: user_sessions
-- ============================================================================
-- Gestion avancée des sessions utilisateur
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Informations de session
  session_token VARCHAR(255) UNIQUE NOT NULL,
  refresh_token VARCHAR(255),
  
  -- Sécurité
  ip_address INET,
  user_agent TEXT,
  device_type VARCHAR(50), -- desktop, mobile, tablet
  device_name VARCHAR(255),
  browser VARCHAR(100),
  os VARCHAR(100),
  
  -- Géolocalisation
  country_code VARCHAR(2),
  city VARCHAR(100),
  
  -- OAuth
  oauth_provider VARCHAR(50), -- google, microsoft, null si email/password
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_token_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Gestion de session
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_device_type CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown'))
);

COMMENT ON TABLE user_sessions IS 'Sessions utilisateur avec tracking détaillé pour sécurité';

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- ============================================================================
-- 3. TABLE: security_events
-- ============================================================================
-- Log des événements de sécurité (tentatives de connexion, changements, etc.)
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Type d'événement
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50) NOT NULL, -- authentication, authorization, data_access, configuration
  severity VARCHAR(20) DEFAULT 'info', -- info, warning, critical
  
  -- Détails
  description TEXT,
  metadata JSONB,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
  
  -- Résultat
  success BOOLEAN,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_category CHECK (event_category IN ('authentication', 'authorization', 'data_access', 'configuration', 'security')),
  CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'critical', 'alert'))
);

COMMENT ON TABLE security_events IS 'Journal d''audit de sécurité pour conformité et détection d''anomalies';

CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_created ON security_events(created_at DESC);
CREATE INDEX idx_security_events_severity ON security_events(severity) WHERE severity IN ('critical', 'alert');

-- Types d'événements communs
COMMENT ON COLUMN security_events.event_type IS 'login_success, login_failed, password_reset, email_changed, role_changed, mfa_enabled, suspicious_activity, etc.';

-- ============================================================================
-- 4. TABLE: trusted_devices
-- ============================================================================
-- Appareils de confiance pour 2FA optionnel
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Identification
  device_fingerprint VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  
  -- Sécurité
  is_trusted BOOLEAN DEFAULT false,
  trust_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Tracking
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE trusted_devices IS 'Appareils de confiance pour authentification sans friction';

CREATE INDEX idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);

-- ============================================================================
-- 5. TABLE: api_keys
-- ============================================================================
-- Clés API pour intégrations tierces (future)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Key
  key_hash VARCHAR(255) UNIQUE NOT NULL, -- Hash de la clé
  key_prefix VARCHAR(20) NOT NULL, -- Premiers caractères pour identification
  name VARCHAR(255) NOT NULL,
  
  -- Permissions
  scopes TEXT[] DEFAULT ARRAY['read'], -- read, write, admin
  allowed_ips TEXT[], -- Restriction par IP
  rate_limit INTEGER DEFAULT 1000, -- Requêtes par heure
  
  -- Gestion
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE api_keys IS 'Clés API pour intégrations et automatisation (future)';

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- ============================================================================
-- 6. FUNCTION: log_security_event
-- ============================================================================
-- Fonction pour logger les événements de sécurité
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id UUID,
  p_event_type VARCHAR,
  p_event_category VARCHAR,
  p_severity VARCHAR DEFAULT 'info',
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO security_events (
    user_id, event_type, event_category, severity,
    description, metadata, ip_address, user_agent,
    success, error_message
  ) VALUES (
    p_user_id, p_event_type, p_event_category, p_severity,
    p_description, p_metadata, p_ip_address, p_user_agent,
    p_success, p_error_message
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_security_event IS 'Enregistre un événement de sécurité dans l''audit log';

-- ============================================================================
-- 7. FUNCTION: create_user_session
-- ============================================================================
-- Fonction pour créer une session avec tracking
CREATE OR REPLACE FUNCTION create_user_session(
  p_user_id UUID,
  p_session_token VARCHAR,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_oauth_provider VARCHAR DEFAULT NULL,
  p_device_info JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
  v_device_type VARCHAR;
  v_browser VARCHAR;
  v_os VARCHAR;
BEGIN
  -- Extraire les infos du device depuis user_agent
  v_device_type := COALESCE((p_device_info->>'device_type')::VARCHAR, 'unknown');
  v_browser := (p_device_info->>'browser')::VARCHAR;
  v_os := (p_device_info->>'os')::VARCHAR;
  
  -- Créer la session
  INSERT INTO user_sessions (
    user_id, session_token, ip_address, user_agent,
    device_type, browser, os, oauth_provider,
    expires_at
  ) VALUES (
    p_user_id, p_session_token, p_ip_address, p_user_agent,
    v_device_type, v_browser, v_os, p_oauth_provider,
    CURRENT_TIMESTAMP + INTERVAL '30 days'
  ) RETURNING id INTO v_session_id;
  
  -- Logger l'événement
  PERFORM log_security_event(
    p_user_id,
    'session_created',
    'authentication',
    'info',
    'Nouvelle session créée',
    jsonb_build_object(
      'session_id', v_session_id,
      'oauth_provider', p_oauth_provider,
      'device_type', v_device_type
    ),
    p_ip_address,
    p_user_agent,
    true
  );
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_user_session IS 'Crée une session utilisateur avec tracking de sécurité';

-- ============================================================================
-- 8. FUNCTION: check_suspicious_login
-- ============================================================================
-- Détection d'activité suspecte lors du login
CREATE OR REPLACE FUNCTION check_suspicious_login(
  p_user_id UUID,
  p_ip_address INET,
  p_user_agent TEXT
) RETURNS TABLE(is_suspicious BOOLEAN, reason TEXT, risk_score INTEGER) AS $$
DECLARE
  v_last_login RECORD;
  v_failed_attempts INTEGER;
  v_is_new_device BOOLEAN;
  v_risk_score INTEGER := 0;
  v_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Vérifier les tentatives échouées récentes
  SELECT COUNT(*) INTO v_failed_attempts
  FROM security_events
  WHERE user_id = p_user_id
    AND event_type = 'login_failed'
    AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
    AND success = false;
  
  IF v_failed_attempts >= 3 THEN
    v_risk_score := v_risk_score + 40;
    v_reasons := array_append(v_reasons, 'Tentatives de connexion échouées récentes');
  END IF;
  
  -- Vérifier si c'est un nouvel appareil
  SELECT NOT EXISTS (
    SELECT 1 FROM user_sessions
    WHERE user_id = p_user_id
      AND user_agent = p_user_agent
  ) INTO v_is_new_device;
  
  IF v_is_new_device THEN
    v_risk_score := v_risk_score + 20;
    v_reasons := array_append(v_reasons, 'Nouvel appareil');
  END IF;
  
  -- Vérifier changement d'IP significatif
  SELECT * INTO v_last_login
  FROM user_sessions
  WHERE user_id = p_user_id
    AND is_active = true
  ORDER BY last_activity DESC
  LIMIT 1;
  
  IF v_last_login.ip_address IS NOT NULL 
     AND v_last_login.ip_address != p_ip_address THEN
    v_risk_score := v_risk_score + 15;
    v_reasons := array_append(v_reasons, 'Changement d''adresse IP');
  END IF;
  
  -- Vérifier login en dehors des heures normales (2h-6h)
  IF EXTRACT(HOUR FROM CURRENT_TIMESTAMP) BETWEEN 2 AND 6 THEN
    v_risk_score := v_risk_score + 10;
    v_reasons := array_append(v_reasons, 'Connexion en dehors des heures habituelles');
  END IF;
  
  RETURN QUERY SELECT 
    v_risk_score >= 30,
    array_to_string(v_reasons, ', '),
    v_risk_score;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_suspicious_login IS 'Analyse le risque d''une tentative de connexion';

-- ============================================================================
-- 9. FUNCTION: enhanced_handle_new_user
-- ============================================================================
-- Version améliorée de handle_new_user avec support OAuth
CREATE OR REPLACE FUNCTION enhanced_handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_email VARCHAR;
  v_first_name VARCHAR;
  v_last_name VARCHAR;
  v_status_code VARCHAR := 'AUTRE';
  v_role VARCHAR := 'MEMBER';
  v_oauth_provider VARCHAR;
  v_avatar_url TEXT;
BEGIN
  -- Récupérer les infos du nouvel utilisateur auth
  v_user_id := NEW.id;
  v_email := NEW.email;
  
  -- Extraire metadata
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', 
                           NEW.raw_user_meta_data->>'given_name',
                           split_part(v_email, '@', 1));
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name',
                          NEW.raw_user_meta_data->>'family_name',
                          '');
  v_avatar_url := NEW.raw_user_meta_data->>'avatar_url';
  
  -- Détecter le provider OAuth
  IF NEW.app_metadata ? 'provider' THEN
    v_oauth_provider := NEW.app_metadata->>'provider';
  END IF;
  
  -- Déterminer le statut et rôle selon l'email
  IF v_email LIKE '%@afneus.org' THEN
    -- Vérifier si c'est un membre BN
    SELECT ms.code INTO v_status_code
    FROM bn_members_reference bn
    JOIN member_statuses ms ON bn.status_id = ms.id
    WHERE LOWER(bn.email) = LOWER(v_email);
    
    IF NOT FOUND THEN
      v_status_code := 'BN'; -- Par défaut BN si email @afneus.org
    END IF;
    
    -- Les @afneus.org peuvent être VALIDATOR par défaut
    v_role := 'VALIDATOR';
  END IF;
  
  -- Récupérer le status_id
  DECLARE
    v_status_id UUID;
  BEGIN
    SELECT id INTO v_status_id
    FROM member_statuses
    WHERE code = v_status_code;
    
    -- Créer l'utilisateur dans public.users
    INSERT INTO users (
      id, email, first_name, last_name,
      role, status_id,
      email_verified, is_active,
      oauth_provider, avatar_url,
      created_at, updated_at
    ) VALUES (
      v_user_id, v_email, v_first_name, v_last_name,
      v_role, v_status_id,
      NEW.email_confirmed_at IS NOT NULL, true,
      v_oauth_provider, v_avatar_url,
      NEW.created_at, NEW.updated_at
    );
    
    -- Créer les préférences de notification par défaut
    INSERT INTO notification_preferences (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Logger l'événement
    PERFORM log_security_event(
      v_user_id,
      'user_created',
      'authentication',
      'info',
      'Nouvel utilisateur créé',
      jsonb_build_object(
        'email', v_email,
        'oauth_provider', v_oauth_provider,
        'status', v_status_code,
        'role', v_role
      ),
      NULL,
      NULL,
      true
    );
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remplacer l'ancien trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION enhanced_handle_new_user();

COMMENT ON FUNCTION enhanced_handle_new_user IS 'Gestion améliorée de création utilisateur avec support OAuth et auto-assignment intelligent';

-- ============================================================================
-- 10. VUES DE MONITORING
-- ============================================================================

-- Vue des sessions actives
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
  us.id,
  us.user_id,
  u.email,
  u.first_name || ' ' || u.last_name AS user_name,
  us.device_type,
  us.browser,
  us.os,
  us.ip_address,
  us.oauth_provider,
  us.last_activity,
  us.created_at,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - us.last_activity))/3600 AS hours_since_activity
FROM user_sessions us
JOIN users u ON us.user_id = u.id
WHERE us.is_active = true
  AND us.expires_at > CURRENT_TIMESTAMP
ORDER BY us.last_activity DESC;

COMMENT ON VIEW active_sessions IS 'Sessions utilisateur actuellement actives';

-- Vue des événements de sécurité récents
CREATE OR REPLACE VIEW recent_security_events AS
SELECT 
  se.id,
  se.user_id,
  u.email,
  se.event_type,
  se.event_category,
  se.severity,
  se.description,
  se.success,
  se.ip_address,
  se.created_at
FROM security_events se
LEFT JOIN users u ON se.user_id = u.id
WHERE se.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY se.created_at DESC;

COMMENT ON VIEW recent_security_events IS 'Événements de sécurité des 7 derniers jours';

-- Vue statistiques d'authentification
CREATE OR REPLACE VIEW auth_statistics AS
SELECT 
  DATE(created_at) AS date,
  event_type,
  COUNT(*) AS count,
  COUNT(CASE WHEN success = true THEN 1 END) AS successful,
  COUNT(CASE WHEN success = false THEN 1 END) AS failed,
  COUNT(DISTINCT user_id) AS unique_users
FROM security_events
WHERE event_category = 'authentication'
  AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY DATE(created_at), event_type
ORDER BY date DESC, count DESC;

COMMENT ON VIEW auth_statistics IS 'Statistiques d''authentification quotidiennes';

-- ============================================================================
-- 11. RLS POLICIES
-- ============================================================================

-- OAuth providers: lecture publique pour affichage, modification admin uniquement
ALTER TABLE oauth_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique des providers actifs"
  ON oauth_providers FOR SELECT
  USING (is_enabled = true);

CREATE POLICY "Admins gèrent les OAuth providers"
  ON oauth_providers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- User sessions: utilisateurs voient leurs sessions, admins voient tout
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs voient leurs sessions"
  ON user_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Utilisateurs terminent leurs sessions"
  ON user_sessions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins voient toutes les sessions"
  ON user_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- Security events: utilisateurs voient leurs événements, admins voient tout
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs voient leurs événements"
  ON security_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins voient tous les événements"
  ON security_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- Trusted devices: utilisateurs gèrent leurs appareils
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs gèrent leurs appareils"
  ON trusted_devices FOR ALL
  USING (user_id = auth.uid());

-- API keys: utilisateurs gèrent leurs clés
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs gèrent leurs clés API"
  ON api_keys FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- 12. NETTOYAGE AUTOMATIQUE
-- ============================================================================

-- Fonction pour nettoyer les sessions expirées
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM user_sessions
    WHERE expires_at < CURRENT_TIMESTAMP
      AND is_active = false
    RETURNING *
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_sessions IS 'Nettoie les sessions expirées (à exécuter périodiquement)';

-- Fonction pour archiver les vieux événements de sécurité
CREATE OR REPLACE FUNCTION archive_old_security_events(p_days INTEGER DEFAULT 90) RETURNS INTEGER AS $$
DECLARE
  v_archived_count INTEGER;
BEGIN
  -- Pour l'instant, on supprime simplement (future: archiver dans une table séparée)
  WITH deleted AS (
    DELETE FROM security_events
    WHERE created_at < CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
      AND severity IN ('info', 'warning')
    RETURNING *
  )
  SELECT COUNT(*) INTO v_archived_count FROM deleted;
  
  RETURN v_archived_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION archive_old_security_events IS 'Archive/supprime les événements de sécurité anciens (garde critical/alert)';

-- ============================================================================
-- FIN DE LA MIGRATION 009
-- ============================================================================

COMMENT ON SCHEMA public IS 'Migration 009: Authentification avancée avec OAuth, sessions, sécurité, et audit';
