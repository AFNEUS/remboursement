# 🔐 Configuration Google OAuth - Guide Étape par Étape

## ✅ PRÉREQUIS
- Compte Google (celui de l'AFNEUS de préférence)
- Accès Supabase Dashboard
- Domaine configuré (optionnel pour test local)

---

## 📋 ÉTAPE 1 : CRÉER PROJET GOOGLE CLOUD (5 min)

### **1.1 Accéder à Google Cloud Console**
1. Va sur : https://console.cloud.google.com
2. Connecte-toi avec ton compte Google (@afneus.org si possible)
3. ✅ Tu arrives sur le dashboard Google Cloud

### **1.2 Créer un nouveau projet**
1. En haut à gauche, clique sur le **nom du projet** (ou "Select a project")
2. Clique **"NEW PROJECT"** (en haut à droite)
3. Remplis :
   - **Project name** : `AFNEUS Remboursement`
   - **Organization** : Laisser vide (ou sélectionner AFNEUS si dispo)
   - **Location** : No organization
4. Clique **"CREATE"**
5. ⏳ Attends 10-20 secondes
6. ✅ Sélectionne le projet créé dans le menu déroulant

---

## 📋 ÉTAPE 2 : CONFIGURER OAUTH CONSENT SCREEN (5 min)

### **2.1 Accéder à OAuth consent screen**
1. Menu hamburger (☰) en haut à gauche
2. **APIs & Services** → **OAuth consent screen**
3. Ou directement : https://console.cloud.google.com/apis/credentials/consent

### **2.2 Configurer le consent screen**

**User Type :**
- Sélectionne **"External"** (pour permettre tous les emails)
- Clique **"CREATE"**

**Page 1 : App information**
- **App name** : `AFNEUS Remboursement`
- **User support email** : Ton email @afneus.org
- **App logo** : (Optionnel - logo AFNEUS si tu as)
- **Application home page** : `https://remboursement.afneus.org` (ou laisser vide pour test)
- **Application Privacy Policy** : Laisser vide pour l'instant
- **Application Terms of Service** : Laisser vide
- **Authorized domains** :
  - Ajoute : `afneus.org` (si tu as le domaine)
  - Ajoute : `supabase.co` (IMPORTANT !)
- **Developer contact** : Ton email

Clique **"SAVE AND CONTINUE"**

**Page 2 : Scopes**
- Clique **"ADD OR REMOVE SCOPES"**
- Sélectionne :
  - ✅ `.../auth/userinfo.email`
  - ✅ `.../auth/userinfo.profile`
  - ✅ `openid`
- Clique **"UPDATE"**
- Clique **"SAVE AND CONTINUE"**

**Page 3 : Test users** (pour mode test)
- Clique **"ADD USERS"**
- Ajoute ton email et ceux des testeurs
- Exemples :
  - `ton.email@afneus.org`
  - `test@afneus.org`
  - `validator@afneus.org`
- Clique **"ADD"**
- Clique **"SAVE AND CONTINUE"**

**Page 4 : Summary**
- Vérifie tout
- Clique **"BACK TO DASHBOARD"**

✅ **Consent screen configuré !**

---

## 📋 ÉTAPE 3 : CRÉER OAUTH CLIENT ID (3 min)

### **3.1 Aller dans Credentials**
1. **APIs & Services** → **Credentials**
2. Ou : https://console.cloud.google.com/apis/credentials

### **3.2 Créer OAuth Client**
1. Clique **"+ CREATE CREDENTIALS"** (en haut)
2. Sélectionne **"OAuth client ID"**

### **3.3 Configurer le client**

**Application type :**
- Sélectionne **"Web application"**

**Name :**
- `AFNEUS Remboursement - Web`

**Authorized JavaScript origins :**
- Ajoute : `http://localhost:3000` (pour test local)
- Ajoute : `https://revtmvfxvmuwycknesdc.supabase.co` (ton URL Supabase)
- Ajoute : `https://remboursement.afneus.org` (si domaine custom)

**Authorized redirect URIs :**
- ⚠️ **SUPER IMPORTANT** - Récupère l'URL depuis Supabase d'abord !

---

## 📋 ÉTAPE 4 : RÉCUPÉRER CALLBACK URL SUPABASE (2 min)

### **4.1 Aller dans Supabase Dashboard**
1. Va sur : https://supabase.com/dashboard
2. Sélectionne ton projet **AFNEUS Remboursement**
3. Menu gauche : **Authentication** → **Providers**

### **4.2 Activer Google Provider**
1. Cherche **"Google"** dans la liste
2. Clique sur **"Google"**
3. Toggle **"Enable Sign in with Google"** → **ON** (vert)

### **4.3 Copier Callback URL**
1. Tu vois : **Callback URL (for OAuth)**
2. Exemple : `https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/callback`
3. 📋 **COPIE cette URL** (on va l'utiliser dans Google Cloud)

✅ **Ne ferme pas cette page, on va revenir !**

---

## 📋 ÉTAPE 5 : AJOUTER REDIRECT URI DANS GOOGLE (2 min)

### **5.1 Retour sur Google Cloud Console**
1. Retourne sur : https://console.cloud.google.com/apis/credentials
2. Clique sur le client OAuth créé : `AFNEUS Remboursement - Web`

### **5.2 Ajouter la Callback URL**

Dans **Authorized redirect URIs** :
- Clique **"+ ADD URI"**
- Colle l'URL de Supabase : `https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/callback`
- Clique **"SAVE"**

✅ **URIs configurées !**

---

## 📋 ÉTAPE 6 : RÉCUPÉRER CLIENT ID ET SECRET (1 min)

### **6.1 Copier les credentials**
1. Dans la page du client OAuth (Google Cloud)
2. Tu vois une popup ou une section avec :
   - **Your Client ID** : `123456789-abcdefgh.apps.googleusercontent.com`
   - **Your Client Secret** : `GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ`
3. 📋 **COPIE les deux** (garde-les dans un notepad)

---

## 📋 ÉTAPE 7 : CONFIGURER SUPABASE (2 min)

### **7.1 Retour sur Supabase Dashboard**
1. Retourne sur : **Authentication** → **Providers** → **Google**
2. Tu vois maintenant le formulaire

### **7.2 Remplir les credentials**

**Client ID (for OAuth)** :
- Colle le Client ID de Google : `123456789-abcdefgh.apps.googleusercontent.com`

**Client Secret (for OAuth)** :
- Colle le Client Secret : `GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ`

**Authorized Client IDs** :
- Laisser vide (pas nécessaire pour web)

**Skip nonce check** :
- Laisser décoché

**Save**
- Clique **"Save"** en bas

✅ **Google OAuth configuré dans Supabase !**

---

## 📋 ÉTAPE 8 : TESTER LA CONNEXION (3 min)

### **8.1 Redémarrer le serveur Next.js**
1. Dans le terminal où tourne `npm run dev`
2. Appuie **Ctrl+C** pour arrêter
3. Relance : `npm run dev`

### **8.2 Tester la connexion**
1. Va sur : http://localhost:3000
2. Clique **"Se connecter"**
3. ✅ **Tu devrais voir un bouton "Sign in with Google"** ou icône Google
4. Clique dessus
5. 🔄 Redirection vers Google
6. Sélectionne ton compte Google
7. ✅ **Autoriser l'application**
8. 🔄 Redirection vers le site
9. ✅ **Tu es connecté !**

### **8.3 Vérifier dans Supabase**
1. Supabase Dashboard → **Authentication** → **Users**
2. ✅ Tu vois ton user créé avec :
   - Email de ton compte Google
   - Provider : Google
   - Created at : maintenant

### **8.4 Vérifier dans la table users**
1. Supabase → **Table Editor** → **users**
2. ✅ Ton profil créé automatiquement (trigger `handle_new_user`)
3. ✅ Status = 'BN' si email @afneus.org, sinon 'MEMBER'

---

## 📋 ÉTAPE 9 : AJUSTER LE CODE (Optionnel)

### **9.1 Vérifier le bouton Google dans ton code**

Le bouton devrait ressembler à ça dans `app/login/page.tsx` :

```typescript
<button
  onClick={() => signInWithGoogle()}
  className="w-full bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
>
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    {/* Google Icon SVG */}
  </svg>
  Sign in with Google
</button>
```

Fonction :
```typescript
const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })
  if (error) console.error('Error:', error.message)
}
```

---

## 🎯 CHECKLIST FINALE

- [ ] ✅ Projet Google Cloud créé
- [ ] ✅ OAuth Consent Screen configuré (External)
- [ ] ✅ Scopes ajoutés (email, profile, openid)
- [ ] ✅ OAuth Client ID créé (Web application)
- [ ] ✅ Redirect URIs ajoutées (Supabase callback)
- [ ] ✅ Client ID et Secret copiés
- [ ] ✅ Google Provider activé dans Supabase
- [ ] ✅ Client ID/Secret ajoutés dans Supabase
- [ ] ✅ Test de connexion réussi
- [ ] ✅ User créé automatiquement dans tables

---

## 🐛 DÉPANNAGE

### **Erreur "redirect_uri_mismatch"**
- ✅ Vérifie que l'URI dans Google Cloud = celle de Supabase exactement
- ✅ Pas d'espace, pas de slash à la fin

### **Erreur "Access blocked: This app's request is invalid"**
- ✅ Vérifie OAuth Consent Screen configuré
- ✅ Ajoute ton email dans Test Users
- ✅ Vérifie que les scopes sont bien ajoutés

### **Pas de bouton Google sur la page login**
- ✅ Vérifie que le provider est activé dans Supabase
- ✅ Redémarre le serveur Next.js

### **User pas créé dans public.users**
- ✅ Vérifie que le trigger `handle_new_user` existe :
  ```sql
  SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
  ```

---

## 🚀 PROCHAINES ÉTAPES

1. ✅ Google OAuth fonctionnel
2. ⏳ Configurer Resend (emails)
3. ⏳ Déployer sur Vercel
4. ⏳ Configurer domaine custom

---

**C'est parti ! Dis-moi où tu en es et on fait chaque étape ensemble ! 🎯**
