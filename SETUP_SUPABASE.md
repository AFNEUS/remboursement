# 🚀 Configuration Supabase - ÉTAPES OBLIGATOIRES

## 1️⃣ Créer le projet Supabase (2 min)

1. Aller sur [supabase.com](https://supabase.com) → Sign in
2. Cliquer "New Project"
3. Remplir :
   - **Name** : `afneus-remboursement`
   - **Database Password** : Générer un mot de passe sécurisé (NOTER !)
   - **Region** : Europe West (Ireland) ou closest
4. Attendre ~2 min (création DB)

## 2️⃣ Récupérer les clés API (1 min)

1. Dans le projet → **Settings** → **API**
2. Copier ces 3 valeurs :

```bash
# URL du projet (exemple : https://abcdefgh.supabase.co)
Project URL: _____________________

# Clé publique (anon key - safe côté client)
anon public: _____________________

# Clé privée (service_role - SECRET !)
service_role: _____________________
```

## 3️⃣ Mettre à jour `.env.local` (1 min)

```bash
# Éditer le fichier
nano .env.local

# Remplacer ces lignes avec VOS valeurs :
NEXT_PUBLIC_SUPABASE_URL=https://VOTRE_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... (votre anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (votre service_role key)
```

Sauvegarder : `Ctrl+O` → `Enter` → `Ctrl+X`

## 4️⃣ Exécuter la migration SQL (2 min)

1. Dans Supabase Dashboard → **SQL Editor** (icône </> à gauche)
2. Cliquer **"New query"**
3. Copier TOUT le contenu de `supabase/migrations/001_initial_schema.sql`
4. Coller dans l'éditeur
5. Cliquer **"Run"** (ou F5)
6. Vérifier : Vous devriez voir ~15 tables créées dans **Database** → **Tables**

## 5️⃣ Créer le bucket Storage (1 min)

1. **Storage** → **New bucket**
2. **Name** : `justificatifs`
3. **Public bucket** : ❌ NON (laisser décoché)
4. **Create bucket**

## 6️⃣ Activer Google OAuth (3 min)

### A. Dans Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services** → **Credentials**
3. Si vous n'avez pas encore d'OAuth Client :
   - **Create Credentials** → **OAuth client ID**
   - Type : **Web application**
   - Name : `AFNEUS Remboursement`
   - **Authorized redirect URIs** : `https://VOTRE_PROJECT_ID.supabase.co/auth/v1/callback`
   - Créer
4. Copier :
   - **Client ID** : `123456.apps.googleusercontent.com`
   - **Client Secret** : `GOCSPX-xxxxx`

### B. Dans Supabase Dashboard

1. **Authentication** → **Providers**
2. Trouver **Google** dans la liste
3. Activer le toggle
4. Remplir :
   - **Client ID** : (coller depuis Google)
   - **Client Secret** : (coller depuis Google)
5. **Save**

### C. Retour dans Google Cloud Console

1. Retourner dans **Credentials** → votre OAuth client
2. Dans **Authorized redirect URIs**, vérifier/ajouter :
   - `https://VOTRE_PROJECT_ID.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback` (pour dev local)
3. **Save**

## 7️⃣ Mettre à jour `.env.local` (Google)

```bash
nano .env.local

# Ajouter :
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxx
```

## 8️⃣ Redémarrer Next.js

```bash
# Tuer le processus actuel
pkill -f "next dev"

# Relancer
npm run dev
```

## 9️⃣ Créer votre premier utilisateur admin

1. Ouvrir http://localhost:3000
2. Cliquer "Se connecter" (à créer dans le header)
3. Se connecter avec Google
4. Dans Supabase → **Authentication** → **Users**
5. Copier votre UUID (ex: `a1b2c3d4-e5f6-...`)
6. Dans **SQL Editor**, exécuter :

```sql
INSERT INTO public.users (id, email, full_name, role, iban_verified, is_active)
VALUES (
  'VOTRE_UUID_ICI',
  'votre-email@gmail.com',
  'Votre Nom',
  'treasurer',  -- ou 'validator' ou 'user'
  true,
  true
);
```

## ✅ Vérification finale

```bash
# Tester l'API
curl http://localhost:3000/api/claims/list?status=draft

# Devrait retourner :
# {"claims":[],"total":0}  (au lieu d'une erreur)
```

---

## 🔥 Commandes rapides

```bash
# Copier la migration SQL dans le clipboard (si vous avez xclip)
cat supabase/migrations/001_initial_schema.sql | xclip -selection clipboard

# Relancer le serveur après modif .env
pkill -f "next dev" && npm run dev

# Voir les logs en temps réel
tail -f /tmp/nextjs-dev.log
```

---

**Temps total : ~10-15 minutes** ⏱️
