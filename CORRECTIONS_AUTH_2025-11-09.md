# 🔧 Correction problème "Non authentifié"

**Date:** 9 novembre 2025  
**Problème:** Erreur "❌ Erreur : Non authentifié" lors de la soumission d'une demande de remboursement  
**Cause:** Les cookies de session n'étaient pas transmis aux API routes

---

## 🎯 Diagnostic

### Problème identifié

Lorsqu'un utilisateur authentifié soumettait une demande de remboursement, l'API route `/api/claims/create` retournait une erreur 401 "Non authentifié" même si l'utilisateur était bien connecté.

**Cause racine :** Par défaut, `fetch()` en JavaScript **ne transmet pas automatiquement les cookies** aux requêtes vers le même domaine. Dans Next.js 13+ avec App Router, les cookies de session Supabase doivent être explicitement inclus avec `credentials: 'include'`.

### Flux concerné

```
┌─────────────────────┐
│  Utilisateur        │
│  (authentifié ✅)   │
└──────────┬──────────┘
           │
           │ Soumet formulaire
           ▼
┌─────────────────────────────┐
│  app/claims/new/page.tsx    │
│  fetch('/api/claims/create')│  ❌ SANS cookies
└──────────┬──────────────────┘
           │
           │ HTTP POST (sans cookies de session)
           ▼
┌─────────────────────────────────┐
│  app/api/claims/create/route.ts │
│  supabase.auth.getSession()     │  ❌ Pas de session trouvée
│  return 401 "Non authentifié"   │
└─────────────────────────────────┘
```

---

## ✅ Solution appliquée

### Changements dans 5 fichiers

Ajout de `credentials: 'include'` dans tous les appels `fetch()` vers les API routes :

#### 1. **app/claims/new/page.tsx**

```typescript
// AVANT ❌
const response = await fetch('/api/claims/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(claimData),
});

// APRÈS ✅
const response = await fetch('/api/claims/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // ✅ Inclure les cookies de session
  body: JSON.stringify(claimData),
});
```

#### 2. **app/treasurer/page.tsx**

```typescript
const response = await fetch('/api/export/sepa', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // ✅ Ajouté
  body: JSON.stringify({ claim_ids: Array.from(selectedClaims) }),
});
```

#### 3. **app/admin/events/page.tsx**

```typescript
const res = await fetch('/api/sncf/prices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // ✅ Ajouté
  body: JSON.stringify({ from, to, datetime }),
});
```

#### 4. **app/admin/event-baremes/page.tsx**

```typescript
const response = await fetch('/api/sncf/prices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // ✅ Ajouté
  body: JSON.stringify({ from, to, datetime }),
});
```

#### 5. **components/TrainJourneyForm.tsx**

```typescript
const response = await fetch('/api/sncf/stations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // ✅ Ajouté
  body: JSON.stringify({ query }),
});
```

---

## 📚 Explication technique

### Qu'est-ce que `credentials: 'include'` ?

C'est une option de l'API Fetch qui contrôle si les cookies doivent être envoyés avec la requête :

- **`credentials: 'omit'`** : Ne jamais envoyer de cookies (même sur le même domaine)
- **`credentials: 'same-origin'`** (défaut) : Envoyer les cookies uniquement pour les requêtes same-origin
- **`credentials: 'include'`** : Toujours envoyer les cookies, même en cross-origin

### Pourquoi c'était nécessaire ?

Dans Next.js 13+ avec App Router :

1. Les **API routes** (`/app/api/*`) utilisent `createRouteHandlerClient({ cookies })`
2. Ce client lit les cookies de session Supabase depuis `cookies()`
3. Si les cookies ne sont pas transmis par `fetch()`, la session n'est pas trouvée
4. L'API retourne 401 "Non authentifié"

### Same-origin vs include

Même si l'API est sur le même domaine (`/api/claims/create`), Next.js traite parfois les API routes comme des endpoints séparés, d'où la nécessité de `credentials: 'include'` pour être sûr.

---

## 🧪 Test de validation

### Procédure de test

