# 🚀 Guide de Configuration - Système d'Authentification et Notifications AFNEUS

## 📋 Table des matières
1. [Exécution des migrations](#1-exécution-des-migrations)
2. [Configuration Google OAuth](#2-configuration-google-oauth)
3. [Configuration Email (Resend)](#3-configuration-email-resend)
4. [Déploiement Edge Functions](#4-déploiement-edge-functions)
5. [Configuration Cron Jobs](#5-configuration-cron-jobs)
6. [Tests](#6-tests)
7. [Monitoring](#7-monitoring)

---

## 1. 🗄️ Exécution des migrations

### Ordre d'exécution (IMPORTANT)
Exécuter dans cet ordre dans le SQL Editor de Supabase :

```sql
-- 1. Structure de base (si pas déjà fait)
\i 003_optimized_structure.sql

-- 2. Dashboard et statistiques (si pas déjà fait)
\i 005_dashboard_and_stats.sql

-- 3. Membres BN (si pas déjà fait)
\i 006_init_bn_members.sql

-- 4. Système d'authentification
\i 007_authentication_system.sql

-- 5. Système de notifications email
\i 008_email_notifications_system.sql

-- 6. Authentification OAuth avancée
\i 009_enhanced_authentication_oauth.sql
```

### Vérification post-migration

```sql
-- Vérifier que les tables existent
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'email_templates',
  'email_queue',
  'notification_preferences',
  'notification_log',
  'oauth_providers',
  'user_sessions',
  'security_events'
)
ORDER BY table_name;

-- Devrait retourner 7 tables

-- Vérifier les triggers
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name LIKE '%notify%' OR trigger_name LIKE '%auth%';

-- Vérifier les templates email
SELECT code, name, is_active FROM email_templates;
-- Devrait retourner 5 templates : CLAIM_SUBMITTED, CLAIM_NEW_ADMIN, CLAIM_VALIDATED, CLAIM_REJECTED, CLAIM_PAID
```

---

## 2. 🔐 Configuration Google OAuth

### Étape 1 : Google Cloud Console

1. **Aller sur** https://console.cloud.google.com
2. **Créer un projet** (ou sélectionner existant)
   - Nom : `AFNEUS Platform`
3. **Activer Google+ API**
   - APIs & Services > Library
   - Chercher "Google+ API"
   - Cliquer "Enable"

### Étape 2 : Créer les credentials OAuth

1. **APIs & Services > Credentials**
2. **Create Credentials > OAuth client ID**
3. **Configure consent screen** (si demandé)
   - User Type: **External**
   - App name: `AFNEUS Remboursements`
   - User support email: `contact@afneus.org`
   - Developer contact: `contact@afneus.org`
   - Scopes : `email`, `profile`, `openid`
   - Add test users: vos emails @afneus.org

4. **Créer OAuth Client ID**
   - Application type: **Web application**
   - Name: `AFNEUS Web App`
   - Authorized JavaScript origins:
     ```
     https://YOUR_PROJECT_REF.supabase.co
     http://localhost:3000
     ```
   - Authorized redirect URIs:
     ```
     https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
     http://localhost:54321/auth/v1/callback
     ```

5. **Copier** Client ID et Client Secret

### Étape 3 : Configuration dans Supabase

1. **Aller dans** Supabase Dashboard > Authentication > Providers
2. **Activer Google** provider
3. **Remplir :**
   - Client ID: `VOTRE_CLIENT_ID.apps.googleusercontent.com`
   - Client Secret: `VOTRE_CLIENT_SECRET`
4. **Cliquer** "Save"

### Étape 4 : Tester

```typescript
// Dans votre application Next.js
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
})
```

---

## 3. 📧 Configuration Email (Resend)

### Option A : Resend (RECOMMANDÉ) ⭐

**Pourquoi Resend ?**
- ✅ 3000 emails/mois GRATUIT
- ✅ Excellent deliverability
- ✅ Interface moderne
- ✅ Setup en 5 minutes
- ✅ Support React Email

#### Setup Resend

1. **Créer un compte** sur https://resend.com
2. **Vérifier votre domaine** (ou utiliser leur domaine de test)
   - Settings > Domains > Add Domain
   - Domaine : `afneus.org`
   - Ajouter les enregistrements DNS (MX, SPF, DKIM)
   
   ```dns
   Type: MX
   Host: @
   Value: feedback-smtp.us-east-1.amazonses.com
   Priority: 10
   
   Type: TXT
   Host: @
   Value: "v=spf1 include:amazonses.com ~all"
   ```

3. **Créer une API Key**
   - API Keys > Create API Key
   - Name: `AFNEUS Production`
   - Permission: **Sending access**
   - Copier la clé : `re_xxxxxxxxxxxxx`

4. **Configurer dans Supabase**
   ```bash
   # Via Supabase CLI
   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx
   supabase secrets set SMTP_FROM=noreply@afneus.org
   supabase secrets set SMTP_FROM_NAME="AFNEUS"
   ```

5. **Tester**
   ```bash
   curl -X POST https://api.resend.com/emails \
     -H "Authorization: Bearer re_xxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "from": "AFNEUS <noreply@afneus.org>",
       "to": "votre-email@test.com",
       "subject": "Test AFNEUS",
       "html": "<p>Email de test !</p>"
     }'
   ```

### Option B : SendGrid

1. **Créer compte** sur https://sendgrid.com
2. **Settings > API Keys > Create API Key**
3. **Full Access** ou **Mail Send**
4. **Configurer dans Supabase**
   ```bash
   supabase secrets set SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
   ```

### Option C : SMTP Gmail (Développement uniquement)

```bash
supabase secrets set SMTP_HOST=smtp.gmail.com
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USERNAME=votre-email@gmail.com
supabase secrets set SMTP_PASSWORD=votre-app-password
supabase secrets set SMTP_FROM=noreply@afneus.org
```

⚠️ **Note** : Nécessite "App Password" (pas le mot de passe Gmail normal)

---

## 4. 🔧 Déploiement Edge Functions

### Prérequis

```bash
# Installer Supabase CLI
npm install -g supabase

# Login
supabase login

# Link au projet
supabase link --project-ref YOUR_PROJECT_REF
```

### Déployer la fonction send-emails

```bash
# Déployer
cd /home/mohamed/AFNEUS
supabase functions deploy send-emails

# Vérifier le déploiement
supabase functions list
```

### Tester manuellement

```bash
# Remplacer YOUR_PROJECT_REF et YOUR_ANON_KEY
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-emails \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

Réponse attendue :
```json
{
  "success": true,
  "processed": 0,
  "successful": 0,
  "failed": 0,
  "message": "No emails to process"
}
```

---

## 5. ⏰ Configuration Cron Jobs

### Créer un Cron Job dans Supabase

1. **Aller dans** Database > Cron Jobs (extension pg_cron)
2. **Activer pg_cron** si pas déjà fait
3. **Créer un nouveau job**

```sql
-- Job 1: Envoyer les emails toutes les 5 minutes
SELECT cron.schedule(
  'send-pending-emails',
  '*/5 * * * *', -- Toutes les 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-emails',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- Job 2: Nettoyer les sessions expirées chaque jour à 3h
SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 3 * * *', -- Tous les jours à 3h du matin
  $$
  SELECT cleanup_expired_sessions();
  $$
);

-- Job 3: Archiver les vieux événements de sécurité chaque semaine
SELECT cron.schedule(
  'archive-security-events',
  '0 4 * * 0', -- Tous les dimanches à 4h
  $$
  SELECT archive_old_security_events(90); -- Archiver après 90 jours
  $$
);
```

### Vérifier les Cron Jobs

```sql
-- Voir tous les jobs
SELECT * FROM cron.job;

-- Voir l'historique d'exécution
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;

-- Désactiver un job
SELECT cron.unschedule('send-pending-emails');
```

---

## 6. 🧪 Tests

### Test 1 : Créer une demande et vérifier les emails

```sql
-- 1. Créer un utilisateur test
INSERT INTO users (id, email, first_name, last_name, role, status_id)
SELECT 
  uuid_generate_v4(),
  'test@afneus.org',
  'Jean',
  'Dupont',
  'MEMBER',
  id
FROM member_statuses WHERE code = 'AUTRE'
RETURNING id;

-- 2. Créer une demande test (remplacer USER_ID et EVENT_ID)
INSERT INTO expense_claims (user_id, event_id, status, total_amount)
VALUES (
  'USER_ID_ICI',
  (SELECT id FROM events LIMIT 1),
  'SUBMITTED',
  100.00
);

-- 3. Vérifier que les emails sont en queue
SELECT * FROM email_queue 
ORDER BY created_at DESC 
LIMIT 5;

-- Devrait voir 2 emails :
-- - CLAIM_SUBMITTED pour l'utilisateur
-- - CLAIM_NEW_ADMIN pour les admins
```

### Test 2 : Tester les templates

```sql
-- Tester le rendu d'un template
SELECT * FROM render_email_template(
  'CLAIM_SUBMITTED',
  jsonb_build_object(
    'user_first_name', 'Jean',
    'claim_number', '123',
    'amount', '100.00 €',
    'event_name', 'Congrès 2024',
    'event_date', '15/12/2024',
    'submitted_date', '01/12/2024',
    'platform_url', 'https://afneus.fr/claims/123'
  )
);
```

### Test 3 : Forcer l'envoi manuel

```sql
-- Exécuter manuellement la fonction d'envoi
SELECT net.http_post(
  url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-emails',
  headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
);

-- Vérifier les résultats
SELECT * FROM email_queue WHERE status = 'sent';
SELECT * FROM notification_log ORDER BY sent_at DESC LIMIT 10;
```

### Test 4 : Google OAuth

1. Aller sur `/auth/login`
2. Cliquer "Se connecter avec Google"
3. Vérifier :
   - Redirection vers Google
   - Sélection du compte
   - Redirection vers `/auth/callback`
   - Création automatique dans `users`
   - Session créée dans `user_sessions`
   - Événement loggé dans `security_events`

---

## 7. 📊 Monitoring

### Dashboard SQL

```sql
-- Statistiques emails
SELECT 
  template_code,
  COUNT(*) AS total,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) AS sent,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending
FROM email_queue
GROUP BY template_code;

-- Sessions actives
SELECT COUNT(*) AS active_sessions
FROM active_sessions;

-- Événements de sécurité critiques
SELECT * FROM security_events
WHERE severity IN ('critical', 'alert')
ORDER BY created_at DESC
LIMIT 20;

-- Taux de succès d'envoi par jour
SELECT 
  DATE(created_at) AS date,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(CASE WHEN status = 'sent' THEN 1 END) / COUNT(*), 2) AS success_rate
FROM email_queue
WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Alertes recommandées

```sql
-- Créer une vue pour les alertes
CREATE OR REPLACE VIEW system_alerts AS
SELECT 
  'High failure rate' AS alert_type,
  'warning' AS severity,
  COUNT(*) AS count,
  CURRENT_TIMESTAMP AS detected_at
FROM email_queue
WHERE status = 'failed'
  AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
HAVING COUNT(*) > 10

UNION ALL

SELECT 
  'Suspicious login attempts',
  'critical',
  COUNT(*),
  CURRENT_TIMESTAMP
FROM security_events
WHERE event_type = 'login_failed'
  AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
HAVING COUNT(*) > 5;
```

---

## 🎯 Checklist finale

### Migrations
- [ ] Migration 007 exécutée (authentification)
- [ ] Migration 008 exécutée (emails)
- [ ] Migration 009 exécutée (OAuth avancé)
- [ ] Vérification des tables et triggers

### Google OAuth
- [ ] Projet Google Cloud créé
- [ ] OAuth credentials configurés
- [ ] Redirect URIs ajoutés
- [ ] Provider activé dans Supabase
- [ ] Test de connexion réussi

### Email
- [ ] Compte Resend créé
- [ ] Domaine vérifié (DNS)
- [ ] API Key créée
- [ ] Secrets configurés dans Supabase
- [ ] Edge Function déployée
- [ ] Test d'envoi manuel réussi

### Cron Jobs
- [ ] pg_cron activé
- [ ] Job send-emails créé (5 min)
- [ ] Job cleanup-sessions créé (daily)
- [ ] Job archive-events créé (weekly)
- [ ] Vérification de l'exécution

### Tests
- [ ] Création de demande → emails envoyés
- [ ] Validation → email de validation
- [ ] Rejet → email de rejet
- [ ] Google OAuth → compte créé
- [ ] Sessions trackées
- [ ] Événements de sécurité loggés

---

## 🆘 Troubleshooting

### Les emails ne partent pas

```sql
-- Vérifier la queue
SELECT * FROM email_queue WHERE status = 'pending';

-- Vérifier les erreurs
SELECT id, to_email, last_error, attempts 
FROM email_queue 
WHERE status = 'failed' 
ORDER BY created_at DESC;

-- Réinitialiser un email échoué
UPDATE email_queue 
SET status = 'pending', attempts = 0 
WHERE id = 'EMAIL_ID';
```

### Google OAuth ne fonctionne pas

1. Vérifier les redirect URIs dans Google Console
2. Vérifier que le provider est activé dans Supabase
3. Vérifier les credentials (Client ID/Secret)
4. Regarder la console navigateur pour les erreurs

### Cron job ne s'exécute pas

```sql
-- Vérifier les jobs
SELECT * FROM cron.job;

-- Vérifier l'historique
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'send-pending-emails')
ORDER BY start_time DESC;

-- Exécuter manuellement
SELECT cron.job_run(jobid) 
FROM cron.job 
WHERE jobname = 'send-pending-emails';
```

---

## 📞 Support

- **Email** : contact@afneus.org
- **Documentation Supabase** : https://supabase.com/docs
- **Documentation Resend** : https://resend.com/docs
- **Google OAuth** : https://developers.google.com/identity/protocols/oauth2

---

**Version** : 1.0.0  
**Dernière mise à jour** : Octobre 2024  
**Auteur** : Équipe Technique AFNEUS
