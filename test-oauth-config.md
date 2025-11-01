# 🔍 Diagnostic OAuth - AFNEUS

## ❌ Problème actuel
L'URL de callback reçue est : `http://localhost:3000/auth/callback` (SANS paramètres)
Elle devrait être : `http://localhost:3000/auth/callback?code=XXX`

Cela signifie que **Supabase ne redirige pas correctement**.

---

## ✅ Solution : Configuration Supabase Dashboard

### 1. Va sur Supabase Dashboard
URL: https://supabase.com/dashboard/project/revtmvfxvmuwycknesdc/auth/url-configuration

### 2. Vérifie Authentication → URL Configuration

**Site URL:**
```
http://localhost:3000
```

**Redirect URLs (IMPORTANT - ajoute TOUTES ces lignes):**
```
http://localhost:3000/**
http://localhost:3000/auth/callback
```

⚠️ **Le `/**` est CRUCIAL** - il permet à Supabase de rediriger vers n'importe quelle page

### 3. Vérifie Authentication → Providers → Google

**Doit être configuré comme ça:**
- ✅ **Enable Sign in with Google** : COCHÉ
- 📧 **Client ID (for OAuth)** : `728966191325-p84jtgcn5vhriefzhbh0jgketv6qnrv4.apps.googleusercontent.com`
- 🔑 **Client Secret (for OAuth)** : GOCSPX-...
- 🔄 **Authorized Client IDs** : VIDE (laisse vide)

**Redirect URL (affiché par Supabase, à copier dans Google Cloud):**
```
https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/callback
```

---

## 🔧 Google Cloud Console

URL: https://console.cloud.google.com/apis/credentials

### Dans ton OAuth 2.0 Client ID

**Authorized redirect URIs - EXACTEMENT CECI:**
```
https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/callback
```

**❌ NE METS PAS:**
- ~~http://localhost:3000~~
- ~~http://localhost:3000/auth/callback~~
- Aucune autre URL

---

## 🧪 Test manuel

### Option 1 : Test direct Supabase OAuth URL

Ouvre cette URL dans ton navigateur (remplace XXX par ton vrai Client ID):

```
https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/authorize?provider=google&redirect_to=http://localhost:3000/auth/callback
```

Tu devrais :
1. Être redirigé vers Google OAuth
2. T'authentifier
3. Revenir sur `http://localhost:3000/auth/callback?code=XXXXXXXXX`

---

## 🐛 Si ça ne marche toujours pas

### Vérifie les logs serveur

Tu devrais voir dans le terminal:
```
🔄 Callback OAuth reçu
📍 URL complète: http://localhost:3000/auth/callback?code=XXXXXXXXX
🔑 Code présent: true
```

### Vérifie la console navigateur (F12)

Regarde l'onglet Network:
1. Clique sur "Continuer avec Google"
2. Tu devrais voir :
   - Redirect vers `supabase.co/auth/v1/authorize`
   - Redirect vers Google OAuth
   - Redirect vers `supabase.co/auth/v1/callback`
   - **Redirect final vers `localhost:3000/auth/callback?code=XXX`**

Si le dernier redirect n'a pas de `?code=XXX`, c'est que Supabase ne redirige pas bien.

---

## 📝 Checklist complète

### Supabase Dashboard
- [ ] Authentication → URL Configuration → Site URL = `http://localhost:3000`
- [ ] Authentication → URL Configuration → Redirect URLs contient `http://localhost:3000/**`
- [ ] Authentication → URL Configuration → Redirect URLs contient `http://localhost:3000/auth/callback`
- [ ] Authentication → Providers → Google → Enabled = ✅
- [ ] Authentication → Providers → Google → Client ID rempli
- [ ] Authentication → Providers → Google → Client Secret rempli

### Google Cloud Console
- [ ] APIs & Services → Credentials → OAuth 2.0 Client
- [ ] Authorized redirect URIs contient UNIQUEMENT : `https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/callback`
- [ ] Pas d'autres redirect URIs

### Code
- [ ] Serveur Next.js redémarré (`npm run dev`)
- [ ] `.env.local` contient les bonnes variables

---

## 🎯 Action immédiate

1. **Va sur Supabase Dashboard** → Authentication → URL Configuration
2. **Dans "Redirect URLs", ajoute :**
   ```
   http://localhost:3000/**
   ```
3. **Clique Save**
4. **Reteste la connexion Google**

---

## 💡 Pourquoi `/**` est important

Supabase utilise cette wildcard pour savoir où rediriger après OAuth.
Sans ça, Supabase ne sait pas où envoyer l'utilisateur après validation Google.

Le flow complet:
```
User → Next.js → Supabase → Google → Supabase → Next.js callback
                                                    ↑
                                        Needs `/**` permission
```
