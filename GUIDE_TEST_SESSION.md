# 🧪 GUIDE DE TEST OAUTH - APRÈS CORRECTIONS

## ✅ Corrections appliquées (Commit b5e3b1e)

### Problème résolu
```
❌ AVANT:
- Google OAuth créait le token
- MAIS la session n'était pas reconnue côté client
- Navigation n'affichait pas l'utilisateur connecté
- Dashboard ne chargeait pas
- Boucles de redirection infinies

✅ APRÈS:
- OAuth crée token ET établit session côté serveur + client
- Navigation.tsx utilise getSession() + onAuthStateChange
- Dashboard vérifie correctement la session
- Logs détaillés dans la console navigateur
```

---

## 🧪 TESTS À EFFECTUER

### Test 1 : Connexion Google OAuth complète

1. **Ouvrez la console navigateur** (F12 → Console)
2. **Allez sur** https://remboursement.afneus.org/auth/login
3. **Cliquez** "Continuer avec Google"
4. **Connectez-vous** avec votre compte @afneus.org

#### ✅ Résultat attendu (dans la console) :

```
🔍 Dashboard - Vérification session...
✅ Session active: mohameddhia.ounally@afneus.org
✅ Profil chargé: mohameddhia.ounally@afneus.org ADMIN
🔄 Auth state changed: SIGNED_IN mohameddhia.ounally@afneus.org
✅ Session trouvée: mohameddhia.ounally@afneus.org
✅ User data trouvé: mohameddhia.ounally@afneus.org ADMIN
```

#### ✅ Résultat visuel attendu :

- ✅ Redirection vers `/dashboard`
- ✅ Navigation affiche votre nom en haut à droite
- ✅ Dashboard affiche "👋 Bienvenue, Mohamed Ounally"
- ✅ Cartes visibles : Nouvelle demande, Mes demandes, Mon profil, Validation, Trésorerie, Administration

---

### Test 2 : Persistance de session (actualiser la page)

1. **Sur le dashboard**, appuyez sur **F5** (actualiser)

#### ✅ Résultat attendu :

- ✅ Pas de redirection vers login
- ✅ Dashboard se recharge avec vos données
- ✅ Navigation affiche toujours votre profil

---

### Test 3 : Logs Vercel (côté serveur)

1. **Allez sur** https://vercel.com/mohameds-projects-95242938/remboursement/logs
2. **Filtrez par** "callback"
3. **Connectez-vous** avec Google OAuth
4. **Rafraîchissez** les logs Vercel

#### ✅ Logs attendus :

```
🔄 CALLBACK OAuth reçu
🔑 Code présent: true
🔄 Échange code pour session...
✅ Session créée !
👤 User ID: xxx-xxx-xxx
📧 Email: mohameddhia.ounally@afneus.org
🔑 Access Token présent: true
🔑 Refresh Token présent: true
🔍 Vérification existence utilisateur...
✅ Utilisateur existe déjà dans public.users
✅ Profil trouvé !
   📧 Email: mohameddhia.ounally@afneus.org
   👤 Nom: Mohamed Ounally
   🎭 Rôle: ADMIN
➡️ Redirection /dashboard (ADMIN)
```

---

### Test 4 : Vérification dans Supabase

1. **Supabase Dashboard** → SQL Editor
2. **Exécutez** :

```sql
-- Vérifier utilisateur dans auth.users
SELECT id, email, created_at, last_sign_in_at 
FROM auth.users 
WHERE email = 'mohameddhia.ounally@afneus.org';

-- Vérifier utilisateur dans public.users
SELECT id, email, first_name, last_name, role, status, created_at 
FROM public.users 
WHERE email = 'mohameddhia.ounally@afneus.org';
```

#### ✅ Résultat attendu :

- ✅ Utilisateur présent dans **auth.users** avec `last_sign_in_at` récent
- ✅ Utilisateur présent dans **public.users** avec `role = 'ADMIN'`

