# ✅ Configuration Google OAuth - AFNEUS

## 🎯 Configuration Google Cloud Console

### 1. Authorized Redirect URIs
**Dans ton OAuth Client (Google Cloud Console), garde UNIQUEMENT :**
```
https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/callback
```

**❌ NE PAS ajouter :**
- ~~http://localhost:3000/auth/callback~~
- ~~http://localhost:3000~~
- ~~Aucune autre URL~~

**Pourquoi ?** Google → Supabase (gère OAuth) → Ton app

---

## 🔧 Configuration Supabase Dashboard

### 1. Va dans Authentication → URL Configuration

**Site URL:**
```
http://localhost:3000
```

**Redirect URLs (ajoute cette ligne):**
```
http://localhost:3000/auth/callback
```

**Pourquoi ?** Supabase sait où rediriger après validation OAuth

---

## 🔄 Flux OAuth Complet

```
1. User clique "Continuer avec Google"
   ↓
2. Next.js → supabase.auth.signInWithOAuth()
   ↓
3. Redirection vers Google OAuth
   ↓
4. User s'authentifie sur Google
   ↓
5. Google → Supabase callback
   https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/callback?code=XXX
   ↓
6. Supabase traite OAuth + crée session
   ↓
7. Supabase → Ton app callback
   http://localhost:3000/auth/callback?code=YYY
   ↓
8. app/auth/callback/route.ts:
   - Échange code pour session
   - Récupère profil user
   - Redirige selon rôle:
     * ADMIN/TREASURER/VALIDATOR → /dashboard
     * MEMBER → /claims
```

---

## 🧪 Test du Flow

1. Ouvre http://localhost:3000
2. Clique "Se connecter"
3. Clique "Continuer avec Google"
4. Choisis ton compte Google (@afneus.org)
5. **Tu devrais atterrir sur /dashboard** (tu es ADMIN)

---

## 🐛 Debug en cas d'erreur

**Ouvre la console navigateur (F12) et vérifie les logs:**
- ✅ "Session créée avec succès"
- ✅ "Profil trouvé: mohameddhia.ounally@afneus.org"
- ✅ "Rôle: ADMIN"
- ✅ "Redirection ADMIN vers /dashboard"

**Ouvre le terminal serveur et vérifie:**
```
🔄 Callback OAuth reçu
🔑 Code présent: true
✅ Session créée avec succès
👤 Email: mohameddhia.ounally@afneus.org
✅ Profil trouvé
➡️ Redirection ADMIN/TREASURER/VALIDATOR vers /dashboard
```

---

## ⚡ Checklist Rapide

- [ ] Google Cloud: **1 seule redirect URI** (Supabase callback)
- [ ] Supabase Dashboard: Site URL + Redirect URL configurés
- [ ] Supabase Dashboard: Google Provider activé avec Client ID + Secret
- [ ] Serveur Next.js redémarré (`npm run dev`)
- [ ] Test connexion Google OAuth

---

## 🔑 Variables d'environnement (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://revtmvfxvmuwycknesdc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Google OAuth (optionnel pour Next.js, configuré dans Supabase)
GOOGLE_CLIENT_ID=728966191325-p84jtgcn5vhriefzhbh0jgketv6qnrv4.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

**Note:** Les credentials Google sont dans Supabase Dashboard, pas besoin dans .env.local

---

## 📝 Résolution des problèmes courants

### Erreur "no_code"
**Cause:** Code OAuth manquant dans callback URL
**Solution:** 
1. Vérifie Google Cloud redirect URI (doit être Supabase uniquement)
2. Vérifie Supabase URL Configuration (redirect URLs)

### Erreur "Session non créée"
**Cause:** exchangeCodeForSession() échoue
**Solution:** Vérifie que Client ID + Secret sont corrects dans Supabase

### Boucle de redirection infinie
**Cause:** Middleware ou mauvaise config redirect
**Solution:** Vérifie middleware.ts et callback route

### Profil non trouvé
**Cause:** Trigger database pas encore exécuté
**Solution:** Migration 000_master_init.sql doit être appliquée dans Supabase

---

## ✅ État actuel (1er Nov 2025)

- ✅ Google Cloud Project créé (AFNEUS Remboursement)
- ✅ OAuth Client créé
- ✅ Supabase Google Provider activé
- ✅ Code optimisé avec logging complet
- ⏳ À tester: Connexion Google OAuth complète
