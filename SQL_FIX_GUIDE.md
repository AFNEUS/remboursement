# 🔧 SOLUTION : Corriger les erreurs SQL Supabase

## ❌ Problème rencontré
- Fichier `001_initial_schema.sql` génère des erreurs
- Aucune table créée dans Supabase
- Possibles erreurs : "relation auth.users does not exist" ou contraintes FK

## ✅ SOLUTION (3 étapes - 5 minutes)

### Étape 1 : Utiliser le fichier CORRIGÉ

**J'ai créé une version fixée** : `supabase/migrations/001_initial_schema_FIXED.sql`

**Corrections appliquées** :
- ✅ Gestion conditionnelle de la FK vers `auth.users`
- ✅ Ajout de `IF NOT EXISTS` partout
- ✅ `DROP TRIGGER/POLICY IF EXISTS` avant création
- ✅ Ajout de `iban_holder_name` dans table users
- ✅ Génération automatique de références (RMB-2024-000001)
- ✅ Message de succès à la fin

---

### Étape 2 : Exécuter dans Supabase Dashboard

**A. Ouvrir SQL Editor**
1. Aller sur [app.supabase.com](https://app.supabase.com)
2. Sélectionner votre projet
3. Cliquer sur **SQL Editor** (icône `</>` à gauche)

**B. Copier le fichier fixé**

```bash
# Dans votre terminal local :
cat supabase/migrations/001_initial_schema_FIXED.sql
```

Ou ouvrir le fichier avec :
```bash
code supabase/migrations/001_initial_schema_FIXED.sql
# ou
nano supabase/migrations/001_initial_schema_FIXED.sql
```

**C. Coller et exécuter**
1. Dans SQL Editor → **New query**
2. Coller TOUT le contenu du fichier `001_initial_schema_FIXED.sql`
3. Cliquer **Run** (ou `Ctrl+Enter`)

**D. Vérifier le succès**

Vous devriez voir ce message :
```
========================================
SCHÉMA CRÉÉ AVEC SUCCÈS !
========================================
Tables créées : 11
Vues créées : 3
Fonctions : 3
Triggers : 5
Policies RLS : 20+
```

---

### Étape 3 : Vérifier les tables créées

**A. Dans Database → Tables**
Vous devriez voir **11 tables** :
- ✅ users
- ✅ associations
- ✅ baremes
- ✅ taux_remboursement
- ✅ plafonds
- ✅ expense_claims
- ✅ justificatifs
- ✅ payment_batches
- ✅ audit_logs
- ✅ notifications
- ✅ config

**B. Vérifier les données par défaut**

Exécuter dans SQL Editor :
```sql
-- Vérifier barèmes kilométriques
SELECT * FROM public.baremes;
-- Devrait afficher 5 lignes (3CV à 7CV)

-- Vérifier taux remboursement
SELECT * FROM public.taux_remboursement;
-- Devrait afficher 3 lignes (BN 80%, Admin 65%, User 50%)

-- Vérifier plafonds
SELECT * FROM public.plafonds;
-- Devrait afficher 5 lignes (hotel, meal, train, car, registration)
```

---

## 🚨 Si vous avez toujours des erreurs

### Erreur : "permission denied for schema auth"
**Cause** : Auth schema pas activé  
**Solution** : Ignorez, le script gère automatiquement avec `DO $$`

### Erreur : "duplicate key value violates unique constraint"
**Cause** : Vous avez déjà exécuté le script  
**Solution** : 
```sql
-- Supprimer les tables existantes (⚠️ ATTENTION perte de données)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Puis réexécuter 001_initial_schema_FIXED.sql
```

### Erreur : "syntax error at or near..."
**Cause** : Copie partielle du fichier  
**Solution** : Vérifier que TOUT le fichier est copié (lignes 1 à 670 environ)

---

## ✅ Après succès : Prochaines étapes

### 1. Créer le bucket Storage (1 min)

**A. Aller dans Storage**
- Cliquer **Storage** (icône 📦 à gauche)

**B. Créer bucket**
- Cliquer **New bucket**
- Name : `justificatifs`
- Public : ❌ **NON** (laisser décoché pour RLS)
- Cliquer **Create**

**C. Configurer RLS pour le bucket**
Dans SQL Editor :
```sql
-- Policy pour upload (users peuvent upload leurs justificatifs)
CREATE POLICY "Users can upload their own justificatifs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'justificatifs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy pour lecture (users + validators)
CREATE POLICY "Users can view their own justificatifs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'justificatifs' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('treasurer', 'validator')
    )
  )
);
```

### 2. Activer Google Auth (fait dans SETUP_SUPABASE.md)

### 3. Redémarrer Next.js

```bash
# Tuer l'ancien processus
pkill -f "next dev"

# Relancer
npm run dev
```

### 4. Tester l'API

```bash
# Test simple (doit retourner {"claims":[],"total":0})
curl http://localhost:3000/api/claims/list?status=draft
```

---

## 📊 Comparaison : Ancien vs Nouveau

| Aspect | 001_initial_schema.sql (ANCIEN) | 001_initial_schema_FIXED.sql (NOUVEAU) |
|--------|--------------------------------|----------------------------------------|
| FK vers auth.users | ❌ Directe (crash si pas d'user) | ✅ Conditionnelle avec `DO $$` |
| Création tables | ❌ `CREATE TABLE` → erreur si existe | ✅ `CREATE TABLE IF NOT EXISTS` |
| Triggers | ❌ Erreur si existe déjà | ✅ `DROP TRIGGER IF EXISTS` avant |
| Policies | ❌ Erreur si existe déjà | ✅ `DROP POLICY IF EXISTS` avant |
| Références claims | ❌ Manquante | ✅ Auto-générée (RMB-2024-000001) |
| IBAN holder name | ❌ Manquant | ✅ Ajouté dans users |
| Message succès | ❌ Non | ✅ Affiche résumé à la fin |

---

## 🎯 Checklist finale

- [ ] Fichier `001_initial_schema_FIXED.sql` exécuté avec succès
- [ ] 11 tables visibles dans Database → Tables
- [ ] Barèmes, taux et plafonds contiennent des données
- [ ] Bucket `justificatifs` créé dans Storage
- [ ] Policies RLS activées sur le bucket
- [ ] `.env.local` rempli avec vos vraies clés Supabase
- [ ] Next.js relancé : `npm run dev`
- [ ] Test API : `curl http://localhost:3000/api/claims/list?status=draft`

**Si toutes les cases cochées** → Système 100% prêt ! 🎉

---

## 💡 Commandes rapides

```bash
# Copier le fichier fixé dans clipboard (Linux avec xclip)
cat supabase/migrations/001_initial_schema_FIXED.sql | xclip -selection clipboard

# Vérifier que .env.local est bon
grep SUPABASE_URL .env.local

# Relancer serveur
pkill -f "next dev" && npm run dev

# Tester homepage
curl -I http://localhost:3000
```

---

**Questions ?** Vérifier `SETUP_SUPABASE.md` pour le guide complet ! 📚
