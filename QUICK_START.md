# ⚡ Quick Start Guide - AFNEUS Platform

## 🚀 Démarrage Rapide (15 minutes)

### Prérequis
- ✅ Compte Supabase créé
- ✅ Projet Supabase créé
- ✅ Node.js installé (v18+)
- ✅ Compte Google Cloud (pour OAuth)
- ✅ Compte Resend.com (pour emails)

---

## 📋 Checklist Installation

### Étape 1 : Base de données (5 min)

```bash
# Dans Supabase Dashboard > SQL Editor
# Exécuter dans l'ordre :

1. ✅ 003_optimized_structure.sql
2. ✅ 005_dashboard_and_stats.sql
3. ✅ 006_init_bn_members.sql
4. ✅ 007_authentication_system.sql
5. ✅ 008_email_notifications_system.sql
6. ✅ 009_enhanced_authentication_oauth.sql
```

**Vérification :**
```sql
-- Devrait retourner 7
SELECT COUNT(*) FROM email_templates;
```

---

### Étape 2 : Google OAuth (3 min)

1. **Google Cloud Console** → https://console.cloud.google.com
2. **Créer projet** "AFNEUS Platform"
3. **APIs & Services > Credentials > Create OAuth Client**
   - Type: Web application
   - Redirect URI: `https://YOUR_REF.supabase.co/auth/v1/callback`
4. **Copier** Client ID + Secret
5. **Supabase** → Authentication → Providers → Google
   - Coller Client ID + Secret
   - Save

**Test :**
```
http://localhost:3000/auth/login → Clic "Google" → Devrait rediriger
```

---

### Étape 3 : Email Resend (3 min)

1. **Créer compte** → https://resend.com (GRATUIT)
2. **API Keys** → Create API Key
3. **Copier** la clé `re_xxxxx`
4. **Terminal** :
```bash
supabase login
supabase link --project-ref YOUR_REF
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set SMTP_FROM=noreply@afneus.org
supabase secrets set SMTP_FROM_NAME="AFNEUS"
```

---

### Étape 4 : Edge Function (2 min)

```bash
cd /home/mohamed/AFNEUS
supabase functions deploy send-emails
```

**Test :**
```bash
curl -X POST \
  https://YOUR_REF.supabase.co/functions/v1/send-emails \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

### Étape 5 : Cron Jobs (2 min)

```sql
-- Dans Supabase SQL Editor
SELECT cron.schedule(
  'send-pending-emails',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_REF.supabase.co/functions/v1/send-emails',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb
  );
  $$
);
```

---

## ✅ Tests Rapides

### Test 1 : Connexion Google
```
1. http://localhost:3000/auth/login
2. Clic "Se connecter avec Google"
3. ✅ Devrait créer compte automatiquement
```

### Test 2 : Email automatique
```sql
-- Créer demande test
INSERT INTO expense_claims (user_id, event_id, status, total_amount)
VALUES (
  (SELECT id FROM users LIMIT 1),
  (SELECT id FROM events LIMIT 1),
  'SUBMITTED',
  100.00
);

-- Vérifier queue
SELECT * FROM email_queue ORDER BY created_at DESC LIMIT 5;
-- ✅ Devrait voir 2 emails (user + admins)
```

### Test 3 : Envoi manuel
```bash
curl -X POST \
  https://YOUR_REF.supabase.co/functions/v1/send-emails \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# ✅ Devrait retourner {"success": true, "processed": 2}
```

---

## 🎯 Résultat Final

Après ces étapes, vous devriez avoir :

- ✅ 17 tables créées avec RLS
- ✅ 15+ fonctions SQL
- ✅ 10+ triggers automatiques
- ✅ 14+ vues statistiques
- ✅ 5 templates email HTML
- ✅ Google OAuth fonctionnel
- ✅ Emails automatiques opérationnels
- ✅ Dashboard statistiques
- ✅ Validation demandes
- ✅ Profil utilisateur

---

## 📊 Workflow Complet

```
1. Utilisateur → Se connecte via Google
2. Système → Crée compte automatiquement
3. Utilisateur → Créée demande remboursement
4. Système → Envoie email confirmation (utilisateur)
5. Système → Envoie email alerte (admins)
6. Validateur → Valide/Rejette demande
7. Système → Envoie email résultat (utilisateur)
8. Trésorier → Génère SEPA et paie
9. Système → Envoie email confirmation paiement
10. Dashboard → Mise à jour stats temps réel
```

---

## 🆘 Troubleshooting Rapide

### Emails ne partent pas ?
```sql
-- Vérifier queue
SELECT status, COUNT(*) FROM email_queue GROUP BY status;

-- Réinitialiser échoués
UPDATE email_queue SET status = 'pending', attempts = 0 WHERE status = 'failed';
```

### Google OAuth erreur ?
1. Vérifier redirect URI correspond exactement
2. Vérifier provider activé dans Supabase
3. Vérifier Client ID/Secret corrects

### Fonction send-emails erreur ?
```bash
# Vérifier logs
supabase functions logs send-emails

# Redéployer
supabase functions deploy send-emails
```

---

## 📚 Documentation Complète

- **Installation détaillée** : `GUIDE_CONFIGURATION_AUTH_EMAILS.md`
- **Architecture complète** : `README_COMPLET.md`
- **Scripts SQL** : `scripts_sql_utiles.sh`

---

## 🎉 Félicitations !

Votre plateforme AFNEUS est maintenant **100% opérationnelle** avec :
- 🔐 Authentification moderne
- 📧 Notifications intelligentes
- 🛡️ Sécurité avancée
- 📊 Analytics temps réel
- 💰 Gestion remboursements complète

**Prochaines étapes recommandées :**
1. Créer page Treasurer avec export SEPA
2. Tester workflow complet end-to-end
3. Former les membres BN
4. Déployer en production

---

**Support** : contact@afneus.org  
**Version** : 1.0.0  
**Date** : Octobre 2024

🚀 **Fait avec ❤️ pour l'AFNEUS**
