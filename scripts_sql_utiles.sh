#!/bin/bash

# ============================================================================
# Scripts SQL Utiles - AFNEUS Platform
# ============================================================================
# Collection de requêtes SQL pratiques pour maintenance et monitoring
# Usage: Copier-coller dans le SQL Editor de Supabase
# ============================================================================

echo "📚 Scripts SQL Utiles AFNEUS - Copier dans Supabase SQL Editor"
echo ""

# ============================================================================
# 1. VÉRIFICATION INSTALLATION
# ============================================================================

cat << 'SQL'
-- ============================================================================
-- 1.1 Vérifier tables créées
-- ============================================================================
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================================
-- 1.2 Vérifier triggers
-- ============================================================================
SELECT 
  trigger_name,
  event_object_table AS table_name,
  action_timing || ' ' || event_manipulation AS when_event
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 1.3 Vérifier fonctions
-- ============================================================================
SELECT 
  routine_name,
  routine_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name NOT LIKE 'pg_%'
ORDER BY routine_type, routine_name;

-- ============================================================================
-- 1.4 Vérifier vues
-- ============================================================================
SELECT 
  table_name AS view_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- 1.5 Vérifier RLS activé
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
SQL

echo ""
echo "# ============================================================================"
echo "# 2. MONITORING & STATISTIQUES"
echo "# ============================================================================"
echo ""

cat << 'SQL'
-- ============================================================================
-- 2.1 Dashboard général
-- ============================================================================
SELECT 
  'Utilisateurs' AS metric,
  COUNT(*) AS total,
  COUNT(CASE WHEN is_active THEN 1 END) AS active,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) AS new_this_week
FROM users

UNION ALL

SELECT 
  'Demandes',
  COUNT(*),
  COUNT(CASE WHEN status IN ('SUBMITTED', 'VALIDATED') THEN 1 END),
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END)
FROM expense_claims

UNION ALL

SELECT 
  'Emails envoyés',
  COUNT(*),
  COUNT(CASE WHEN status = 'sent' THEN 1 END),
  COUNT(CASE WHEN sent_at > NOW() - INTERVAL '7 days' THEN 1 END)
FROM email_queue

UNION ALL

SELECT 
  'Sessions actives',
  COUNT(*),
  COUNT(CASE WHEN last_activity > NOW() - INTERVAL '1 hour' THEN 1 END),
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END)
FROM user_sessions
WHERE is_active = true;

-- ============================================================================
-- 2.2 Statistiques emails détaillées
-- ============================================================================
SELECT 
  template_code,
  COUNT(*) AS total,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) AS sent,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending,
  ROUND(100.0 * COUNT(CASE WHEN status = 'sent' THEN 1 END) / NULLIF(COUNT(*), 0), 2) || '%' AS success_rate,
  AVG(attempts)::NUMERIC(10,2) AS avg_attempts,
  MAX(created_at) AS last_sent
FROM email_queue
GROUP BY template_code
ORDER BY total DESC;

-- ============================================================================
-- 2.3 Top 10 utilisateurs (remboursements)
-- ============================================================================
SELECT 
  u.first_name || ' ' || u.last_name AS user_name,
  u.email,
  ms.label AS status,
  COUNT(ec.id) AS total_claims,
  COUNT(CASE WHEN ec.status = 'PAID' THEN 1 END) AS paid_claims,
  COALESCE(SUM(CASE WHEN ec.status = 'PAID' THEN ec.validated_amount ELSE 0 END), 0) AS total_reimbursed
FROM users u
LEFT JOIN member_statuses ms ON u.status_id = ms.id
LEFT JOIN expense_claims ec ON u.id = ec.user_id
GROUP BY u.id, u.first_name, u.last_name, u.email, ms.label
ORDER BY total_reimbursed DESC
LIMIT 10;

-- ============================================================================
-- 2.4 Sessions actives en temps réel
-- ============================================================================
SELECT 
  u.email,
  u.first_name || ' ' || u.last_name AS user_name,
  us.device_type,
  us.browser,
  us.ip_address,
  us.oauth_provider,
  us.last_activity,
  EXTRACT(EPOCH FROM (NOW() - us.last_activity))/60 AS minutes_inactive
FROM user_sessions us
JOIN users u ON us.user_id = u.id
WHERE us.is_active = true
  AND us.expires_at > NOW()
