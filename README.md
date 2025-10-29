# AFNEUS - Système de Gestion des Remboursements

## 🎯 Vue d'ensemble

Système complet de gestion des demandes de remboursement pour la fédération AFNEUS, incluant :

- ✅ Formulaire de demande mobile-first avec calcul automatique
- ✅ Validation IBAN intégrée
- ✅ Upload et gestion des justificatifs (Supabase Storage)
- ✅ Workflow de validation multi-niveaux
- ✅ Export SEPA XML (pain.001.001.03) pour paiements en lot
- ✅ Dashboard trésorier et validateurs
- ✅ Audit complet et notifications
- ✅ Intégration Google Workspace (Sheets, Drive, Gmail)
- ✅ PWA offline-first

## 🏗️ Architecture

**Frontend:**
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- PWA (next-pwa)

**Backend:**
- Supabase (PostgreSQL + Auth + Storage + RLS)
- API Routes Next.js

**Automatisations:**
- Google Apps Script (sync Sheets, archivage Drive, notifications Gmail)

**PDF:**
- Playwright (génération PDF from HTML)

**Optionnel:**
- Tesseract.js (OCR justificatifs)
- OpenRouteService (calcul distances)

## 📋 Prérequis

1. **Node.js** >= 18.x
2. **Compte Supabase** (gratuit : https://supabase.com)
3. **Google Cloud Project** avec APIs activées :
   - Google Sheets API
   - Google Drive API
   - Gmail API
4. **Compte bancaire** avec IBAN pour les virements SEPA

## 🚀 Installation rapide

### 1. Cloner et installer les dépendances

```bash
git clone https://github.com/votre-org/afneus-remboursement.git
cd afneus-remboursement
npm install
```

### 2. Configurer Supabase

1. Créer un nouveau projet sur [supabase.com](https://supabase.com)
2. Aller dans **Settings > API** et copier :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon/public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ SECRET)

3. Activer **Google OAuth** :
   - Supabase Dashboard → **Authentication > Providers**
   - Activer **Google**
   - Entrer Client ID et Client Secret (voir étape 3)

4. Exécuter les migrations SQL :

```bash
# Dans Supabase Dashboard → SQL Editor
# Copier-coller le contenu de supabase/migrations/001_initial_schema.sql
```

5. Créer un bucket Storage :
   - Supabase Dashboard → **Storage**
   - Créer bucket `justificatifs` (public ou private selon politique)

### 3. Configurer Google Cloud

1. Créer un projet sur [console.cloud.google.com](https://console.cloud.google.com)
2. Activer les APIs :
   - Google Sheets API
   - Google Drive API
   - Gmail API
3. Créer des **OAuth 2.0 credentials** :
   - Type : Web application
   - Authorized redirect URIs : `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
   - Copier **Client ID** et **Client Secret**
4. Créer un **Service Account** (pour Apps Script) :
   - Télécharger le JSON des clés
   - Extraire `client_email` et `private_key`

### 4. Variables d'environnement

Créer un fichier `.env.local` à la racine :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# Google Service Account (Apps Script)
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nxxx\n-----END PRIVATE KEY-----\n"

# Google Drive/Sheets IDs
GOOGLE_DRIVE_FOLDER_ID=1abc...
GOOGLE_SHEETS_ID=1def...

# Organisation bancaire (pour SEPA)
CREDITOR_IBAN=FR76...
CREDITOR_BIC=BNPAFRPPXXX

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 5. Lancer l'application

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 📦 Structure du projet

```
afneus-remboursement/
├── app/
│   ├── api/
│   │   ├── claims/
│   │   │   ├── create/route.ts       # Créer une demande
│   │   │   ├── list/route.ts         # Lister les demandes
│   │   │   └── [id]/action/route.ts  # Actions (validate, refuse, etc.)
│   │   ├── export/
│   │   │   └── sepa/route.ts         # Générer SEPA XML / CSV
│   │   ├── iban/
│   │   │   └── check/route.ts        # Valider un IBAN
│   │   └── pdf/
│   │       └── generate/route.ts     # Générer PDF (à créer)
│   ├── claims/
│   │   ├── new/page.tsx              # Formulaire nouvelle demande
│   │   └── [id]/page.tsx             # Détail d'une demande
│   ├── validator/page.tsx            # Dashboard validateurs
│   ├── treasurer/page.tsx            # Dashboard trésorier (à créer)
│   └── layout.tsx
├── lib/
│   ├── supabase.ts                   # Client Supabase
│   ├── database.types.ts             # Types TypeScript
│   └── reimbursement.ts              # Logique métier
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql    # Schéma DB complet
├── scripts/
│   ├── google-apps-script/
│   │   ├── sync-sheets.js            # Sync Supabase → Sheets
│   │   ├── archive-drive.js          # Archiver PDF → Drive
│   │   └── send-emails.js            # Notifications Gmail
│   └── cron/
│       └── reminders.ts              # Rappels automatiques
├── .env.example
├── package.json
├── next.config.js
├── tailwind.config.ts
└── README.md
```

## 🔐 Sécurité et RLS (Row Level Security)

Les **RLS policies** Supabase garantissent :

- **Utilisateurs** : peuvent voir/modifier uniquement leurs propres demandes
- **Validateurs** : peuvent voir toutes les demandes à valider
- **Trésoriers** : accès complet + exports + audit logs
- **Service role** : utilisé uniquement côté serveur (API routes)

**⚠️ Ne JAMAIS exposer `SUPABASE_SERVICE_ROLE_KEY` côté client !**

## 📊 Workflow des demandes

```
┌─────────┐
│  draft  │  Création, upload justificatifs
└────┬────┘
     │ submit (si justificatifs OK)
     ↓
┌──────────────┐
│  submitted   │
│ to_validate  │  Attente validation
└──────┬───────┘
       │
       ├─→ validate ──→ ┌───────────┐
       │                │ validated │ → export_for_payment → paid → closed
       │                └───────────┘
       │
       ├─→ refuse ────→ ┌─────────┐
       │                │ refused │
       │                └─────────┘
       │
       └─→ request_info ─→ ┌────────────┐
                            │ incomplete │ (retour utilisateur)
                            └────────────┘
```

## 🎨 Barèmes et calculs

### Barèmes kilométriques 2024

| CV fiscaux | Tarif / km |
|------------|------------|
| 3 CV       | 0,529 €    |
| 4 CV       | 0,606 €    |
| 5 CV       | 0,636 €    |
| 6 CV       | 0,665 €    |
| 7 CV       | 0,697 €    |

### Taux de remboursement selon rôle

| Rôle               | Taux   |
|--------------------|--------|
| Bureau National    | 80%    |
| Admin Association  | 65%    |
| Autre              | 50%    |

**Exemple de calcul :**

- Distance : 200 km
- CV fiscaux : 5
- Rôle : BN

```
Base = 200 × 0,636 = 127,20 €
Remboursable = 127,20 × 0,80 = 101,76 €
```

## 💳 Export SEPA

Le système génère des fichiers **SEPA XML pain.001.001.03** conformes :

1. Sélectionner les demandes validées
2. Générer le fichier XML via `/api/export/sepa`
3. Importer dans votre logiciel bancaire (BNP, Crédit Agricole, etc.)
4. Uploader la preuve de virement pour marquer "paid"

**Format CSV** également disponible pour import manuel.

## 🔗 Intégration Google Workspace

### Synchronisation Sheets

Le script `google-apps-script/sync-sheets.js` synchronise automatiquement :

- Liste des demandes validées
- Montants à payer
- Historique des paiements

**Déploiement :**

1. Ouvrir [script.google.com](https://script.google.com)
2. Créer un nouveau projet
3. Copier-coller `sync-sheets.js`
4. Configurer les variables (Supabase URL, API key)
5. Déployer en tant que **Web App** ou **trigger automatique** (quotidien)

### Archivage Drive

Tous les PDF générés sont archivés dans Google Drive (dossier configurable).

### Notifications Gmail

Envoi automatique d'emails via Gmail API pour :

- Demande soumise
- Demande validée / refusée
- Paiement effectué
- Rappels justificatifs manquants

## 🧪 Tests

```bash
# Tests unitaires
npm test

# Tests avec watch mode
npm run test:watch

# Vérification TypeScript
npm run type-check
```

**Tests couverts :**

- Calcul des montants remboursables
- Validation IBAN
- Détection de doublons
- Workflow de validation
- Génération SEPA XML

## 🚀 Déploiement

### Vercel (recommandé)

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel

# Configurer les env vars dans Vercel Dashboard
```

### Docker (optionnel)

```bash
docker build -t afneus-remboursement .
docker run -p 3000:3000 --env-file .env afneus-remboursement
```

## 📱 PWA (Progressive Web App)

L'app est installable sur mobile :

1. Ouvrir depuis Safari (iOS) ou Chrome (Android)
2. Cliquer "Ajouter à l'écran d'accueil"
3. Utiliser offline avec cache des données

**Cache configuré pour :**

- Pages statiques
- API responses (courte durée)
- Assets (images, fonts)

## 🔧 Configuration avancée

### Activer l'OCR des justificatifs

1. Installer Tesseract.js (déjà dans `package.json`)
2. Créer `/app/api/ocr/extract/route.ts`
3. Activer dans config : `ocr_enabled: true`

### Activer le calcul automatique des distances

1. Obtenir une clé API OpenRouteService
2. Ajouter `OPENROUTESERVICE_API_KEY` dans `.env.local`
3. Activer dans config : `distance_matrix_enabled: true`

## 📞 Support et contribution

- **Issues :** [GitHub Issues](https://github.com/votre-org/afneus-remboursement/issues)
- **Discussions :** [GitHub Discussions](https://github.com/votre-org/afneus-remboursement/discussions)
- **Email :** support@afneus.org

### Contribuer

1. Fork le projet
2. Créer une branche (`git checkout -b feature/ma-fonctionnalite`)
3. Commit (`git commit -m 'Ajout fonctionnalité X'`)
4. Push (`git push origin feature/ma-fonctionnalite`)
5. Ouvrir une Pull Request

## 📄 Licence

MIT License - voir [LICENSE](LICENSE)

## ✅ Checklist démarrage MVP

- [ ] Créer projet Supabase
- [ ] Activer Google OAuth
- [ ] Exécuter migrations SQL
- [ ] Créer bucket Storage `justificatifs`
- [ ] Configurer Google Cloud Project
- [ ] Copier `.env.example` → `.env.local` et remplir
- [ ] `npm install`
- [ ] `npm run dev`
- [ ] Créer premier utilisateur (auto via Google Sign-In)
- [ ] Attribuer rôle `treasurer` manuellement en DB
- [ ] Tester création demande
- [ ] Tester validation
- [ ] Tester export SEPA

**Délai estimé setup complet : 2-3 heures**

## 🎯 Roadmap

**MVP (Phase 1) - ✅ Complété**

- [x] Schéma DB complet
- [x] API routes (claims, validation, export)
- [x] Formulaire demande
- [x] Dashboard validateurs
- [x] Export SEPA XML

**Phase 2 - En cours**

- [ ] Dashboard trésorier avec statistiques
- [ ] Générateur PDF (récapitulatif, bordereau)
- [ ] Scripts Google Apps Script
- [ ] Tests automatisés

**Phase 3 - Futur**

- [ ] OCR extraction automatique
- [ ] Calcul distance automatique (OpenRouteService)
- [ ] App mobile native (React Native / Expo)
- [ ] Module de réclamations / litiges
- [ ] Intégration HelloAsso (paiements événements)

---

**Créé avec ❤️ pour AFNEUS par [Votre nom]**
