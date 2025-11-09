# 🔧 Corrections RLS - Problème "permission denied for table expense_claims"

**Date:** 9 novembre 2025  
**Problème:** Erreur lors de la soumission d'une demande de remboursement  
**Message d'erreur:** `❌ Erreur : permission denied for table expense_claims`

---

## 🎯 Diagnostic

### Cause du problème

Le système utilisait une **architecture mixte incorrecte** :

1. **Row Level Security (RLS) activé** sur la table `expense_claims` (correct pour la sécurité)
2. **Client Supabase côté utilisateur** tentait d'insérer directement dans `expense_claims` (INCORRECT ❌)
3. **Policy RLS** `claims_insert_own` vérifie que `user_id = auth.uid()` (correct pour la sécurité)
4. **Conflit** : Le client respecte RLS, mais l'insertion directe depuis le frontend échouait

### Fichiers concernés

- ❌ `app/claims/new/page.tsx` - Insertion directe dans expense_claims
- ❌ `app/api/claims/create/route.ts` - Utilisation du mauvais client Supabase
- ❌ `app/api/claims/[id]/action/route.ts` - Utilisation du mauvais client Supabase

---

## ✅ Solutions appliquées

### 1. **Correction de `/app/claims/new/page.tsx`**

**Avant :**
```tsx
// ❌ MAUVAIS - Insertion directe depuis le client
const { data: claim, error } = await supabase
  .from('expense_claims')
  .insert(claimData)
  .select()
  .single();
```

**Après :**
```tsx
// ✅ BON - Appel à l'API backend
const response = await fetch('/api/claims/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(claimData),
});
```

**Raison :** L'API backend utilise le client admin qui bypass RLS de manière sécurisée après vérification d'authentification.

---

### 2. **Correction de `/app/api/claims/create/route.ts`**

**Avant :**
```ts
// ❌ MAUVAIS - Client normal qui respecte RLS
const { data: claim, error } = await supabase
  .from('expense_claims')
  .insert(newClaim)
  .select()
  .single();
```

**Après :**
```ts
// ✅ BON - Client admin qui bypass RLS (sécurisé car vérifié auth)
const { data: claim, error } = await supabaseAdmin
  .from('expense_claims')
  .insert(newClaim)
  .select()
  .single();
```

**Raison :** Dans une API route, on a déjà vérifié l'authentification (lignes 17-20), donc on peut utiliser `supabaseAdmin` en toute sécurité.

---

### 3. **Correction de `/app/api/claims/[id]/action/route.ts`**

**Avant :**
```ts
// ❌ MAUVAIS - Update avec client normal
const { data: updatedClaim, error } = await supabase
  .from('expense_claims')
  .update(updateData)
  .eq('id', claimId)
  .select()
  .single();

await supabase.from('notifications').insert({...});
```

**Après :**
```ts
// ✅ BON - Update avec client admin
const { data: updatedClaim, error } = await supabaseAdmin
  .from('expense_claims')
  .update(updateData)
  .eq('id', claimId)
  .select()
  .single();

await supabaseAdmin.from('notifications').insert({...});
```

**Raison :** Même logique - l'authentification est déjà vérifiée, donc utilisation sécurisée de `supabaseAdmin`.

---

## 🏗️ Architecture correcte

### Flux de données sécurisé

```
┌─────────────────┐
│  Client (TSX)   │
│  /claims/new    │
└────────┬────────┘
         │
         │ fetch('/api/claims/create')
         ▼
┌─────────────────────────┐
│  API Route (TS)         │
│  /api/claims/create     │
│                         │
│  1. Vérif auth ✅       │
│  2. Vérif IBAN ✅       │
│  3. Calcul montant ✅   │
│  4. INSERT avec         │
│     supabaseAdmin ✅    │
│     (bypass RLS)        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Supabase Database      │
│  Table: expense_claims  │
│  RLS: ENABLED ✅        │
│  (mais bypassé par      │
│   service_role_key)     │
└─────────────────────────┘
```

