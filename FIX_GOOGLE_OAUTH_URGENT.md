# 🚨 ACTION IMMÉDIATE : Corriger Google OAuth

## ⚠️ Problème actuel

Tu reçois l'access_token dans le **hash fragment** (`#access_token=...`) au lieu du **code** dans les query params (`?code=...`).

**Cause** : Mauvaise configuration de l'URL de redirection dans Google Cloud Console.

## ✅ Solution en 3 étapes

### Étape 1 : Google Cloud Console

1. **Va sur** : https://console.cloud.google.com/apis/credentials

2. **Clique sur ton OAuth 2.0 Client ID** (pour l'application Web)

3. **Dans "Authorized redirect URIs"**, tu dois avoir **EXACTEMENT** :

```
https://revtmvfxvmuwycknesdс.supabase.co/auth/v1/callback
```

**⚠️ PAS :**
- ❌ `https://remboursement.afneus.org/auth/callback`
- ❌ `https://revtmvfxvmuwycknesdс.supabase.co/auth/callback` (sans `/v1`)
- ❌ Autre URL

4. **Supprime toutes les autres** redirect URIs liées à ce projet

5. **Clique "SAVE"**

### Étape 2 : Vérifier Supabase

1. **Va sur** : https://supabase.com/dashboard

2. **Sélectionne ton projet** AFNEUS

3. **Authentication** → **URL Configuration**

4. **Vérifie** :
   ```
   Site URL: https://remboursement.afneus.org
   
   Redirect URLs (optionnel):
   https://remboursement.afneus.org/**
   ```

5. **Authentication** → **Providers** → **Google**

6. **Vérifie que le Callback URL affiché est** :
   ```
   https://revtmvfxvmuwycknesdс.supabase.co/auth/v1/callback
   ```

### Étape 3 : Tester

1. **Ferme tous les onglets** de ton app

2. **Vide le cache** :
   - Chrome : Ctrl+Shift+Delete → "Cookies et autres données de sites" → "Effacer les données"
   - Ou mode navigation privée

3. **Va sur** : https://remboursement.afneus.org

4. **Clique "Se connecter avec Google"**

5. **Tu dois être redirigé comme ça** :

```
1. remboursement.afneus.org/auth/login
   ↓
2. accounts.google.com (autorisation)
   ↓
3. revtmvfxvmuwycknesdс.supabase.co/auth/v1/callback?code=...
   ↓
4. remboursement.afneus.org/auth/callback?code=...
   ↓
5. remboursement.afneus.org/dashboard ✅
```

## 🔍 Debug : Si ça marche toujours pas

### Vérifier l'URL Supabase exacte

Ton URL Supabase est : `https://revtmvfxvmuwycknesdс.supabase.co`

**Vérifie dans Supabase Dashboard** → **Settings** → **API** :
- Project URL doit être : `https://revtmvfxvmuwycknesdс.supabase.co`

**Alors la redirect URI Google doit être** :
```
https://revtmvfxvmuwycknesdс.supabase.co/auth/v1/callback
```

### Logs Supabase

1. **Supabase Dashboard** → **Logs** → **Auth Logs**
2. Cherche les logs de tentative de connexion
3. Regarde s'il y a une erreur genre :
   - `redirect_uri_mismatch`
   - `invalid_request`

### Logs Vercel

1. **Vercel Dashboard** → **Deployments** → **Dernier déploiement** → **Functions**
2. Clique sur `/auth/callback`
3. Regarde les logs en temps réel

## 📸 Screenshots pour vérifier

### Google Cloud Console - CORRECT ✅
```
Authorized redirect URIs:
https://revtmvfxvmuwycknesdс.supabase.co/auth/v1/callback
```

### Google Cloud Console - INCORRECT ❌
```
Authorized redirect URIs:
https://remboursement.afneus.org/auth/callback  ← FAUX
```

## 🆘 Si vraiment bloqué

Refais un OAuth Client depuis zéro :

1. **Google Cloud Console** → **Credentials**
2. **CREATE CREDENTIALS** → **OAuth client ID**
3. Application type : **Web application**
4. Name : `AFNEUS Remboursement`
5. **Authorized redirect URIs** :
   ```
   https://revtmvfxvmuwycknesdс.supabase.co/auth/v1/callback
   ```
6. **CREATE**
7. Copie le **Client ID** et **Client Secret**
8. **Supabase** → **Authentication** → **Providers** → **Google**
9. Colle le nouveau Client ID et Secret
10. **SAVE**
11. Attends 5 minutes (propagation)
12. Teste

## ✅ Checklist

```
[ ] Google Cloud Console : Redirect URI = https://[PROJECT].supabase.co/auth/v1/callback
[ ] Supabase : Provider Google activé
[ ] Supabase : Client ID et Secret corrects
[ ] Site URL dans Supabase = https://remboursement.afneus.org
[ ] Cache navigateur vidé
[ ] Test connexion Google
[ ] Vérifier logs Supabase (pas d'erreur redirect_uri_mismatch)
[ ] Vérifier table users (nouveau user avec role=ADMIN)
```

---

**Une fois que ça marche, tu verras dans l'URL** :
```
https://remboursement.afneus.org/auth/callback?code=4%2F0AQq...
```

Au lieu de :
```
https://remboursement.afneus.org/auth/login?error=Code+manquant#access_token=...
```
