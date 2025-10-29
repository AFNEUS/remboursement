# Guide de déploiement - AFNEUS Remboursements

Ce guide détaille les étapes pour déployer l'application en production.

## Option 1 : Déploiement sur Vercel (recommandé)

### Prérequis

- Compte GitHub avec le repo
- Compte Vercel (gratuit pour hobby projects)
- Projet Supabase configuré
- Google Cloud Project configuré

### Étapes

1. **Pousser le code sur GitHub**

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/votre-org/afneus-remboursement.git
git push -u origin main
```

2. **Connecter à Vercel**

- Aller sur [vercel.com](https://vercel.com)
- Cliquer "Import Project"
- Sélectionner le repo GitHub
- Framework Preset : Next.js (auto-détecté)

3. **Configurer les variables d'environnement**

Dans Vercel Dashboard → Settings → Environment Variables, ajouter :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx... (⚠️ cocher "Encrypted")

GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx (⚠️ cocher "Encrypted")

GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" (⚠️ cocher "Encrypted")

GOOGLE_DRIVE_FOLDER_ID=1abc...
GOOGLE_SHEETS_ID=1def...

CREDITOR_IBAN=FR76...
CREDITOR_BIC=BNPAFRPPXXX

NEXT_PUBLIC_APP_URL=https://votre-domaine.vercel.app
NODE_ENV=production
```

4. **Déployer**

- Cliquer "Deploy"
- Attendre 2-3 minutes
- Vérifier le déploiement sur l'URL fournie

5. **Configurer le domaine personnalisé (optionnel)**

- Vercel Dashboard → Settings → Domains
- Ajouter votre domaine (ex: `remboursements.afneus.org`)
- Configurer les DNS selon les instructions

### Mises à jour automatiques

Chaque `git push` sur la branche `main` déclenche un nouveau déploiement automatique.

## Option 2 : Déploiement sur un VPS

### Prérequis

- VPS (Ubuntu 22.04 recommandé)
- Node.js 18+
- Nginx
- Certbot (SSL)

### Installation

1. **Installer Node.js**

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Cloner le repo**

```bash
cd /var/www
sudo git clone https://github.com/votre-org/afneus-remboursement.git
cd afneus-remboursement
```

3. **Installer les dépendances**

```bash
npm ci --production
```

4. **Créer le fichier .env.local**

```bash
sudo nano .env.local
# Copier les variables d'environnement
```

5. **Build l'application**

```bash
npm run build
```

6. **Configurer PM2 (process manager)**

```bash
sudo npm install -g pm2

# Créer un fichier ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'afneus-remboursement',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    instances: 2,
    exec_mode: 'cluster',
  }]
}
EOF

# Démarrer l'app
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

7. **Configurer Nginx**

```bash
sudo nano /etc/nginx/sites-available/afneus-remboursement

# Ajouter :
server {
    listen 80;
    server_name remboursements.afneus.org;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Activer le site
sudo ln -s /etc/nginx/sites-available/afneus-remboursement /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

8. **Installer SSL avec Let's Encrypt**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d remboursements.afneus.org
```

### Mises à jour

```bash
cd /var/www/afneus-remboursement
sudo git pull
npm ci --production
npm run build
pm2 restart afneus-remboursement
```

## Option 3 : Docker

### Dockerfile

```dockerfile
FROM node:18-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    restart: unless-stopped
```

### Déploiement

```bash
docker-compose up -d
```

## Post-déploiement

### 1. Configurer Google Apps Script

1. Ouvrir [script.google.com](https://script.google.com)
2. Créer nouveau projet "AFNEUS - Automatisations"
3. Copier les 3 scripts :
   - `sync-sheets.js`
   - `archive-drive.js`
   - `send-emails.js`
4. Configurer les variables (Supabase URL, API keys)
5. Stocker les secrets dans **Script Properties** (Project Settings → Script Properties)
6. Créer les déclencheurs (Triggers) :
   - `syncValidatedClaims` : Quotidien, 6h-7h
   - `archiveValidatedClaimsToDrive` : Quotidien, 7h-8h
   - `sendPendingNotifications` : Toutes les heures
   - `sendMissingJustificatifsReminders` : Quotidien, 9h-10h
   - `generateMonthlyReport` : Mensuel, 1er jour, 8h-9h

### 2. Seed initial de la base de données

Créer le premier utilisateur admin :

```sql
-- Dans Supabase SQL Editor
INSERT INTO public.users (id, email, full_name, role, iban_verified)
VALUES (
  'UUID_DE_VOTRE_COMPTE_GOOGLE',
  'tresorier@afneus.org',
  'Trésorier AFNEUS',
  'treasurer',
  true
);
```

Pour obtenir l'UUID :
1. Se connecter via Google OAuth
2. Aller dans Supabase → Authentication → Users
3. Copier l'UUID

### 3. Vérifications finales

- [ ] Tester la connexion Google OAuth
- [ ] Tester création d'une demande
- [ ] Vérifier upload de justificatifs (Supabase Storage)
- [ ] Tester workflow de validation
- [ ] Générer un export SEPA test
- [ ] Vérifier les notifications email
- [ ] Tester la sync Google Sheets
- [ ] Vérifier l'archivage Drive

### 4. Monitoring

**Supabase Dashboard :**
- Database → Logs
- Storage → Usage
- Auth → Users

**Vercel Dashboard (si applicable) :**
- Analytics
- Speed Insights
- Runtime Logs

**Google Apps Script :**
- View → Logs
- View → Executions

## Backup et sécurité

### Backups automatiques Supabase

Supabase effectue des backups automatiques (rétention selon le plan).

### Backup manuel

```bash
# Exporter la DB
npx supabase db dump -f backup.sql

# Exporter les Storage files
# Via Supabase Dashboard → Storage → Export
```

### Sécurité

1. **Activer 2FA** sur tous les comptes admin
2. **Rotation des secrets** tous les 90 jours
3. **Vérifier les RLS policies** régulièrement
4. **Monitorer les logs d'audit**
5. **Mettre à jour les dépendances** :

```bash
npm audit
npm update
```

## Troubleshooting

### Erreur "Invalid API key"

- Vérifier que les env vars sont bien configurées
- Redéployer après changement d'env vars

### Upload de fichiers échoue

- Vérifier les CORS dans Supabase Storage
- Vérifier les RLS policies du bucket

### Emails ne sont pas envoyés

- Vérifier Google Apps Script → Executions
- Vérifier les quotas Gmail API
- Vérifier les autorisations du Service Account

## Support

- Documentation : https://github.com/votre-org/afneus-remboursement/wiki
- Issues : https://github.com/votre-org/afneus-remboursement/issues
- Email : support@afneus.org