ORDER BY us.last_activity DESC;

-- ============================================================================
-- 2.5 Événements de sécurité critiques (7 derniers jours)
-- ============================================================================
SELECT 
  se.created_at,
  u.email,
  se.event_type,
  se.event_category,
  se.severity,
  se.description,
  se.success,
  se.ip_address
FROM security_events se
LEFT JOIN users u ON se.user_id = u.id
WHERE se.created_at > NOW() - INTERVAL '7 days'
  AND se.severity IN ('critical', 'alert')
ORDER BY se.created_at DESC;
SQL

echo ""
echo "# ============================================================================"
echo "# 3. GESTION QUOTIDIENNE"
echo "# ============================================================================"
echo ""

cat << 'SQL'
-- ============================================================================
-- 3.1 Demandes en attente de validation
-- ============================================================================
SELECT 
  ec.created_at,
  u.first_name || ' ' || u.last_name AS demandeur,
  u.email,
  e.name AS event_name,
  ec.total_amount,
  EXTRACT(DAY FROM NOW() - ec.created_at) || ' jours' AS waiting_time,
  COUNT(ei.id) AS nb_items,
  COUNT(j.id) AS nb_justificatifs
FROM expense_claims ec
JOIN users u ON ec.user_id = u.id
LEFT JOIN events e ON ec.event_id = e.id
LEFT JOIN expense_items ei ON ec.id = ei.claim_id
LEFT JOIN justificatifs j ON ec.id = j.claim_id
WHERE ec.status = 'SUBMITTED'
GROUP BY ec.id, ec.created_at, u.first_name, u.last_name, u.email, e.name, ec.total_amount
ORDER BY ec.created_at ASC;

-- ============================================================================
-- 3.2 Emails échoués à réessayer
-- ============================================================================
SELECT 
  eq.id,
  eq.to_email,
  eq.to_name,
  eq.subject,
  eq.template_code,
  eq.attempts,
  eq.last_error,
  eq.created_at
FROM email_queue eq
WHERE eq.status = 'failed'
  AND eq.attempts < eq.max_attempts
ORDER BY eq.priority ASC, eq.created_at ASC;

-- Réinitialiser un email échoué (remplacer EMAIL_ID)
-- UPDATE email_queue 
-- SET status = 'pending', attempts = 0, last_error = NULL 
-- WHERE id = 'EMAIL_ID';

-- ============================================================================
-- 3.3 Nouvelles demandes aujourd'hui
-- ============================================================================
SELECT 
  ec.created_at,
  u.first_name || ' ' || u.last_name AS demandeur,
  e.name AS event_name,
  ec.total_amount,
  ec.status
FROM expense_claims ec
JOIN users u ON ec.user_id = u.id
LEFT JOIN events e ON ec.event_id = e.id
WHERE DATE(ec.created_at) = CURRENT_DATE
ORDER BY ec.created_at DESC;

-- ============================================================================
-- 3.4 Paiements à effectuer (validés mais pas payés)
-- ============================================================================
SELECT 
  ec.validated_at,
  u.first_name || ' ' || u.last_name AS beneficiaire,
  u.email,
  u.iban,
  e.name AS event_name,
  ec.validated_amount,
  EXTRACT(DAY FROM NOW() - ec.validated_at) || ' jours depuis validation' AS waiting_time
FROM expense_claims ec
JOIN users u ON ec.user_id = u.id
LEFT JOIN events e ON ec.event_id = e.id
WHERE ec.status = 'VALIDATED'
  AND ec.validated_amount > 0
  AND u.iban IS NOT NULL
  AND u.iban_verified = true
ORDER BY ec.validated_at ASC;
SQL

echo ""
echo "# ============================================================================"
echo "# 4. MAINTENANCE & NETTOYAGE"
echo "# ============================================================================"
echo ""

cat << 'SQL'
-- ============================================================================
-- 4.1 Nettoyer sessions expirées
-- ============================================================================
SELECT cleanup_expired_sessions();

-- ============================================================================
-- 4.2 Archiver événements de sécurité anciens (> 90 jours)
-- ============================================================================
SELECT archive_old_security_events(90);

-- ============================================================================
-- 4.3 Supprimer emails envoyés anciens (> 30 jours)
-- ============================================================================
DELETE FROM email_queue
WHERE status = 'sent'
  AND sent_at < NOW() - INTERVAL '30 days';

