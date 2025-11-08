# 🔒 Rapport d'Audit de Sécurité - AFNEUS Remboursement
**Date:** 4 Novembre 2025  
**Version:** 1.0.0  
**Auditeur:** GitHub Copilot Security Team  
**Portée:** Application complète (Frontend Next.js + Backend Supabase)

---

## 📋 Résumé Exécutif

### Niveau de Risque Global: **🟠 MOYEN-ÉLEVÉ**

| Catégorie | Risque | Criticité | Statut |
|-----------|--------|-----------|--------|
| **Architecture & Secrets** | 🔴 ÉLEVÉ | P0 | ⚠️ À corriger |
| **Auth & Sessions** | 🟠 MOYEN | P1 | ⚠️ À améliorer |
| **CSRF/XSS/CSP** | 🟡 FAIBLE | P2 | ⚠️ Incomplet |
| **RLS & Policies** | 🔴 ÉLEVÉ | P0 | ❌ Manquantes |
| **Migrations & Admin** | 🟠 MOYEN | P1 | ⚠️ Non sécurisé |
| **Validation Métier** | 🟠 MOYEN | P1 | ⚠️ Partielle |
| **Bug UI Transport** | 🟡 FAIBLE | P3 | 🐛 Confirmé |
| **Observabilité** | 🟠 MOYEN | P2 | ❌ Absente |

---

## 🔍 Découvertes Détaillées

### 1. 🚨 CRITIQUE: Architecture & Gestion des Secrets

#### 🔴 **RISQUE ÉLEVÉ: Service Role Key exposée côté client**

**Fichier:** `lib/supabase.ts`
```typescript
// ❌ DANGER: Service role key utilisée dans un fichier importable côté client
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {...});
```

**Impact:** 
- ⚠️ La `SUPABASE_SERVICE_ROLE_KEY` peut être bundlée dans le client Next.js
- ⚠️ Accès administrateur complet à la base de données si exposée
- ⚠️ Bypass total des Row Level Security policies

**Recommandation:** 
- ✅ Déplacer `supabaseAdmin` dans `lib/supabase-admin.ts` (serveur uniquement)
- ✅ N'importer `supabaseAdmin` QUE dans `/app/api/*` routes
- ✅ Ajouter un check runtime pour interdire l'usage côté client

#### 🟠 **Secrets manquants dans .env.example**