---

## 🔍 DÉBOGAGE SI ÇA NE MARCHE PAS

### Symptôme 1 : "Session non reconnue" après login

**Console navigateur montre** :
```
⚠️ Pas de session, redirection login
```

**Solutions** :
1. Vider le cache navigateur (Ctrl+Shift+Delete)
2. Vider le stockage local : Console → `localStorage.clear()` → Enter
3. Se déconnecter puis reconnecter

---

### Symptôme 2 : "Profil non trouvé" dans dashboard

**Console navigateur montre** :
```
❌ Utilisateur non trouvé dans public.users
```

**Solution** :
Exécutez ce SQL dans Supabase :

```sql
INSERT INTO public.users (id, email, first_name, last_name, status, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'given_name', 'Mohamed') as first_name,
  COALESCE(raw_user_meta_data->>'family_name', 'Ounally') as last_name,
  'BN' as status,
  'ADMIN' as role
FROM auth.users
WHERE email = 'mohameddhia.ounally@afneus.org'
AND NOT EXISTS (
  SELECT 1 FROM public.users WHERE public.users.id = auth.users.id
);
```

---

### Symptôme 3 : Boucle de redirection login → dashboard → login

**Causes possibles** :
1. Cookies tiers bloqués dans navigateur
2. Domaine mal configuré

**Solutions** :
1. **Chrome/Edge** : Paramètres → Confidentialité → Autoriser tous les cookies
2. **Firefox** : Paramètres → Vie privée → Standard
3. Tester en **navigation privée**

---

### Symptôme 4 : Erreur "Access denied" ou "Invalid credentials"

**Dans Supabase Dashboard** :
1. Authentication → Providers → Google
2. Vérifier que **"Enable Sign in with Google"** est COCHÉ
3. Vérifier que Client ID et Client Secret sont corrects
4. Vérifier Redirect URLs contient bien :
   - `https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/callback`

---

## 📊 CHECKLIST COMPLÈTE

- [ ] Connexion Google OAuth fonctionne
- [ ] Session établie côté serveur (logs Vercel)
- [ ] Session reconnue côté client (console navigateur)
- [ ] Navigation affiche profil utilisateur
- [ ] Dashboard charge avec données
- [ ] Actualisation page (F5) ne déconnecte pas
- [ ] Utilisateur existe dans auth.users ET public.users
- [ ] Rôle correctement assigné (ADMIN pour vous)
- [ ] Accès aux pages admin/trésorerie/validation

---

## 🚀 PROCHAINES ÉTAPES

Une fois que OAuth fonctionne 100% :

1. ✅ Tester création demande de remboursement
2. ✅ Tester upload de fichiers (justificatifs)
3. ✅ Tester workflow validation
4. ✅ Tester export SEPA
5. 📧 Configurer Resend pour emails production
6. 📊 Activer Vercel Analytics

---

## 💡 ASTUCES DE DÉBOGAGE

### Console navigateur utile :

```javascript
// Vérifier session actuelle
const { data } = await supabase.auth.getSession();
console.log('Session:', data.session);

// Vérifier utilisateur actuel
const { data: { user } } = await supabase.auth.getUser();
console.log('User:', user);

// Forcer rafraîchissement session
await supabase.auth.refreshSession();
console.log('Session rafraîchie');

// Vider tout et recommencer
localStorage.clear();
location.reload();
```

---

## 📞 SI BESOIN D'AIDE

**Envoyez-moi** :
1. 📸 Screenshot de la console navigateur (après tentative login)
2. 📸 Screenshot des logs Vercel (filtré "callback")
3. 📋 Résultat de cette requête SQL :
   ```sql
   SELECT email, role, status FROM public.users WHERE email LIKE '%@afneus.org';
   ```

---

**Le déploiement Vercel est terminé. Testez maintenant !** 🚀

URL : https://remboursement.afneus.org/auth/login