-- ============================================================================
-- 4.4 Réinitialiser tous les emails échoués
-- ============================================================================
UPDATE email_queue
SET status = 'pending', attempts = 0, last_error = NULL
WHERE status = 'failed'
  AND attempts < max_attempts;

-- ============================================================================
-- 4.5 Vacuum et analyse (performance)
-- ============================================================================
VACUUM ANALYZE users;
VACUUM ANALYZE expense_claims;
VACUUM ANALYZE email_queue;
VACUUM ANALYZE user_sessions;
SQL

echo ""
echo "# ============================================================================"
echo "# 5. TESTS & DEBUGGING"
echo "# ============================================================================"
echo ""

cat << 'SQL'
-- ============================================================================
-- 5.1 Tester template email
-- ============================================================================
SELECT * FROM render_email_template(
  'CLAIM_SUBMITTED',
  jsonb_build_object(
    'user_first_name', 'Jean',
    'claim_number', '123',
    'amount', '100.00 €',
    'event_name', 'Congrès Annuel 2024',
    'event_date', '15/12/2024',
    'submitted_date', '01/12/2024 14:30',
    'platform_url', 'https://afneus.fr/claims/123'
  )
);

-- ============================================================================
-- 5.2 Créer email de test dans la queue
-- ============================================================================
SELECT queue_email(
  'votre-email@test.com', -- to_email
  'Test User',            -- to_name
  'Email de test AFNEUS', -- subject
  '<h1>Ceci est un test</h1><p>Email de test du système AFNEUS</p>', -- body_html
  'Ceci est un test - Email de test du système AFNEUS', -- body_text
  'TEST',                 -- template_code
  NULL,                   -- template_variables
  1                       -- priority (1=urgent)
);

-- ============================================================================
-- 5.3 Vérifier calcul bonus covoiturage
-- ============================================================================
-- Exemple: 500km, 3 passagers, coût 100€, membre BN (coefficient 1.20)
SELECT calculate_carpooling_bonus(
  500,    -- distance_km
  3,      -- passengers_count
  100.00, -- initial_cost
  1.20    -- member_coefficient
) AS bonus_calculated;

-- Résultat attendu: 40.00 (cap à 40% du coût)

-- ============================================================================
-- 5.4 Simuler détection activité suspecte
-- ============================================================================
SELECT * FROM check_suspicious_login(
  (SELECT id FROM users LIMIT 1), -- user_id
  '203.0.113.1'::inet,            -- ip_address
  'Mozilla/5.0 (Unknown Device)'  -- user_agent
);

-- ============================================================================
-- 5.5 Logger événement de sécurité test
-- ============================================================================
SELECT log_security_event(
  (SELECT id FROM users LIMIT 1), -- user_id
  'test_event',                    -- event_type
  'security',                      -- event_category
  'info',                          -- severity
  'Événement de test',            -- description
  jsonb_build_object('test', true), -- metadata
  '127.0.0.1'::inet,              -- ip_address
  'Test User-Agent',               -- user_agent
  true                             -- success
);
SQL

echo ""
echo "# ============================================================================"
echo "# 6. SÉCURITÉ & AUDIT"
echo "# ============================================================================"
echo ""

cat << 'SQL'
-- ============================================================================
-- 6.1 Tentatives de connexion échouées par utilisateur (24h)
-- ============================================================================
SELECT 
  u.email,
  COUNT(*) AS failed_attempts,
  MAX(se.created_at) AS last_attempt,
  ARRAY_AGG(DISTINCT se.ip_address::text) AS ip_addresses
FROM security_events se
JOIN users u ON se.user_id = u.id
WHERE se.event_type = 'login_failed'
  AND se.created_at > NOW() - INTERVAL '24 hours'
GROUP BY u.email
HAVING COUNT(*) >= 3
ORDER BY COUNT(*) DESC;

-- ============================================================================
-- 6.2 Connexions depuis plusieurs pays (même utilisateur)
-- ============================================================================
SELECT 
  u.email,
  COUNT(DISTINCT us.country_code) AS countries_count,
  ARRAY_AGG(DISTINCT us.country_code) AS countries,
  ARRAY_AGG(DISTINCT us.ip_address::text) AS ip_addresses
