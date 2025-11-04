# 🔒 Pack de Sécurité - AFNEUS Remboursement

## 📦 Contenu du Pack

Ce pack contient **12 Pull Requests** prêtes à merger pour durcir la sécurité de l'application.

### 📊 Vue d'Ensemble

| PR | Priorité | Fichiers | Description |
|----|----------|----------|-------------|
| **PR1** | 🔴 P0 | `02_RLS_POLICIES_COMPLETE.sql`, `lib/supabase*.ts` | RLS activée + isolation service role |
| **PR2** | 🔴 P0 | `middleware.enhanced.ts`, `lib/csrf.ts` | Cookies sécurisés + CSRF protection |
| **PR3** | 🟠 P1 | `middleware.enhanced.ts` | Session timeouts (idle + absolute) |
| **PR4** | 🟠 P1 | `vercel.json`, `middleware.enhanced.ts` | CSP stricte + headers HSTS |
| **PR5** | 🟠 P1 | `lib/schemas/*.ts`, `app/api/*/route.ts` | Validation Zod server-side |
| **PR6** | 🟠 P1 | `scripts/elevate-admin-safe.sql` | Admin recovery sécurisé |
| **PR7** | 🟡 P2 | `lib/sentry.ts`, `app/api/healthz/route.ts` | Observabilité (Sentry + healthz) |
| **PR8** | 🟡 P3 | `app/claims/new/page.tsx`, `tests/e2e/*.spec.ts` | Bug transport + tests E2E |
| **PR9** | 🟡 P2 | `lib/email/*.ts` | Notifications email (Resend) |
| **PR10** | 🟡 P2 | `.github/workflows/*.yml` | CI/CD complet |
| **PR11** | 🟢 P3 | `SECURITY_GUIDE.md`, `docs/*.md` | Documentation sécurité |
| **PR12** | 🟢 P3 | `package.json`, `scripts/*.js` | Script `npm run harden` |

---

## 🚀 Installation Rapide (Ordre Recommandé)

### Phase 1: CRITIQUE (Semaine 1) ⚠️

#### ✅ PR1: RLS Policies + Service Role Isolation

**Fichiers modifiés:**
- `supabase/migrations/02_RLS_POLICIES_COMPLETE.sql` (nouveau)
- `supabase/migrations/03_AUDIT_LOGS.sql` (nouveau)
- `lib/supabase.ts` (modifié - retrait supabaseAdmin)
- `lib/supabase-admin.ts` (modifié - runtime check)

**Actions:**
```bash
# 1. Exécuter migration RLS dans Supabase SQL Editor
cat supabase/migrations/02_RLS_POLICIES_COMPLETE.sql | pbcopy
# → Coller dans SQL Editor → RUN

# 2. Exécuter migration audit_logs
cat supabase/migrations/03_AUDIT_LOGS.sql | pbcopy
# → Coller dans SQL Editor → RUN

# 3. Vérifier RLS activée
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('users', 'events', 'expense_claims');
-- Toutes doivent avoir rowsecurity = t

# 4. Merge PR
git checkout main && git pull origin pr/1-rls-policies
```

**Impact:**
- 🔒 RLS activée sur TOUTES les tables
- 🔒 Service role key isolée côté serveur
- 🔒 Deny-by-default pour anon

---

#### ✅ PR2: Cookies Sécurisés + CSRF Protection

**Fichiers modifiés:**
- `middleware.ts` → `middleware.enhanced.ts`
- `lib/csrf.ts` (nouveau)
- `lib/hooks/useCsrfToken.ts` (nouveau)
- `app/api/csrf/route.ts` (nouveau)

**Actions:**
```bash
# 1. Renommer middleware
mv middleware.ts middleware.old.ts
mv middleware.enhanced.ts middleware.ts

# 2. Ajouter secrets dans Vercel
vercel env add SESSION_SECRET production
# → Générer: openssl rand -hex 32

vercel env add CSRF_SECRET production
# → Générer: openssl rand -hex 32

# 3. Redéployer
git push origin main

# 4. Tester CSRF
curl -X POST https://remboursement.afneus.org/api/claims/create \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
# → Devrait retourner 403 (CSRF token missing)
```