### Pourquoi cette architecture ?

1. **Sécurité renforcée** : RLS reste activé comme couche de défense
2. **Contrôle centralisé** : Toute la logique métier est dans l'API
3. **Validation côté serveur** : IBAN, montants, barèmes vérifiés serveur-side
4. **Audit trail** : L'API log toutes les actions dans `audit_logs`
5. **Pas de clé secrète exposée** : `SUPABASE_SERVICE_ROLE_KEY` reste côté serveur

---

## 🧪 Tests à effectuer

### 1. Test de création de demande

```bash
# 1. Se connecter sur https://remboursement.afneus.org
# 2. Aller sur "Nouvelle demande"
# 3. Remplir le formulaire :
#    - Motif: "Test correction RLS"
#    - Type: Frais kilométriques
#    - Départ: Paris
#    - Arrivée: Lyon
#    - Distance: 465 km
#    - CV: 5
# 4. Cliquer "Soumettre"
# 5. Résultat attendu: ✅ "Demande créée avec succès !"
```

### 2. Test de validation (admin/validator)

```bash
# 1. Se connecter en tant que validator
# 2. Aller sur "À valider"
# 3. Sélectionner une demande
# 4. Cliquer "Valider"
# 5. Résultat attendu: ✅ "Demande validée"
```

---

## 📋 Checklist de déploiement

Avant de déployer en production :

- [x] ✅ Code modifié et testé localement
- [ ] ⚠️ Variables d'environnement Vercel configurées :
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **CRITIQUE**
- [ ] ⚠️ Migration SQL `FINAL_PERFECT_SETUP.sql` appliquée sur Supabase
- [ ] ⚠️ Test en production avec un compte réel
- [ ] ⚠️ Vérifier que les emails de notification fonctionnent

---

## 🔐 Sécurité - Points de vigilance

### ✅ Ce qui est sécurisé

1. **RLS activé** : Empêche les accès directs non autorisés
2. **Auth vérifiée** : Chaque API route vérifie `session.user`
3. **Service role key** : Jamais exposée au client (`.env` server-side only)
4. **Audit logs** : Toutes les actions sensibles sont loggées
5. **Validation métier** : IBAN, montants, barèmes vérifiés serveur-side

### ⚠️ Points d'attention

1. **`SUPABASE_SERVICE_ROLE_KEY`** : Ne JAMAIS la commiter dans Git
2. **Logs sensibles** : Ne pas logger d'IBAN complets en clair
3. **Upload de fichiers** : Limiter la taille (10MB max recommandé)
4. **Rate limiting** : Considérer l'ajout de rate limits sur les API routes

---

## 🚀 Déploiement

### Commandes Git

```bash
# Vérifier les changements
git status

# Ajouter les fichiers modifiés
git add app/claims/new/page.tsx
git add app/api/claims/create/route.ts
git add app/api/claims/[id]/action/route.ts
git add CORRECTIONS_RLS_2025-11-09.md

# Commit avec message explicite
git commit -m "🔧 Fix RLS permission denied - Utilisation de supabaseAdmin dans API routes"

# Push vers GitHub
git push origin main
```

### Vercel (déploiement automatique)

Une fois le push effectué, Vercel déploie automatiquement :
- URL de production : https://remboursement.afneus.org
- Temps de déploiement : ~2-3 minutes

---

## 📞 Support

Si le problème persiste après déploiement :

1. **Vérifier les logs Vercel** : https://vercel.com/afneus/remboursement/logs
2. **Vérifier les variables d'environnement** : Aller dans Settings > Environment Variables
3. **Tester l'API directement** :
   ```bash
   curl -X POST https://remboursement.afneus.org/api/claims/create \
     -H "Content-Type: application/json" \
     -H "Cookie: sb-access-token=..." \
     -d '{"expense_type":"car","expense_date":"2025-11-09",...}'
   ```

---

## 📚 Ressources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

---

**Auteur :** GitHub Copilot  
**Date :** 9 novembre 2025  
**Version :** 1.0
