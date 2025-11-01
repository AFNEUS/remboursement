# Configuration Variables d'Environnement - AFNEUS Platform

## 📋 Variables Requises pour Vercel

Copiez ces variables dans **Vercel Dashboard → Settings → Environment Variables**

### 🔐 Supabase (REQUIS)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://revtmvfxvmuwycknesdc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldnRtdmZ4dm11d3lja25lc2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NjIwNjgsImV4cCI6MjA3NzIzODA2OH0.Z0WYRUh0QLOixMgfctteCQAvqR-CGXxlZRqCeyw_97E
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldnRtdmZ4dm11d3lja25lc2RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY2MjA2OCwiZXhwIjoyMDc3MjM4MDY4fQ.VrKUmffzLMLxW6r7zbVVv_S71UfOpy3KL_Jc2NTIySE
```

### 🚄 API SNCF (GRATUIT - À OBTENIR)
**Obtenir un token gratuit :** https://numerique.sncf.com/startup/api/token-developpeur/
- Créer un compte développeur
- Copier votre token
- 150 000 requêtes/mois gratuites

```bash
SNCF_API_TOKEN=VOTRE_TOKEN_SNCF_ICI
```

### 📧 Resend Email (GRATUIT jusqu'à 3000 emails/mois)
**Obtenir une clé :** https://resend.com/signup
- Créer compte
- Vérifier domaine afneus.org
- Créer API Key

```bash
RESEND_API_KEY=re_VOTRE_CLE_RESEND
```

### 🔑 Google OAuth (À CONFIGURER)
**Obtenir via Google Cloud Console :** https://console.cloud.google.com

```bash
GOOGLE_CLIENT_ID=VOTRE_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=VOTRE_CLIENT_SECRET
```

### 🏦 SEPA (CRITIQUE - METTRE À JOUR)
**⚠️ REMPLACER PAR LE VRAI IBAN AFNEUS**

```bash
CREDITOR_IBAN=FR76XXXXXXXXXXXXXXXXXXXXXXX
CREDITOR_BIC=SOGEFRPP
CREDITOR_NAME=AFNEUS
```

### 🌐 App Configuration
```bash
NEXT_PUBLIC_APP_URL=https://afneus.org
NODE_ENV=production
```

---

## 🔧 Comment configurer dans Vercel ?

### Méthode 1 : Interface Web (Recommandée)

1. **Aller sur Vercel Dashboard**
   ```
   https://vercel.com/AFNEUS/remboursement/settings/environment-variables
   ```

2. **Ajouter chaque variable**
   - Cliquer "Add New"
   - Key: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: Copier-coller depuis .env.local
   - Environments: Production, Preview, Development
   - Cliquer "Save"

3. **Répéter pour toutes les variables**

4. **Redéployer**
   - Deployments → Latest deployment → Redeploy

### Méthode 2 : CLI Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Login
vercel login

# Ajouter les variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SNCF_API_TOKEN production
vercel env add RESEND_API_KEY production
vercel env add CREDITOR_IBAN production
vercel env add CREDITOR_BIC production

# Redéployer
vercel --prod
```

---

## 📋 Checklist Configuration

### Variables Critiques (BLOCKER si manquantes)
- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] CREDITOR_IBAN (⚠️ VRAI IBAN AFNEUS)

### Variables Importantes (Features limitées si manquantes)
- [ ] SNCF_API_TOKEN (barèmes auto désactivés)
- [ ] RESEND_API_KEY (emails désactivés)
- [ ] GOOGLE_CLIENT_ID (OAuth Google désactivé)
- [ ] GOOGLE_CLIENT_SECRET

### Variables Optionnelles
- [ ] NEXT_PUBLIC_APP_URL
- [ ] NODE_ENV

---

## 🚀 Ordre de Configuration Recommandé

### Jour 1 : Essentiels
1. ✅ Variables Supabase
2. ✅ IBAN AFNEUS
3. ✅ Déployer sur Vercel
4. ✅ Tester connexion Supabase

### Jour 2 : Fonctionnalités
5. ⏳ Token SNCF API
6. ⏳ Clé Resend
7. ⏳ OAuth Google
8. ⏳ Tester workflow complet

---

## 🔐 Sécurité

### ✅ À FAIRE :
- Utiliser des variables d'environnement (JAMAIS hardcodées)
- Préfixer les variables publiques par `NEXT_PUBLIC_`
- Garder SERVICE_ROLE_KEY strictement côté serveur
- Rotate les clés tous les 6 mois

### ❌ NE JAMAIS :
- Commiter les vraies clés dans Git
- Partager SERVICE_ROLE_KEY publiquement
- Utiliser les clés de développement en production

---

## 🆘 Aide / Debug

### Vérifier si les variables sont chargées
```typescript
// Dans une API route (server-side)
console.log('SNCF Token:', process.env.SNCF_API_TOKEN ? 'Configured ✓' : 'Missing ✗');
console.log('Resend Key:', process.env.RESEND_API_KEY ? 'Configured ✓' : 'Missing ✗');
```

### Erreur "Variable not found"
1. Vérifier l'orthographe exacte
2. Vérifier que la variable est bien dans "Production"
3. Redéployer après ajout de variables
4. Attendre 1-2 min pour propagation

### Variable publique (NEXT_PUBLIC_) non accessible
- Les variables `NEXT_PUBLIC_*` sont injectées au build
- Modifier une variable publique nécessite un rebuild complet
- Dans Vercel : Deployments → Redeploy

---

## 📞 Contacts pour Obtenir les Clés

### SNCF API
- Site : https://numerique.sncf.com/startup/api/token-developpeur/
- Support : Formulaire sur le site
- Gratuit : 150 000 requêtes/mois

### Resend
- Site : https://resend.com
- Plan gratuit : 3000 emails/mois
- Support : support@resend.com

### Google OAuth
- Site : https://console.cloud.google.com
- Gratuit : Illimité
- Doc : https://developers.google.com/identity/protocols/oauth2

---

**Dernière mise à jour :** 1er novembre 2025
**Version :** 1.0.0
