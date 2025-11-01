# 🔧 FIX: Erreur "Code manquant" OAuth Google

## 🔍 Diagnostic

L'URL de redirection contient :
```
#access_token=... (HASH FRAGMENT)
```

Au lieu de :
```
?code=... (QUERY PARAMETER)
```

**Cause** : Google OAuth configuré en mode **Implicit Flow** (deprecié) au lieu de **Authorization Code Flow**.

## ✅ Solution

### 1️⃣ Vérifier la configuration Supabase

1. **Ouvre Supabase Dashboard** → Authentication → Providers
2. Clique sur **Google**
3. Vérifie que ces paramètres sont corrects :

```
✅ Enabled: ON

Client ID (OAuth 2.0):
[ton client ID Google]

Client Secret (OAuth 2.0):
[ton secret Google]

Authorized redirect URLs:
https://revtmvfxvmuwycknesdс.supabase.co/auth/v1/callback
```

4. **IMPORTANT** : Clique sur "Save"

### 2️⃣ Vérifier la configuration Google Cloud Console

1. Va sur https://console.cloud.google.com/apis/credentials
2. Clique sur ton OAuth 2.0 Client ID
3. **Authorized redirect URIs** doit contenir :

```
https://revtmvfxvmuwycknesdс.supabase.co/auth/v1/callback
```

**⚠️ PAS :**
```
https://remboursement.afneus.org/auth/callback
```

4. Clique "Save"

### 3️⃣ Nettoyer les anciennes sessions

```bash
# Ouvre la console de ton navigateur (F12)
# Colle cette commande :
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### 4️⃣ Tester à nouveau

1. Va sur https://remboursement.afneus.org
2. Clique "Se connecter avec Google"
3. Autorise l'accès
4. Tu dois être redirigé vers `/dashboard` ✅

## 🐛 Si ça marche toujours pas

### Option A : Forcer le flow Authorization Code

Modifie la page de login pour forcer le bon flow :

**Fichier :** `app/auth/login/page.tsx`

Cherche la ligne avec `signInWithOAuth` et remplace par :

```typescript
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
    // Force Authorization Code Flow
    flowType: 'pkce',
  },
});
```

### Option B : Vérifier la version Supabase

```bash
# Dans ton terminal
npm list @supabase/supabase-js
```

Si < 2.38.0, update :

```bash
npm install @supabase/supabase-js@latest
npm install @supabase/auth-helpers-nextjs@latest
```

## 📝 Checklist

```
[ ] Vérifier config Supabase (redirect URL correcte)
[ ] Vérifier config Google Cloud (redirect URL correcte)
[ ] Nettoyer cache/storage navigateur
[ ] Tester connexion OAuth
[ ] Vérifier dans Supabase → Authentication → Users
[ ] Vérifier dans Supabase → Table Editor → users (role = ADMIN)
```

## 🆘 Debug avancé

Si l'erreur persiste, vérifie les logs Supabase :

1. Supabase Dashboard → Logs → Auth Logs
2. Cherche les erreurs récentes
3. Partage le message d'erreur exact

### Logs attendus (succès) :

```
✅ OAuth callback received
✅ Code exchanged for session
✅ User created in auth.users
✅ Trigger executed
✅ User created in public.users with role=ADMIN
```

### Logs d'erreur possibles :

```
❌ Invalid redirect_uri
❌ Code expired
❌ Invalid client credentials
```