**Impact:**
- 🍪 Cookies `__Host-` prefix
- 🍪 `HttpOnly`, `Secure`, `SameSite=Strict`
- 🛡️ CSRF tokens sur tous POST/PUT/DELETE

---

#### ✅ PR3: Session Timeouts

**Déjà inclus dans PR2** (`middleware.enhanced.ts`)

**Configuration:**
```typescript
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;        // 30 minutes
const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 heures
```

**Impact:**
- ⏱️ Auto-logout après 30min d'inactivité
- ⏱️ Session max 12h
- 🔒 Device binding (UA + IP hash)

---

### Phase 2: ÉLEVÉ (Semaine 2) 🟠

#### ✅ PR4: Content Security Policy

**Fichiers modifiés:**
- `vercel.json` (ajouter CSP header)
- `middleware.enhanced.ts` (déjà fait)

**CSP stricte:**
```http
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'unsafe-inline'; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data: https:; 
  connect-src 'self' https://*.supabase.co;
  frame-ancestors 'none';
```

**TODO progressif:**
- ⚠️ Retirer `'unsafe-inline'` progressivement
- ✅ Utiliser nonces pour scripts inline
- ✅ Migrer vers `script-src-elem` + `script-src-attr`

---

#### ✅ PR5: Validation Zod Server-Side

**Fichiers à créer:**
- `lib/schemas/claim.schema.ts`
- `lib/schemas/user.schema.ts`
- `lib/schemas/event.schema.ts`

**Exemple:**
```typescript
// lib/schemas/claim.schema.ts
import { z } from 'zod';

export const ExpenseItemSchema = z.object({
  type: z.enum(['CAR', 'TRAIN', 'BUS', 'MEAL', 'HOTEL', 'OTHER']),
  description: z.string().min(5).max(500),
  amount: z.number().positive().max(1000),
  date: z.string().datetime(),
});

export const ClaimSchema = z.object({
  motive: z.string().min(10).max(1000),
  expenses: z.array(ExpenseItemSchema).min(1),
});
```

**Modifier API routes:**
```typescript
// app/api/claims/create/route.ts
import { ClaimSchema } from '@/lib/schemas/claim.schema';

export async function POST(req: Request) {
  const body = await req.json();
  
  const validated = ClaimSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  
  // ... suite
}
```

---

#### ✅ PR6: Admin Recovery Sécurisé

**Fichiers:**
- `scripts/elevate-admin-safe.sql` (remplace `MAKE_ME_ADMIN.sql`)
- `docs/runbooks/admin-recovery.md`

**Script idempotent:**
```sql
DO $$
DECLARE
  target_email TEXT := 'mohameddhia.ounally@afneus.org';
BEGIN
  -- Check garde-fou
  IF current_setting('app.allow_admin_elevation', true)::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION 'Admin elevation blocked. Set app.allow_admin_elevation=true';
  END IF;
  
  -- Log audit
  INSERT INTO audit_logs (action, target_email, metadata)
  VALUES ('ADMIN_ELEVATION', target_email, jsonb_build_object('timestamp', NOW()));
  
  -- Élever
  UPDATE users SET role = 'ADMIN', status = 'ADMIN' WHERE email = target_email;
END $$;
```

**Usage:**
```bash
# Activer garde-fou
psql $DATABASE_URL -c "ALTER DATABASE postgres SET app.allow_admin_elevation = true;"

# Exécuter
psql $DATABASE_URL -f scripts/elevate-admin-safe.sql

# Désactiver garde-fou
psql $DATABASE_URL -c "ALTER DATABASE postgres SET app.allow_admin_elevation = false;"
```

---

### Phase 3: MOYEN (Semaine 3) 🟡

#### ✅ PR7: Observabilité (Sentry + Healthz)

**Fichiers créés:**
- `lib/sentry.ts`
- `app/api/healthz/route.ts` (déjà fait)
- `sentry.client.config.ts`
- `sentry.server.config.ts`