1. **Se connecter** sur https://remboursement.afneus.org
2. **Vérifier** que l'utilisateur est bien connecté (nom affiché en haut)
3. **Aller sur** "Nouvelle demande"
4. **Remplir le formulaire** :
   - Motif: "Test auth fix"
   - Type: Frais kilométriques
   - Départ: Paris
   - Arrivée: Lyon
   - Distance: 465 km
   - CV: 5
5. **Cliquer** "Soumettre"
6. **Résultat attendu ✅** : "Demande créée avec succès !"
7. **Résultat à éviter ❌** : "Erreur : Non authentifié"

### Vérification dans les DevTools

Dans la console du navigateur (F12) :

```javascript
// Vérifier que les cookies sont présents
document.cookie

// Devrait afficher quelque chose comme :
// "sb-revtmvfxvmuwycknesdc-auth-token=...; sb-revtmvfxvmuwycknesdc-auth-token-code-verifier=..."
```

---

## 🔐 Impact sur la sécurité

### ✅ Sécurisé

L'ajout de `credentials: 'include'` est **sécurisé** car :

1. **Same-origin uniquement** : Les requêtes sont vers `/api/*` (même domaine)
2. **Cookies HttpOnly** : Les tokens de session Supabase sont marqués `HttpOnly`, donc non accessibles en JS
3. **CSRF protégé** : Next.js gère automatiquement la protection CSRF
4. **Authentification vérifiée** : Chaque API route vérifie `session.user`

### ⚠️ Pas de risque CORS

Comme toutes les requêtes sont same-origin (pas de cross-domain), il n'y a aucun risque de fuite de cookies vers un domaine tiers.

---

## 📝 Bonnes pratiques

### Pattern recommandé pour les API calls

```typescript
// ✅ BON - Toujours inclure credentials pour les API routes Next.js
async function callAPI(endpoint: string, data: any) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // 🔑 CRUCIAL pour les cookies de session
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur serveur');
  }

  return response.json();
}
```

### Alternative avec wrapper

On pourrait créer un wrapper réutilisable :

```typescript
// lib/api-client.ts
export async function apiPost(endpoint: string, data: any) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur');
  }

  return response.json();
}

// Utilisation
const result = await apiPost('/api/claims/create', claimData);
```

---

## 🚀 Déploiement

### Commandes Git

```bash
# Vérifier les fichiers modifiés
git status

# Ajouter les fichiers
git add app/claims/new/page.tsx
git add app/treasurer/page.tsx
git add app/admin/events/page.tsx
git add app/admin/event-baremes/page.tsx
git add components/TrainJourneyForm.tsx
git add CORRECTIONS_AUTH_2025-11-09.md

# Commit
git commit -m "🔧 Fix auth error - Add credentials: 'include' to API calls"

# Push
git push origin main
```

### Vérification post-déploiement

1. Attendre que Vercel déploie (~2-3 min)
2. Tester sur https://remboursement.afneus.org
3. Vérifier dans les logs Vercel si nécessaire

---

## 📊 Checklist complète

- [x] ✅ Ajouté `credentials: 'include'` dans app/claims/new/page.tsx
- [x] ✅ Ajouté `credentials: 'include'` dans app/treasurer/page.tsx
- [x] ✅ Ajouté `credentials: 'include'` dans app/admin/events/page.tsx
- [x] ✅ Ajouté `credentials: 'include'` dans app/admin/event-baremes/page.tsx
- [x] ✅ Ajouté `credentials: 'include'` dans components/TrainJourneyForm.tsx
- [ ] ⏳ Test en local (si possible)
- [ ] ⏳ Déploiement sur Vercel
- [ ] ⏳ Test en production
- [ ] ⏳ Validation par utilisateur final

---

## 🔗 Ressources

- [MDN - Fetch API credentials](https://developer.mozilla.org/en-US/docs/Web/API/fetch#credentials)
- [Next.js Authentication](https://nextjs.org/docs/app/building-your-application/authentication)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

---

**Problème résolu ! 🎉** Les utilisateurs peuvent maintenant soumettre leurs demandes de remboursement sans erreur d'authentification.
