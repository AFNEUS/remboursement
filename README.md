# 🎓 AFNEUS - Plateforme de Remboursement

Système complet de gestion des remboursements pour l'Association fédérative nationale des étudiants universitaires scientifiques.

## 🚀 Stack Technique

- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Hébergement:** Vercel (gratuit)
- **Emails:** Resend (3000/mois gratuits)
- **Paiements:** Export SEPA pour Société Générale

## 📋 Fonctionnalités

### Pour les Membres
- ✅ Création de demandes de remboursement
- ✅ Upload de justificatifs (PDF, images)
- ✅ Suivi en temps réel du statut
- ✅ Notifications email automatiques
- ✅ Historique des remboursements

### Pour les Validateurs
- ✅ Interface de validation
- ✅ Modification des montants
- ✅ Approbation/Rejet avec motif

### Pour les Trésoriers
- ✅ Export SEPA (pain.001.001.03)
- ✅ Paiements groupés
- ✅ Import direct dans SG Pro
- ✅ Statistiques et rapports

### Pour les Admins
- ✅ Gestion des événements
- ✅ Configuration des barèmes
- ✅ Calcul automatique prix SNCF
- ✅ Gestion des utilisateurs
- ✅ Dashboard complet

## 🎯 Barèmes de Remboursement

| Statut | Taux de remboursement |
|--------|----------------------|
| **BN (Bureau National)** | 80% |
| **Administrateurs** | 65% |
| **Autres membres** | 50% |

**Types de dépenses :**
- 🚗 Covoiturage (barème fiscal + bonus)
- 🚄 Train (SNCF, prix jeune)
- 🚌 Bus/Car
- 🍽️ Repas
- 🏨 Hébergement
- 📱 TGVMax

## ⚡ Installation Rapide

### 1. Cloner le projet

```bash
git clone git@github.com:AFNEUS/remboursement.git
cd remboursement
npm install
```

### 2. Configurer Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Copier `.env.example` vers `.env.local`
3. Ajouter vos clés Supabase :

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

4. Exécuter la migration :
   - Aller dans SQL Editor
   - Copier/coller `supabase/migrations/000_master_init.sql`
   - Exécuter (RUN)

### 3. Lancer en local

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 🌐 Déploiement Production

### Option A : Vercel (Recommandé - Gratuit)