**Manquants:**
- `SESSION_SECRET` (pour signer les cookies de session)
- `CSRF_SECRET` (pour générer les tokens CSRF)
- `ENCRYPTION_KEY` (pour chiffrer les données sensibles)
- `SENTRY_DSN` (pour monitoring d'erreurs)

---

### 2. 🔒 Auth & Gestion des Sessions

#### 🟠 **Cookies non sécurisés**

**Fichier:** `middleware.ts`
```typescript
// ❌ Pas de configuration explicite des cookies
const supabase = createMiddlewareClient({ req, res });
```

**Problèmes:**
- ❌ Pas de préfixe `__Host-` sur les cookies
- ❌ Pas de `SameSite=Strict` forcé
- ❌ Pas de `HttpOnly` vérifié
- ❌ Pas de `Secure` en production

**Recommandation:**
```typescript
const supabase = createMiddlewareClient({ 
  req, 
  res,
  supabaseUrl,
  supabaseKey,
  options: {
    auth: {
      flowType: 'pkce',
      storage: {
        getItem: (key) => getCookie(key, { httpOnly: true, secure: true, sameSite: 'strict' }),
        setItem: (key, value) => setCookie(`__Host-${key}`, value, {...}),
        removeItem: (key) => deleteCookie(`__Host-${key}`)
      }
    }
  }
});
```

#### 🟠 **Pas de timeout de session**

**Problèmes:**
- ❌ Pas de timeout d'inactivité (idle timeout)
- ❌ Pas de durée maximale de session (absolute timeout)
- ❌ Session persiste indéfiniment

**Recommandation:**
- ✅ Idle timeout: 30 minutes
- ✅ Absolute timeout: 12 heures
- ✅ Implémenter via middleware Next.js

#### 🟠 **Access Token TTL trop long**

**Problème:** Par défaut Supabase utilise 1h pour l'access token

**Recommandation:**
- ✅ Réduire à 15 minutes
- ✅ Configurer dans Supabase Dashboard → Authentication → Settings
- ✅ Refresh token rotation activée

#### 🟠 **Pas de device binding**

**Recommandation:**
- ✅ Hasher (User-Agent + IP) et stocker dans session
- ✅ Vérifier à chaque requête
- ✅ Logout automatique si changement détecté

---

### 3. 🛡️ CSRF/XSS/CSP

#### 🟡 **CSRF tokens absents**

**Fichiers vulnérables:**
- `/app/claims/new/page.tsx` (soumission de demande)
- `/app/profile/page.tsx` (mise à jour profil)
- `/app/admin/users/page.tsx` (changement de rôle)

**Recommandation:**
```typescript
// Middleware CSRF
import { csrf } from '@/lib/csrf';

export async function middleware(req: NextRequest) {
  // ... auth checks ...
  
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const valid = await csrf.verify(req);
    if (!valid) {
      return NextResponse.json({ error: 'CSRF token invalid' }, { status: 403 });
    }
  }
  
  return res;
}
```

#### 🟡 **Content Security Policy manquante**

**Fichier:** `vercel.json` (headers partiels présents)
```json
// ❌ Manque CSP
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
}
```

**Recommandation:**
- ✅ Ajouter CSP stricte
- ✅ Retirer `'unsafe-inline'` et `'unsafe-eval'` progressivement
- ✅ Utiliser nonces pour les scripts inline

#### 🟢 **Headers de sécurité présents (partiel)**

**Fichier:** `vercel.json`
```json
✅ X-Frame-Options: DENY
✅ X-Content-Type-Options: nosniff
✅ Referrer-Policy: strict-origin-when-cross-origin
✅ Permissions-Policy: camera=(), microphone=(), geolocation=()
✅ X-XSS-Protection: 1; mode=block
❌ Content-Security-Policy: MANQUANT
❌ Strict-Transport-Security: MANQUANT
```

---

### 4. 🚨 CRITIQUE: Row Level Security (RLS)

#### 🔴 **RLS NON ACTIVÉE sur toutes les tables**

**Analyse SQL:** `supabase/migrations/01_INIT_COMPLETE.sql`

**Tables avec RLS:**
```sql
✅ public.users (SELECT/UPDATE policies)
❌ public.events (AUCUNE POLICY)
❌ public.event_baremes (AUCUNE POLICY)
❌ public.expense_claims (AUCUNE POLICY)
❌ public.expense_items (AUCUNE POLICY)
```

**Impact:**
- 🔴 **CRITIQUE:** N'importe quel utilisateur peut LIRE/MODIFIER/SUPPRIMER toutes les demandes
- 🔴 **CRITIQUE:** Accès non restreint aux événements et barèmes
- 🔴 **CRITIQUE:** Données financières (IBAN, montants) accessibles à tous

**Recommandation URGENTE:**

```sql
-- Enable RLS sur TOUTES les tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_baremes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

-- Policies expense_claims (exemple)
CREATE POLICY "Users can view own claims"
  ON public.expense_claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own claims"
  ON public.expense_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Validators can view all claims"
  ON public.expense_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('VALIDATOR', 'TREASURER', 'ADMIN')
    )
  );

CREATE POLICY "Treasurers can update claims"
  ON public.expense_claims FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('TREASURER', 'ADMIN')
    )
  );

-- DENY BY DEFAULT (anon)
CREATE POLICY "Deny anon access"
  ON public.expense_claims FOR ALL
  USING (auth.role() = 'authenticated');
```

---

### 5. 🔐 Migrations & Gestion Admin

#### 🟠 **MAKE_ME_ADMIN.sql non sécurisé**

**Fichier:** `MAKE_ME_ADMIN.sql`
```sql
-- ❌ Pas de garde-fou
-- ❌ Pas de log d'audit
-- ❌ Pas de limitation temporelle
UPDATE public.users SET role = 'ADMIN', status = 'ADMIN' WHERE email = 'mohameddhia.ounally@afneus.org';
```

**Recommandation:**
```sql
-- scripts/elevate-admin-safe.sql
DO $$
DECLARE
  target_email TEXT := 'mohameddhia.ounally@afneus.org';
  elevation_allowed BOOLEAN := current_setting('app.allow_admin_elevation', true)::BOOLEAN;
BEGIN
  IF NOT elevation_allowed THEN
    RAISE EXCEPTION 'Admin elevation not allowed. Set app.allow_admin_elevation=true';
  END IF;
  
  -- Log dans audit_log
  INSERT INTO public.audit_logs (action, actor_email, target_email, metadata)
  VALUES ('ADMIN_ELEVATION', current_user, target_email, jsonb_build_object('timestamp', NOW()));
  
  -- Update
  UPDATE public.users
  SET role = 'ADMIN', status = 'ADMIN', updated_at = NOW()
  WHERE email = target_email;
  
  RAISE NOTICE 'Admin elevation completed for %', target_email;
END $$;
```

#### 🟠 **Migrations non idempotentes**

**Problèmes:**
- ❌ Pas de `IF NOT EXISTS` systématique
- ❌ Pas de versioning clair
- ❌ Pas de rollback scripts

---

### 6. 🐛 Bug UI: Type de Transport

#### 🟡 **Bug confirmé: Train affiché comme Voiture**

**Fichier:** `app/claims/new/page.tsx` (ligne 360)

**Analyse:**
```typescript
// État initial TOUJOURS 'CAR'
const [currentExpense, setCurrentExpense] = useState<Partial<ExpenseItem>>({
  type: 'CAR',  // ❌ Défaut toujours CAR
  date: new Date().toISOString().split('T')[0],
  passengers: [],
});

// Reset après ajout garde le défaut
setCurrentExpense({
  type: 'CAR',  // ❌ Force toujours CAR
  date: new Date().toISOString().split('T')[0],
  passengers: [],
});
```

**Problème:** Le binding est correct (`value={currentExpense.type}`), mais le reset force toujours `CAR`.

**Recommandation:**
```typescript
// Option 1: Pas de défaut
const [currentExpense, setCurrentExpense] = useState<Partial<ExpenseItem>>({
  type: undefined,  // ✅ Force l'utilisateur à choisir
  date: new Date().toISOString().split('T')[0],
});

// Option 2: Mémoriser le dernier choix
const [lastUsedType, setLastUsedType] = useState<ExpenseType>('CAR');
setCurrentExpense({
  type: lastUsedType,  // ✅ Garde le dernier type utilisé
  ...
});
```

**Test E2E requis:**
```typescript
// tests/e2e/expense-type.spec.ts
test('should persist transport type when submitting claim', async ({ page }) => {
  await page.goto('/claims/new');
  await page.selectOption('select[name="type"]', 'TRAIN');
  await page.fill('input[name="description"]', 'Paris-Lyon');
  await page.fill('input[name="amount"]', '50');
  await page.click('button:has-text("Ajouter")');
  
  // Vérifier dans la liste
  await expect(page.locator('text=🚄 Train')).toBeVisible();
  
  // Soumettre et vérifier en DB
  await page.click('button:has-text("Soumettre")');
  // ... check DB
});
```

---

### 7. ❌ Observabilité Absente

#### 🟠 **Pas de monitoring d'erreurs**

**Recommandation:**
- ✅ Intégrer Sentry (client + server)
- ✅ Logger structuré avec request-id
- ✅ Endpoint `/api/healthz` pour healthchecks

```typescript
// lib/sentry.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filtrer secrets
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.['authorization'];
    }
    return event;
  },
});
```

---

### 8. 🔍 Validation Métier

#### 🟠 **Validation côté client uniquement**

**Fichiers:**
- `app/claims/new/page.tsx`: Validation dans `handleAddExpense()` (client-side)
- **AUCUNE validation côté serveur** dans `/app/api/claims/create/route.ts`

**Recommandation:**
```typescript
// lib/schemas/claim.schema.ts
import { z } from 'zod';

export const ExpenseItemSchema = z.object({
  type: z.enum(['CAR', 'TRAIN', 'BUS', 'MEAL', 'HOTEL', 'OTHER']),
  description: z.string().min(5).max(500),
  amount: z.number().positive().max(1000),
  date: z.string().datetime(),
  justificatifs: z.array(z.instanceof(File)).min(1).optional(),
  iban: z.string().regex(/^[A-Z]{2}\d{2}[A-Z0-9]+$/).optional(),
});

export const ClaimSchema = z.object({
  motive: z.string().min(10).max(1000),
  expenses: z.array(ExpenseItemSchema).min(1),
});

// app/api/claims/create/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  
  // ✅ Validation Zod
  const validated = ClaimSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  
  // ... suite
}
```

---

## 📊 Matrice de Risques

| Vulnérabilité | Prob. | Impact | Risque | Priorité |
|---------------|-------|--------|--------|----------|
| Service role key exposée | HAUTE | CRITIQUE | 🔴 **9/10** | P0 |
| RLS manquante | HAUTE | CRITIQUE | 🔴 **9/10** | P0 |
| Pas de CSRF tokens | MOYENNE | ÉLEVÉ | 🟠 **7/10** | P1 |
| Cookies non sécurisés | MOYENNE | ÉLEVÉ | 🟠 **7/10** | P1 |
| Pas de timeout session | MOYENNE | MOYEN | 🟠 **6/10** | P1 |
| CSP manquante | FAIBLE | MOYEN | 🟡 **5/10** | P2 |
| Validation serveur manquante | MOYENNE | MOYEN | 🟡 **5/10** | P2 |
| Bug UI transport | FAIBLE | FAIBLE | 🟡 **3/10** | P3 |

---

## 🎯 Plan de Remédiation (PRs)

### Phase 1: CRITIQUE (Semaine 1)
- ✅ **PR1:** Isoler service role key + RLS policies complètes
- ✅ **PR2:** Cookies sécurisés + CSRF tokens
- ✅ **PR3:** Session timeouts (idle + absolute)

### Phase 2: ÉLEVÉ (Semaine 2)
- ✅ **PR4:** Content Security Policy + headers manquants
- ✅ **PR5:** Validation Zod côté serveur
- ✅ **PR6:** Admin recovery sécurisé + audit logs

### Phase 3: MOYEN (Semaine 3)
- ✅ **PR7:** Observabilité (Sentry + logs + healthz)
- ✅ **PR8:** Notifications email pipeline
- ✅ **PR9:** CI/CD (tests + security scans)

### Phase 4: AMÉLIORATION (Semaine 4)
- ✅ **PR10:** Bug UI transport + tests E2E
- ✅ **PR11:** Documentation sécurité + runbooks
- ✅ **PR12:** Script `npm run harden`

---

## 🛠️ Outils Recommandés

### Audit Sécurité
- **OWASP ZAP** (DAST): Scan vulnérabilités runtime
- **Snyk**: Scan dépendances NPM
- **Mozilla Observatory**: Headers HTTP
- **SSL Labs**: Configuration TLS
- **GitHub Advanced Security**: Secret scanning

### Monitoring
- **Sentry**: Erreurs client/server
- **Vercel Analytics**: Performance
- **Supabase Logs**: Queries + Auth events

### Tests
- **Playwright**: Tests E2E
- **Jest**: Tests unitaires
- **SQL Unit Tests**: Policies RLS

---

## 📚 Checklist Production

### Avant Déploiement
- [ ] RLS activée sur TOUTES les tables
- [ ] Service role key UNIQUEMENT côté serveur
- [ ] Cookies: `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict`
- [ ] CSP stricte activée
- [ ] CSRF tokens sur tous POST/PUT/DELETE
- [ ] Validation Zod côté serveur
- [ ] Session timeout configuré (idle 30min, absolute 12h)
- [ ] Sentry configuré
- [ ] Tests E2E passent
- [ ] Secrets vérifiés (GitHub secret scan)
- [ ] Backup DB configuré
- [ ] Runbook admin recovery documenté

### Post-Déploiement
- [ ] Scan OWASP ZAP
- [ ] Lighthouse CI > 90
- [ ] Monitoring actif (Sentry + Vercel)
- [ ] Alertes configurées
- [ ] Plan de rollback testé

---

## 📝 Conclusion

**Risque actuel:** 🔴 **ÉLEVÉ** (7.5/10)  
**Risque cible:** 🟢 **FAIBLE** (2/10)  
**Effort estimé:** 4 semaines (1 développeur)  
**ROI sécurité:** 🚀 **CRITIQUE**

**Prochaines étapes immédiates:**
1. ⚠️ Activer RLS sur toutes les tables (bloque 1h)
2. ⚠️ Déplacer `supabaseAdmin` côté serveur uniquement (30min)
3. ⚠️ Configurer cookies sécurisés (2h)

---

**Fin du rapport**  
*Généré automatiquement le 4 Novembre 2025*