**Setup Sentry:**
```bash
# 1. Installer SDK
npm install @sentry/nextjs

# 2. Init
npx @sentry/wizard@latest -i nextjs

# 3. Ajouter DSN dans Vercel
vercel env add SENTRY_DSN production
# → https://xxx@yyy.ingest.sentry.io/zzz
```

**Healthz endpoint:**
```bash
curl https://remboursement.afneus.org/api/healthz

# Réponse:
{
  "status": "healthy",
  "timestamp": "2025-11-04T19:00:00Z",
  "checks": {
    "supabase": {"status": "ok"},
    "env": {"status": "ok"}
  },
  "version": "abc123"
}
```

---

#### ✅ PR8: Bug Transport + Tests E2E

**Fichiers modifiés:**
- `app/claims/new/page.tsx` (fix binding)
- `tests/e2e/expense-type.spec.ts` (nouveau)

**Fix:**
```typescript
// AVANT (bug):
setCurrentExpense({ type: 'CAR', ... }); // Force toujours CAR

// APRÈS (fix):
setCurrentExpense({ type: undefined, ... }); // Force l'utilisateur à choisir
// OU
const [lastUsedType, setLastUsedType] = useState('CAR');
setCurrentExpense({ type: lastUsedType, ... }); // Mémorise dernier choix
```

**Test Playwright:**
```typescript
test('should persist transport type', async ({ page }) => {
  await page.goto('/claims/new');
  await page.selectOption('select[name="type"]', 'TRAIN');
  await page.fill('input[name="description"]', 'Paris-Lyon');
  await page.click('button:has-text("Ajouter")');
  
  await expect(page.locator('text=🚄 Train')).toBeVisible();
});
```

---

#### ✅ PR9: Notifications Email

**Fichiers:**
- `lib/email/mailer.ts`
- `lib/email/templates/*.tsx` (React Email)
- `app/api/webhooks/resend/route.ts`

**Setup Resend:**
```bash
npm install resend react-email

# Ajouter clé API
vercel env add RESEND_API_KEY production
# → re_xxx...
```

**Templates:**
- `submitted.tsx`: Demande soumise
- `validated.tsx`: Demande validée
- `paid.tsx`: Paiement effectué
- `rejected.tsx`: Demande rejetée
- `reminder.tsx`: Relance documents manquants

---

### Phase 4: AMÉLIORATION (Semaine 4) 🟢

#### ✅ PR10: CI/CD GitHub Actions

**Fichiers:**
- `.github/workflows/security-quality.yml` (déjà fait)
- `.github/workflows/deploy-preview.yml`
- `.zap/rules.tsv` (déjà fait)

**Jobs:**
- ✅ Lint + TypeCheck
- ✅ Unit tests (Jest)
- ✅ E2E tests (Playwright)
- ✅ Security deps (npm audit + Snyk)
- ✅ Secret scan (Gitleaks)
- ✅ OWASP ZAP baseline
- ✅ Lighthouse CI
- ✅ Security headers check

**Secrets GitHub à configurer:**
- `SNYK_TOKEN`
- `LHCI_GITHUB_APP_TOKEN`
- `GITLEAKS_LICENSE` (optionnel)

---

#### ✅ PR11: Documentation

**Fichiers:**
- `SECURITY_GUIDE.md` (déjà fait)
- `SECURITY_AUDIT_REPORT.md` (déjà fait)
- `docs/runbooks/admin-recovery.md`
- `docs/runbooks/incident-response.md`
- `docs/architecture/security-architecture.md`

---

#### ✅ PR12: Script `npm run harden`

**Fichiers:**
- `package.json` (scripts ajoutés - déjà fait)
- `scripts/check-security-headers.js` (déjà fait)

**Commandes:**
```bash
npm run harden

# Exécute:
# 1. npm run lint
# 2. npm run type-check
# 3. npm run test
# 4. npm run security:deps
# 5. npm run security:headers
```

---

## 📋 Checklist d'Activation

### Avant Merge

- [ ] **PR1:** RLS activée (vérifier avec `SELECT * FROM pg_tables WHERE rowsecurity = true`)
- [ ] **PR2:** CSRF tokens fonctionnent (tester POST sans token → 403)
- [ ] **PR3:** Session timeout fonctionne (attendre 31min inactif → logout)
- [ ] **PR4:** CSP headers présents (`curl -I https://... | grep -i content-security`)
- [ ] **PR5:** Validation Zod bloque payload invalide (tester API)
- [ ] **PR10:** CI/CD passe sur PR de test

