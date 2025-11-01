# 🚀 Déploiement Production - Vercel + Supabase

## 📋 PRÉREQUIS

1. Compte GitHub (déjà fait ✅)
2. Compte Vercel (gratuit) → https://vercel.com
3. Domaine personnalisé (optionnel, Vercel donne un sous-domaine gratuit)

---

## 🔧 ÉTAPE 1 : Préparer le code pour la production

### 1.1 Créer .env.production

```bash
# Dans le terminal
cat > .env.production << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://revtmvfxvmuwycknesdc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldnRtdmZ4dm11d3lja25lc2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NjIwNjgsImV4cCI6MjA3NzIzODA2OH0.Z0WYRUh0QLOixMgfctteCQAvqR-CGXxlZRqCeyw_97E
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldnRtdmZ4dm11d3lja25lc2RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY2MjA2OCwiZXhwIjoyMDc3MjM4MDY4fQ.VrKUmffzLMLxW6r7zbVVv_S71UfOpy3KL_Jc2NTIySE

# Google OAuth - À configurer après déploiement
GOOGLE_CLIENT_ID=728966191325-p84jtgcn5vhriefzhbh0jgketv6qnrv4.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
EOF
```

### 1.2 Vérifier .gitignore

```bash
cat .gitignore | grep -E "\.env|node_modules"
```

**Si .env n'est pas ignoré, ajoute-le :**
```bash
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore
```

### 1.3 Commit et push

```bash
git add .
git commit -m "🚀 Prêt pour déploiement Vercel"
git push origin main
```

---

## 🌐 ÉTAPE 2 : Déployer sur Vercel

### 2.1 Créer compte Vercel

1. Va sur https://vercel.com/signup
2. **"Continue with GitHub"** (le plus simple)
3. Autorise Vercel à accéder à tes repos

### 2.2 Importer le projet

1. Clique **"Add New..." → "Project"**
2. Trouve **"AFNEUS/remboursement"**
3. Clique **"Import"**

### 2.3 Configurer le projet

**Framework Preset:** Next.js (détecté automatiquement)

**Build Command:**
```bash
npm run build
```

**Output Directory:** `.next` (par défaut)

**Install Command:**
```bash
npm install
```

### 2.4 Ajouter les variables d'environnement

**IMPORTANT : Ne clique pas encore sur "Deploy" !**

**Clique sur "Environment Variables"**, puis ajoute :

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://revtmvfxvmuwycknesdc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (la clé complète) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (la clé complète) |

**Pour chaque variable :**
- Environment: **Production, Preview, Development** (toutes cochées)

### 2.5 Déployer

**Clique "Deploy"** et attends 2-3 minutes.

**Tu obtiendras une URL comme :**
```
https://remboursement-xyz.vercel.app
```

---

## 🔐 ÉTAPE 3 : Configurer Google OAuth pour production

### 3.1 Ajouter l'URL Vercel dans Google Cloud Console

**URL:** https://console.cloud.google.com/apis/credentials

1. Ouvre ton **OAuth 2.0 Client ID**
2. **Authorized redirect URIs**, ajoute :
   ```
   https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/callback
   ```
   (C'est la même qu'avant, juste une vérification)

3. **Clique "Save"**

### 3.2 Configurer Supabase pour Vercel

**URL:** https://supabase.com/dashboard/project/revtmvfxvmuwycknesdc/auth/url-configuration

**Site URL:**
```
https://remboursement-xyz.vercel.app
```
(Remplace par ton URL Vercel)

**Redirect URLs - Ajoute toutes ces lignes :**
```
https://remboursement-xyz.vercel.app/auth/callback
https://remboursement-xyz.vercel.app/**
https://remboursement-xyz.vercel.app/*
```

**Clique "Save"**

---

## 🧪 ÉTAPE 4 : Tester en production

1. **Ouvre ton URL Vercel** : `https://remboursement-xyz.vercel.app`
2. **Clique "Se connecter"**
3. **Clique "Continuer avec Google"**
4. **Authentifie-toi**
5. **🎉 Tu devrais être redirigé vers /dashboard !**

---

## 🎯 ÉTAPE 5 : Configuration domaine personnalisé (optionnel)

Si tu veux un domaine comme `remboursement.afneus.org` :

### 5.1 Dans Vercel

1. **Settings** → **Domains**
2. **Add Domain** : `remboursement.afneus.org`
3. **Vercel te donnera un enregistrement DNS à ajouter**

### 5.2 Dans ton DNS (OVH/Cloudflare)

**Type:** CNAME  
**Name:** remboursement  
**Value:** cname.vercel-dns.com  
**TTL:** Auto

### 5.3 Mettre à jour Supabase

**Site URL:**
```
https://remboursement.afneus.org
```

**Redirect URLs:**
```
https://remboursement.afneus.org/auth/callback
https://remboursement.afneus.org/**
```

---

## 🔒 ÉTAPE 6 : Sécurité production

### 6.1 Activer les protections Vercel

**Vercel Dashboard → Settings → Security**

- ✅ **Enable Vercel Protection**
- ✅ **Enable DDoS Protection**
- ✅ **Enable Trusted IPs** (optionnel)

### 6.2 Configurer les headers de sécurité

**Créer/modifier `vercel.json` :**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ]
}
```

### 6.3 Activer HTTPS strict (Supabase)

**Supabase Dashboard → Settings → API**

- ✅ **Enforce SSL for database connections**

---

## 📊 ÉTAPE 7 : Monitoring

### 7.1 Activer les analytics Vercel

**Vercel Dashboard → Analytics** (gratuit)

### 7.2 Logs en temps réel

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Voir les logs en direct
vercel logs --follow
```

---

## 🚨 DÉPANNAGE

### Problème : Build échoue sur Vercel

**Solution :** Vérifie les logs de build, souvent c'est un `npm install` qui échoue.

```bash
# Localement, teste le build
npm run build
```

### Problème : OAuth ne fonctionne pas

**Vérifie :**
1. Google Cloud Console → Redirect URIs contient l'URL Supabase
2. Supabase → URL Configuration contient les URLs Vercel
3. Variables d'environnement Vercel sont bien configurées

### Problème : Database connection error

**Solution :** Vérifie que `SUPABASE_SERVICE_ROLE_KEY` est bien dans les env vars Vercel.

---

## ✅ CHECKLIST FINALE

**Avant de considérer le déploiement terminé :**

- [ ] Site accessible via URL Vercel
- [ ] Google OAuth fonctionne
- [ ] Dashboard accessible après login
- [ ] Profil utilisateur se charge
- [ ] Navbar affiche nom + rôle
- [ ] Pages Claims, Dashboard, Validator accessibles
- [ ] Logs Vercel propres (pas d'erreurs)
- [ ] Migration Supabase exécutée
- [ ] Headers de sécurité configurés
- [ ] Analytics activé

---

## 🎉 PROCHAINES ÉTAPES

Après déploiement réussi :

1. ✅ **Exécuter migration 000_master_init.sql** dans Supabase SQL Editor
2. ✅ **Configurer Resend** pour les emails
3. ✅ **Déployer Edge Functions** Supabase
4. ✅ **Configurer Cron Jobs**
5. ✅ **Tester workflow complet**

---

**Date:** 1er novembre 2025  
**Status:** Prêt pour déploiement Vercel