FROM user_sessions us
JOIN users u ON us.user_id = u.id
WHERE us.created_at > NOW() - INTERVAL '7 days'
GROUP BY u.email
HAVING COUNT(DISTINCT us.country_code) > 1
ORDER BY COUNT(DISTINCT us.country_code) DESC;

-- ============================================================================
-- 6.3 Audit modifications profil utilisateur
-- ============================================================================
SELECT 
  se.created_at,
  u.email,
  se.event_type,
  se.description,
  se.metadata
FROM security_events se
JOIN users u ON se.user_id = u.id
WHERE se.event_type IN ('profile_updated', 'email_changed', 'iban_changed')
ORDER BY se.created_at DESC
LIMIT 20;

-- ============================================================================
-- 6.4 Utilisateurs avec permissions élevées
-- ============================================================================
SELECT 
  u.email,
  u.first_name || ' ' || u.last_name AS name,
  u.role,
  ms.label AS status,
  u.is_active,
  u.created_at,
  u.last_login_at
FROM users u
LEFT JOIN member_statuses ms ON u.status_id = ms.id
WHERE u.role IN ('ADMIN', 'TREASURER', 'VALIDATOR')
ORDER BY 
  CASE u.role 
    WHEN 'ADMIN' THEN 1 
    WHEN 'TREASURER' THEN 2 
    WHEN 'VALIDATOR' THEN 3 
  END;
SQL

echo ""
echo "# ============================================================================"
echo "# 7. EXPORT & RAPPORTS"
echo "# ============================================================================"
echo ""

cat << 'SQL'
-- ============================================================================
-- 7.1 Rapport mensuel des remboursements
-- ============================================================================
SELECT 
  TO_CHAR(DATE_TRUNC('month', ec.created_at), 'YYYY-MM') AS mois,
  COUNT(DISTINCT ec.id) AS total_demandes,
  COUNT(CASE WHEN ec.status = 'PAID' THEN 1 END) AS demandes_payees,
  COALESCE(SUM(CASE WHEN ec.status = 'PAID' THEN ec.validated_amount ELSE 0 END), 0) AS montant_total,
  COALESCE(AVG(CASE WHEN ec.status = 'PAID' THEN ec.validated_amount END), 0) AS montant_moyen,
  COUNT(DISTINCT ec.user_id) AS utilisateurs_uniques
FROM expense_claims ec
WHERE ec.created_at >= DATE_TRUNC('year', NOW())
GROUP BY DATE_TRUNC('month', ec.created_at)
ORDER BY mois DESC;

-- ============================================================================
-- 7.2 Export CSV demandes payées (copier résultat)
-- ============================================================================
SELECT 
  ec.created_at::date AS date_demande,
  ec.validated_at::date AS date_validation,
  u.email AS email_beneficiaire,
  u.first_name || ' ' || u.last_name AS nom_beneficiaire,
  u.iban,
  e.name AS evenement,
  ec.validated_amount AS montant,
  ec.validator_comments AS commentaires
FROM expense_claims ec
JOIN users u ON ec.user_id = u.id
LEFT JOIN events e ON ec.event_id = e.id
WHERE ec.status = 'PAID'
  AND ec.validated_at >= DATE_TRUNC('month', NOW())
ORDER BY ec.validated_at DESC;

-- ============================================================================
-- 7.3 Statistiques covoiturage
-- ============================================================================
SELECT 
  COUNT(*) AS total_trajets,
  SUM(passengers_count) AS total_passagers,
  AVG(passengers_count) AS passagers_moyen,
  SUM(distance_km) AS total_km,
  AVG(distance_km) AS km_moyen,
  SUM(carpooling_bonus) AS total_bonus,
  AVG(carpooling_bonus) AS bonus_moyen,
  SUM(CASE WHEN distance_is_approximate THEN 1 ELSE 0 END) AS trajets_approximatifs
FROM expense_items
WHERE expense_type = 'VOITURE'
  AND carpooling_bonus > 0;
SQL

echo ""
echo "✅ Scripts copiés ! Maintenant utilisez Supabase SQL Editor pour les exécuter."
echo ""
echo "📝 Tips:"
echo "  - Exécutez section par section"
echo "  - Commentez (--) les lignes UPDATE/DELETE avant test"
echo "  - Sauvegardez vos requêtes fréquentes dans Supabase"
echo ""
