# 🚀 GUIDE DE DÉMARRAGE RAPIDE - AFNEUS REMBOURSEMENTS

## ✅ Liste de vérification pré-installation

- [ ] Node.js 18+ installé
- [ ] Compte Supabase créé
- [ ] Compte Google Cloud créé
- [ ] Git installé

## 🎯 Installation en 10 minutes

### 1. Installation du projet (2 min)

```bash
# Cloner le repo
git clone https://github.com/votre-org/afneus-remboursement.git
cd afneus-remboursement

# Installer les dépendances
npm install
```

### 2. Configuration Supabase (3 min)

**A. Créer un projet Supabase**

1. Aller sur [supabase.com](https://supabase.com)
2. "New Project" → Nommer "afneus-remboursement"
3. Choisir une région proche (ex: West EU)
4. Générer un mot de passe sécurisé

**B. Copier les credentials**

Dans Settings → API :
- Copier `Project URL`
- Copier `anon public` key
- Copier `service_role` key (⚠️ secret)

**C. Exécuter les migrations SQL**

1. Aller dans SQL Editor
2. Copier-coller tout le contenu de `supabase/migrations/001_initial_schema.sql`
3. Cliquer "Run"
4. Vérifier : vous devriez voir ~15 tables créées

**D. Créer le bucket Storage**

1. Aller dans Storage
2. "New bucket" → Nommer `justificatifs`
3. Public : Non (RLS activé)

### 3. Configuration Google Cloud (3 min)

**A. Créer un projet**

1. Aller sur [console.cloud.google.com](https://console.cloud.google.com)
2. "Nouveau projet" → Nommer "AFNEUS Remboursements"

**B. Activer les APIs**

1. APIs & Services → Library
2. Chercher et activer :
   - Google Sheets API
   - Google Drive API
   - Gmail API

**C. Créer OAuth credentials**

1. APIs & Services → Credentials → "Create Credentials" → OAuth client ID
2. Type : Web application
3. Authorized redirect URIs : `https://VOTRE_PROJECT.supabase.co/auth/v1/callback`
4. Copier Client ID et Client Secret

**D. Créer Service Account** (pour Apps Script)

1. Credentials → "Create Credentials" → Service Account
2. Nommer "afneus-remboursement-automation"
3. Role : Editor
4. "Create Key" → JSON
5. Télécharger le fichier JSON
6. Ouvrir le JSON et copier `client_email` et `private_key`

### 4. Configurer les variables d'environnement (1 min)

```bash
# Créer le fichier .env.local
cp .env.example .env.local

# Éditer avec vos valeurs
nano .env.local
```

**Variables obligatoires minimum :**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://XXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... # ⚠️ SECRET

# Google OAuth
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-XXXXXXX # ⚠️ SECRET

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 5. Activer Google Auth dans Supabase (1 min)

1. Supabase Dashboard → Authentication → Providers
2. Activer "Google"
3. Entrer votre `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`
4. Copier l'URL de callback affichée
5. Retourner dans Google Cloud Console → Credentials → Ajouter cette URL aux "Authorized redirect URIs"

### 6. Lancer l'application 🎉

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

---

## 🔧 Configuration avancée (optionnelle)

### Google Apps Script (synchronisation automatique)

**1. Créer une feuille Google Sheets**

1. Créer une nouvelle feuille "AFNEUS - Demandes de remboursement"
2. Copier l'ID de la feuille (dans l'URL : `...spreadsheets/d/[ID_ICI]/edit`)

**2. Créer un dossier Google Drive**

1. Créer un dossier "AFNEUS - Archivage Remboursements"
2. Copier l'ID (dans l'URL : `...folders/[ID_ICI]`)

**3. Déployer les scripts**

