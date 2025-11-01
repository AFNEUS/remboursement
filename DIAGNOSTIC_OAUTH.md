# 🔍 DIAGNOSTIC OAUTH GOOGLE - ÉTAPE PAR ÉTAPE

## 📋 CHECKLIST OBLIGATOIRE

### 1️⃣ Google Cloud Console
**URL:** https://console.cloud.google.com/apis/credentials

✅ **À VÉRIFIER :**
- [ ] Projet "AFNEUS Remboursement" créé
- [ ] OAuth 2.0 Client ID créé
- [ ] **Authorized redirect URIs contient UNIQUEMENT :**
  ```
  https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/callback
  ```
- [ ] **PAS D'AUTRE URL** (pas de localhost, rien d'autre)

---

### 2️⃣ Supabase Dashboard - Google Provider
**URL:** https://supabase.com/dashboard/project/revtmvfxvmuwycknesdc/auth/providers

✅ **À VÉRIFIER :**
- [ ] Clique sur "Google"
- [ ] "Enable Sign in with Google" est **COCHÉ**
- [ ] Client ID est rempli : `728966191325-p84jtgcn5vhriefzhbh0jgketv6qnrv4.apps.googleusercontent.com`
- [ ] Client Secret est rempli : `GOCSPX-...`
- [ ] Clique "Save" si modifié

---

### 3️⃣ Supabase Dashboard - URL Configuration ⚠️ CRUCIAL
**URL:** https://supabase.com/dashboard/project/revtmvfxvmuwycknesdc/auth/url-configuration

✅ **À VÉRIFIER :**

**Site URL:**
```
http://localhost:3000
```

**Redirect URLs - DOIT CONTENIR CES 2 LIGNES :**
```
http://localhost:3000/**
http://localhost:3000/auth/callback
```

**⚠️ SI TU N'AS PAS AJOUTÉ `http://localhost:3000/**`, C'EST LA RAISON POUR LAQUELLE ÇA NE MARCHE PAS !**

---

## 🧪 TEST ÉTAPE PAR ÉTAPE

### Test 1 : Vérifier les variables d'environnement

```bash
cat .env.local | grep SUPABASE
```

**Attendu :**
```
NEXT_PUBLIC_SUPABASE_URL=https://revtmvfxvmuwycknesdc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### Test 2 : Ouvrir la page de login

1. Va sur http://localhost:3000
2. Clique "Se connecter" (bouton bleu en haut à droite)
3. **Tu arrives sur la page de login ?** ✅ Oui / ❌ Non

---

### Test 3 : Cliquer sur "Continuer avec Google"

1. Sur la page de login, clique "Continuer avec Google"
2. **Ouvre la console navigateur (F12) → onglet Network**
3. **Qu'est-ce qui se passe ?**

**Scénario A :** Tu es redirigé vers Google OAuth
- ✅ **BON** → Continue au Test 4

**Scénario B :** Rien ne se passe / Erreur JavaScript
- ❌ **Copie l'erreur de la console et envoie-la moi**

**Scénario C :** Tu es redirigé vers une page d'erreur Supabase
- ❌ **Copie l'URL complète et l'erreur**

---

### Test 4 : Authentification Google

1. Choisis ton compte Google (@afneus.org)
2. **Qu'est-ce qui se passe ?**

**Scénario A :** Google te redirige vers une URL Supabase
- ✅ **BON** → Regarde l'URL, elle doit ressembler à :
  ```
  https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/callback?code=XXXXX
  ```
- Continue au Test 5

**Scénario B :** Erreur Google "redirect_uri_mismatch"
- ❌ **Tu n'as pas la bonne redirect URI dans Google Cloud Console**
- Retourne au point 1️⃣ ci-dessus

---

### Test 5 : Redirection Supabase vers ton app

1. Après l'étape 4, Supabase doit te rediriger vers ton app
2. **Regarde le terminal où tourne `npm run dev`**
3. **Cherche ces lignes :**

```
🔄 Callback OAuth reçu
📍 URL complète: http://localhost:3000/auth/callback?code=XXXXXXXXX
🔑 Code présent: true
```

**Scénario A :** Tu vois `🔑 Code présent: true`
- ✅ **PARFAIT !** L'OAuth fonctionne, continue au Test 6

**Scénario B :** Tu vois `🔑 Code présent: false`
- ❌ **Supabase ne redirige pas correctement**
- **CAUSE :** Tu n'as pas `http://localhost:3000/**` dans Redirect URLs
- Retourne au point 3️⃣ ci-dessus

**Scénario C :** Tu ne vois rien dans le terminal
- ❌ **Le callback n'est pas appelé**
- Regarde l'URL dans ton navigateur, c'est quoi ?

---

### Test 6 : Création de session

**Dans le terminal, tu dois voir :**
```
✅ Session créée avec succès
👤 Email: mohameddhia.ounally@afneus.org
🆔 User ID: XXXXXX
⏳ Attente création profil (2s)...
🔍 Récupération du profil utilisateur...
```

**Scénario A :** Tout se passe bien, tu vois ces lignes
- ✅ Continue au Test 7

**Scénario B :** Erreur "Échec authentification"
- ❌ **Copie l'erreur complète du terminal**

---

### Test 7 : Redirection finale

**Tu dois être redirigé vers /dashboard et voir :**
- Navbar bleue en haut
- Ton nom dans la navbar
- Badge "👑 Admin" (si tu es Mohamed)

**Ça marche ?** ✅ Oui / ❌ Non

---

## 🐛 SI ÇA NE MARCHE TOUJOURS PAS

### Méthode 1 : Teste l'URL OAuth directement

Copie cette URL dans ton navigateur (remplace XXX si besoin) :

```
https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/authorize?provider=google&redirect_to=http://localhost:3000/auth/callback
```

**Qu'est-ce qui se passe ?**

---

### Méthode 2 : Vérifie les cookies

1. Ouvre la console navigateur (F12)
2. Onglet "Application" → "Cookies" → "http://localhost:3000"
3. **Tu vois des cookies Supabase ?**
   - `sb-revtmvfxvmuwycknesdc-auth-token`
   - `sb-revtmvfxvmuwycknesdc-auth-token.0`

---

### Méthode 3 : Regarde les logs Supabase

1. Va sur https://supabase.com/dashboard/project/revtmvfxvmuwycknesdc/logs/explorer
2. Regarde les logs Auth
3. **Tu vois des tentatives de connexion Google ?**

---

## 📸 CAPTURES D'ÉCRAN UTILES

Si ça ne marche toujours pas, envoie-moi des captures de :

1. **Google Cloud Console** → Authorized redirect URIs
2. **Supabase Dashboard** → Authentication → URL Configuration
3. **Supabase Dashboard** → Authentication → Providers → Google
4. **Terminal npm run dev** après avoir cliqué "Continuer avec Google"
5. **Console navigateur (F12)** → onglet Console (les erreurs)

---

## ✅ SOLUTIONS RAPIDES

### Problème : "Code présent: false"
**Solution :** Ajoute `http://localhost:3000/**` dans Supabase Redirect URLs

### Problème : "redirect_uri_mismatch"
**Solution :** Vérifie Google Cloud Console, doit avoir UNIQUEMENT l'URL Supabase

### Problème : Rien ne se passe
**Solution :** Vérifie que Google Provider est activé dans Supabase

### Problème : "Session non créée"
**Solution :** Vérifie Client ID et Secret dans Supabase Dashboard

---

**Fais ces tests et dis-moi où ça bloque exactement !** 🔍