1. **Connecter GitHub**
   - Aller sur [vercel.com](https://vercel.com)
   - "Import Project" → Sélectionner `AFNEUS/remboursement`

2. **Variables d'environnement**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
   SUPABASE_SERVICE_ROLE_KEY=xxx
   NEXT_PUBLIC_APP_URL=https://afneus.org
   ```

3. **Deploy**
   - Cliquer "Deploy"
   - Attendre 2-3 min
   - Site accessible sur `xxx.vercel.app`

4. **DNS Custom (OVH)**
   
   Dans OVH Manager → Zone DNS :
   ```
   Type: A
   Nom: @
   Cible: 76.76.21.21
   
   Type: CNAME
   Nom: www
   Cible: cname.vercel-dns.com.
   ```
   
   Dans Vercel → Settings → Domains :
   - Ajouter `afneus.org`
   - SSL auto-généré
   - Site accessible en HTTPS

## 🔐 Configuration OAuth Google

### 1. Google Cloud Console

1. Aller sur [console.cloud.google.com](https://console.cloud.google.com)
2. Créer projet "AFNEUS"
3. APIs & Services → Écran de consentement OAuth
   - Type: Externe
   - Nom: AFNEUS
   - Email: contact@afneus.org

4. Créer OAuth Client ID
   - Type: Application Web
   - URIs autorisés: `https://xxx.supabase.co/auth/v1/callback`

5. Copier Client ID + Secret

### 2. Supabase Dashboard

1. Authentication → Providers → Google
2. Enable
3. Coller Client ID + Secret
4. Save

### 3. Tester

- Aller sur `/auth/login`
- Cliquer "Se connecter avec Google"
- ✅ Auto-création utilisateur
- ✅ Si email `@afneus.org` → Statut BN automatique

## 📧 Configuration Emails (Resend)

### 1. Créer compte

1. [resend.com/signup](https://resend.com/signup)
2. Plan Free (3000 emails/mois)

### 2. Vérifier domaine

1. Dashboard → Domains → Add Domain
2. Domaine: `afneus.org`
3. Ajouter DNS records dans OVH :
   ```
   Type: TXT
   Nom: @
   Valeur: resend-domain-verify=xxx
   
   Type: MX
   Nom: @
   Priorité: 10
   Valeur: mx1.resend.com
   ```

### 3. API Key

1. Dashboard → API Keys → Create
2. Copier la clé `re_xxxxx`
3. Ajouter dans Supabase Secrets :
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxx
   ```

### 4. Déployer Edge Function

```bash
supabase login
supabase link --project-ref xxx
supabase functions deploy send-emails
```

### 5. Cron Job

Dans Supabase SQL Editor :

```sql
SELECT cron.schedule(
  'send-pending-emails',
  '*/5 * * * *',
  $$ 
  SELECT net.http_post(
    url := 'https://xxx.supabase.co/functions/v1/send-emails',
    headers := '{"Authorization": "Bearer xxx"}'::jsonb
  ) 
  $$
);
```

## 🏦 Export SEPA pour SG Pro

### 1. Créer lot de paiement

1. Se connecter comme TREASURER
2. Aller sur `/treasurer`
3. Sélectionner demandes validées
4. Cliquer "Générer SEPA"
5. Télécharger fichier XML

### 2. Importer dans SG Pro

1. [entreprises.secure.societegenerale.fr](https://entreprises.secure.societegenerale.fr/)
2. Menu: Virements → Virements SEPA multiples
3. Importer fichier XML
4. Vérifier montants
5. Valider avec code
6. Virements traités en J+1/J+2

**⚠️ IMPORTANT:** Mettre à jour l'IBAN AFNEUS dans :
- `.env.local` : `CREDITOR_IBAN=FR76...`
- `app/api/export/sepa/route.ts` ligne 69

## 🔧 API SNCF (Barèmes automatiques)

### 1. Créer compte Navitia

1. [navitia.io](https://www.navitia.io/)
2. S'inscrire (gratuit)
3. Créer application
4. Copier API Key

### 2. Configurer

```bash
# .env.local
SNCF_API_KEY=xxx
```

### 3. Utilisation

1. Admin → Événements → Créer événement
2. Définir ville de départ (ex: Paris)
3. Définir lieu (ex: Lyon)
4. Système récupère prix SNCF automatiquement 2 semaines avant
5. Calcule barèmes : BN 80%, Admin 65%, Autres 50%

## 📊 Structure Base de Données

```
users                  -- Utilisateurs (BN/Admin/Member)
├── events             -- Événements (AG, formations...)
│   ├── event_baremes  -- Barèmes spécifiques par événement
│   └── expense_claims -- Demandes de remboursement
│       └── expense_items -- Lignes de dépense détaillées
└── payment_batches    -- Lots de paiement SEPA

email_templates        -- Templates emails
└── email_queue        -- File d'envoi

sncf_price_history     -- Historique prix SNCF
```

## 🧪 Tests

```bash
# Tests unitaires
npm run test

# Tests E2E
npm run test:e2e

# Linter
npm run lint
```

## 🆘 Support

### Problèmes fréquents

**"Cannot read property 'role' of null"**
→ Vérifier que l'utilisateur existe dans `public.users`

**"CORS error" sur API Supabase**
→ Vérifier URL dans `.env.local`

**Emails non envoyés**
→ Vérifier que Edge Function est déployée et Cron Job actif

**Export SEPA rejeté par SG Pro**
→ Vérifier IBAN AFNEUS et format XML pain.001.001.03

### Contact

- Email: dev@afneus.org
- GitHub Issues: [github.com/AFNEUS/remboursement/issues](https://github.com/AFNEUS/remboursement/issues)

## 📄 Licence

MIT License - AFNEUS 2024-2025

---

**🎉 Site fonctionnel en 1h de configuration !**

1. ✅ Migration SQL (5 min)
2. ✅ Deploy Vercel (10 min)
3. ✅ Google OAuth (15 min)
4. ✅ Resend emails (20 min)
5. ✅ DNS OVH (10 min)

**Total : ~60 minutes** pour un système production-ready ! 🚀