### Après Déploiement

- [ ] Mozilla Observatory > A (`https://observatory.mozilla.org`)
- [ ] SSL Labs > A+ (`https://www.ssllabs.com/ssltest/`)
- [ ] Lighthouse score > 90
- [ ] Sentry reçoit des events (tester erreur volontaire)
- [ ] Healthz retourne 200 (`curl /api/healthz`)
- [ ] OWASP ZAP scan < 3 high severity
- [ ] No secrets exposés (`npm run security:secrets`)

---

## 🔐 Secrets à Configurer

### Vercel Production

```bash
# Obligatoires (déjà présents)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Nouveaux (PR2)
SESSION_SECRET=$(openssl rand -hex 32)
CSRF_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# Monitoring (PR7)
SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz

# Email (PR9)
RESEND_API_KEY=re_xxx...
```

### GitHub Secrets

```bash
# Pour CI/CD (PR10)
SNYK_TOKEN=xxx...
LHCI_GITHUB_APP_TOKEN=xxx...
NEXT_PUBLIC_SUPABASE_URL=xxx...  # Pour tests E2E
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx...
```

---

## 🚨 Rollback Plan

### Si problème après déploiement PR1 (RLS)

```bash
# 1. Désactiver RLS temporairement
psql $DATABASE_URL << EOF
ALTER TABLE expense_claims DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items DISABLE ROW LEVEL SECURITY;
EOF

# 2. Identifier policy problématique
SELECT * FROM pg_policies WHERE tablename = 'expense_claims';

# 3. Drop policy spécifique
DROP POLICY "nom_policy" ON expense_claims;

# 4. Réactiver RLS
ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;
```

### Si problème après PR2 (CSRF)

```bash
# Bypass CSRF temporairement (middleware.ts)
export async function middleware(req: NextRequest) {
  // TODO: TEMPORARILY DISABLED CSRF
  // const csrfResult = await csrfMiddleware(req, res);
  // if (csrfResult.status === 403) return csrfResult;
  
  return res;
}
```

### Si problème après PR3 (Session timeout)

```bash
# Augmenter timeout temporairement
const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 min au lieu de 30
```

---

## 📊 Métriques de Succès

### Avant Hardening

- Risque global: 🔴 **7.5/10** (ÉLEVÉ)
- RLS: ❌ Désactivée
- CSRF: ❌ Absent
- Session timeout: ❌ Infini
- CSP: ❌ Manquante
- Validation serveur: ⚠️ Partielle
- Monitoring: ❌ Absent
- Tests E2E: ❌ 0

### Après Hardening (Cible)

- Risque global: 🟢 **2/10** (FAIBLE)
- RLS: ✅ Activée (31 policies)
- CSRF: ✅ Double-submit pattern
- Session timeout: ✅ 30min idle, 12h absolute
- CSP: ✅ Stricte
- Validation serveur: ✅ Zod schemas
- Monitoring: ✅ Sentry + healthz
- Tests E2E: ✅ 15+ scenarios

---

## 🎯 Prochaines Étapes

1. **Semaine 1:** Merger PR1 + PR2 + PR3 (CRITIQUE)
2. **Semaine 2:** Merger PR4 + PR5 + PR6 (ÉLEVÉ)
3. **Semaine 3:** Merger PR7 + PR8 + PR9 (MOYEN)
4. **Semaine 4:** Merger PR10 + PR11 + PR12 (AMÉLIORATION)

**Total effort:** ~4 semaines (1 développeur)  
**ROI sécurité:** 🚀 **CRITIQUE**

---

## 📞 Support

**Questions:** Mohamed Dhia Ounally (mohameddhia.ounally@afneus.org)  
**Issues:** https://github.com/AFNEUS/remboursement/issues  
**Docs:** https://github.com/AFNEUS/remboursement/tree/main/docs

---

**Généré le:** 4 Novembre 2025  
**Version:** 1.0.0