1. Ouvrir [script.google.com](https://script.google.com)
2. Nouveau projet → "AFNEUS Automatisations"
3. Créer 3 fichiers :
   - `sync-sheets.js` (copier depuis `scripts/google-apps-script/sync-sheets.js`)
   - `archive-drive.js` (copier depuis `scripts/google-apps-script/archive-drive.js`)
   - `send-emails.js` (copier depuis `scripts/google-apps-script/send-emails.js`)

**4. Configurer les variables**

Dans chaque script, remplacer :
- `SUPABASE_URL` → Votre URL Supabase
- `SUPABASE_ANON_KEY` ou `SUPABASE_SERVICE_KEY` → Vos clés
- `SPREADSHEET_ID` → ID de votre Sheet
- `FOLDER_ID` → ID de votre dossier Drive

**Mieux : Utiliser Script Properties** (sécurisé)

1. Settings (⚙️) → Script Properties → Add
2. Ajouter :
   - `SUPABASE_URL` = `https://xxx.supabase.co`
   - `SUPABASE_SERVICE_KEY` = `eyJxxx...`
   - `SPREADSHEET_ID` = `1abc...`
   - `DRIVE_FOLDER_ID` = `1def...`

3. Dans le code, remplacer les valeurs hardcodées par :

```javascript
const CONFIG = {
  SUPABASE_URL: PropertiesService.getScriptProperties().getProperty('SUPABASE_URL'),
  // etc.
};
```

**5. Créer les déclencheurs automatiques**

1. Triggers (⏰) → Add Trigger
2. Créer :

| Fonction | Type | Fréquence |
|----------|------|-----------|
| `syncValidatedClaims` | Time-driven | Day timer, 6-7am |
| `archiveValidatedClaimsToDrive` | Time-driven | Day timer, 7-8am |
| `sendPendingNotifications` | Time-driven | Hour timer, Every hour |
| `sendMissingJustificatifsReminders` | Time-driven | Day timer, 9-10am |
| `generateMonthlyReport` | Time-driven | Month timer, 1st day, 8-9am |

**6. Tester les scripts**

Cliquer sur "Run" pour chaque fonction et vérifier les logs.

---

## 👤 Premier utilisateur admin

**1. Se connecter avec Google**

1. Aller sur [http://localhost:3000](http://localhost:3000)
2. Cliquer "Se connecter" (bouton à créer dans la nav)
3. Se connecter avec votre compte Google

**2. Récupérer votre UUID**

1. Supabase Dashboard → Authentication → Users
2. Copier votre UUID (ex: `a1b2c3d4-...`)

**3. Attribuer le rôle treasurer**

Dans Supabase SQL Editor :

```sql
INSERT INTO public.users (id, email, full_name, role, iban_verified, is_active)
VALUES (
  'VOTRE_UUID_ICI',
  'votre-email@afneus.org',
  'Votre Nom',
  'treasurer',
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET role = 'treasurer';
```

**4. Recharger la page**

Vous avez maintenant accès complet !

---

## 🧪 Tests rapides

### Test 1 : Créer une demande

1. Aller sur `/claims/new`
2. Remplir le formulaire :
   - Type : Voiture
   - Date : Aujourd'hui
   - Distance : 100 km
   - CV fiscaux : 5
   - Upload un fichier PDF de test
3. Soumettre
4. Vérifier : status = `to_validate`

### Test 2 : Valider une demande

1. Aller sur `/validator`
2. Voir votre demande dans la liste
3. Cliquer "Valider"
4. Vérifier : status = `validated`

### Test 3 : Exporter SEPA

1. Aller sur `/treasurer` (à créer ou utiliser API directement)
2. Sélectionner la demande validée
3. Générer l'export SEPA
4. Vérifier : fichier XML téléchargé

---

## 📊 Barèmes par défaut (2024)

### Kilométriques

| CV | Tarif/km |
|----|----------|
| 3  | 0,529 €  |
| 4  | 0,606 €  |
| 5  | 0,636 €  |
| 6  | 0,665 €  |
| 7  | 0,697 €  |

### Taux de remboursement

| Rôle | Taux |
|------|------|
| Bureau National | 80% |
| Admin Association | 65% |
| Autres | 50% |

---

## 🆘 Dépannage rapide

### Erreur : "Invalid API key"

```bash
# Vérifier que les env vars sont chargées
echo $NEXT_PUBLIC_SUPABASE_URL

# Redémarrer le serveur
npm run dev
```

### Erreur : Upload de fichiers échoue

1. Supabase → Storage → `justificatifs`
2. Configuration → CORS : Ajouter `http://localhost:3000`
3. Policies → Vérifier que les RLS policies sont activées

### Erreur : Google Auth ne fonctionne pas

1. Vérifier que l'URL de callback est correcte dans Google Cloud Console
2. Vérifier que Google Auth est activé dans Supabase
3. Vérifier les env vars `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`

### Emails ne sont pas envoyés

Les emails ne seront envoyés qu'une fois les Google Apps Scripts déployés et configurés.

---

## 📚 Ressources

- **Documentation complète** : [README.md](README.md)
- **Guide de déploiement** : [DEPLOYMENT.md](DEPLOYMENT.md)
- **Supabase Docs** : [https://supabase.com/docs](https://supabase.com/docs)
- **Next.js Docs** : [https://nextjs.org/docs](https://nextjs.org/docs)
- **Google Apps Script** : [https://developers.google.com/apps-script](https://developers.google.com/apps-script)

---

## ✅ Checklist finale

Avant de passer en production :

- [ ] Toutes les variables d'environnement configurées
- [ ] Google Auth fonctionne
- [ ] Premier utilisateur admin créé
- [ ] Demande de test créée et validée
- [ ] Upload de fichiers fonctionne
- [ ] Export SEPA testé
- [ ] Google Apps Scripts déployés
- [ ] Déclencheurs automatiques configurés
- [ ] Tests unitaires passent (`npm test`)
- [ ] Build réussit (`npm run build`)
- [ ] Documentation lue

**Temps total estimé : 10-15 minutes pour le MVP, 30-45 minutes avec Google Apps Script**

---

**Besoin d'aide ?** Ouvrir une issue sur [GitHub](https://github.com/votre-org/afneus-remboursement/issues) 🙋‍♂️
