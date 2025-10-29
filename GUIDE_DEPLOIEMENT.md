# 🚀 Guide de Déploiement AFNEUS - Étape par Étape

**Date:** 29 octobre 2025  
**Version:** 1.0 - Structure optimisée avec Dashboard

---

## 📦 Ce qui a été implémenté

### ✅ Nouvelles fonctionnalités ajoutées

1. **🚗 Alerte distance approximative**
   - Message jaune indiquant que la distance voiture est calculée automatiquement
   - L'utilisateur peut la modifier manuellement si nécessaire

2. **📅 Types d'événements prédéfinis**
   - Congrès annuel AFNEUS
   - Week-end de passation
   - Formation
   - Réunion Bureau National
   - Réunion régionale
   - Événement externe
   - Autre
   - → Permet la comptabilité et statistiques par type d'événement

3. **🚄 Catégorie TGV Max**
   - Nouveau type de dépense pour les abonnements TGV Max
   - Suivi des membres avec abonnement actif dans le dashboard

4. **📊 Dashboard de visualisation complet** (`/dashboard`)
   - Statistiques globales (demandes, montants, économies)
   - Comptabilité mensuelle détaillée
   - Analyse covoiturage et économies pour AFNEUS
   - Événements récents avec statistiques
   - Suivi des abonnements TGV Max
   - Demandes en attente de validation

5. **🎯 Page gestion événements** (`/admin/events`)
   - Créer/modifier/supprimer des événements
   - Barèmes personnalisés par événement :
     - Taux kilométrique spécifique
     - Bonus covoiturage (activé/désactivé + plafond %)
     - Plafonds train/hôtel/repas spécifiques

6. **👥 Initialisation membres BN**
   - 12 membres du Bureau National pré-enregistrés
   - Attribution automatique du statut BN à la première connexion
   - Vue consolidée de l'état de connexion des membres

---

## 🗄️ Migrations SQL à exécuter

### Ordre d'exécution (IMPORTANT !)

Exécutez ces fichiers **dans l'ordre** via le **SQL Editor de Supabase** :

```
1️⃣ 003_optimized_structure.sql       ← BASE DE DONNÉES (tables, fonctions, RLS)
2️⃣ 005_dashboard_and_stats.sql       ← VUES STATISTIQUES (dashboard)
3️⃣ 006_init_bn_members.sql           ← MEMBRES BN (optionnel mais recommandé)
```

### ⚠️ Fichier 004 (à ignorer pour l'instant)

Le fichier `004_admin_accounts.sql` est pour Google OAuth. En mode test, vous n'en avez pas besoin.

---

## 📝 Procédure d'exécution dans Supabase

### Étape 1 : Ouvrir le SQL Editor

1. Allez sur [supabase.com](https://supabase.com)
2. Ouvrez votre projet AFNEUS
3. Cliquez sur **SQL Editor** dans le menu de gauche

### Étape 2 : Exécuter migration 003

1. Ouvrez le fichier `/supabase/migrations/003_optimized_structure.sql`
2. **Copiez TOUT le contenu** (421 lignes)
3. Collez dans le SQL Editor
4. Cliquez sur **Run** (en bas à droite)
5. ✅ Attendez le message de succès

**Vérification :**
```sql
-- Vérifier que les tables sont créées
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Doit afficher : events, expense_claims, expense_items, justificatifs, 
-- member_statuses, payment_batches, users
```

### Étape 3 : Exécuter migration 005

1. Ouvrez le fichier `/supabase/migrations/005_dashboard_and_stats.sql`
2. **Copiez TOUT le contenu**
3. Collez dans le SQL Editor
4. Cliquez sur **Run**
5. ✅ Attendez le message de succès

**Vérification :**
```sql
-- Vérifier que les vues sont créées
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Doit afficher : carpooling_analysis, claims_enriched, event_statistics,
-- expense_type_statistics, global_statistics, member_statistics, 
-- monthly_accounting, tgvmax_subscriptions
```

### Étape 4 : Exécuter migration 006 (Membres BN)

1. Ouvrez le fichier `/supabase/migrations/006_init_bn_members.sql`
2. **Copiez TOUT le contenu**
3. Collez dans le SQL Editor
4. Cliquez sur **Run**
5. ✅ Vous devriez voir les 12 membres BN affichés

**Vérification :**
```sql
-- Voir la liste des membres BN
SELECT * FROM bn_members_reference ORDER BY last_name;

-- Doit afficher 12 membres avec leurs emails @afneus.org
```

---

## 👥 Membres du Bureau National initialisés

| Email | Prénom | Nom | Statut | Rôle |
|-------|--------|-----|--------|------|
| agathe.bares@afneus.org | Agathe | Bares | BN | MEMBER |
| anneclaire.beauvais@afneus.org | Anne-Claire | Beauvais | BN | MEMBER |
| corentin.chadirac@afneus.org | Corentin | Chadirac | BN | MEMBER |
| emie.sanchez@afneus.org | Emie | Sanchez | BN | MEMBER |
| eva.schindler@afneus.org | Eva | Schindler | BN | MEMBER |
| lucas.deperthuis@afneus.org | Lucas | De Perthuis | BN | MEMBER |
| manon.soubeyrand@afneus.org | Manon | Soubeyrand | BN | MEMBER |
| **mohameddhia.ounally@afneus.org** | **Mohamed Dhia** | **Ounally** | **BN** | **ADMIN** ⭐ |
| rebecca.roux@afneus.org | Rebecca | Roux | BN | MEMBER |
| salome.lance-richardot@afneus.org | Salomé | Lance-Richardot | BN | MEMBER |
| thomas.dujak@afneus.org | Thomas | Dujak | BN | MEMBER |
| yannis.loumouamou@afneus.org | Yannis | Loumouamou | BN | MEMBER |

**Note :** Mohamed Dhia est configuré comme **ADMIN** (administrateur système).

---

## 🔍 Vérifications post-migration

### Test 1 : Structure de base
```sql
-- Compter les statuts membres
SELECT * FROM member_statuses ORDER BY coefficient DESC;
-- Doit afficher 8 statuts (BN, ADMIN, ELU, etc.)

-- Vérifier la fonction de calcul bonus
SELECT calculate_carpooling_bonus(
  100,                              -- 100 km
  '[{"status_code":"BN"}, {"status_code":"APPRENANT"}]'::jsonb
);
-- Doit retourner un montant > 0
```

### Test 2 : Dashboard
```sql
-- Statistiques globales (sera vide au début)
SELECT * FROM global_statistics;

-- Membres BN avec statut connexion
SELECT * FROM bn_members_status;
-- Doit afficher 12 membres, tous "Pas encore connecté"
```

### Test 3 : Événements
```sql
-- Créer un événement de test
INSERT INTO events (name, event_type, date_start, date_end, location, created_by)
VALUES (
  'Test Congrès AFNEUS 2025',
  'CONGRES_ANNUEL',
  '2025-11-15',
  '2025-11-17',
  'Paris',
  (SELECT id FROM users LIMIT 1)  -- Remplacer par votre user_id
);

-- Vérifier
SELECT * FROM events;
```

---

## 🧪 Mode Test (sans Google OAuth)

Pour tester l'application avant de configurer Google OAuth :

### Connexion Admin
```javascript
// Sur la page d'accueil, ouvrir la console navigateur (F12)
localStorage.setItem('test_user', JSON.stringify({
  id: 'test-admin-001',
  email: 'mohameddhia.ounally@afneus.org',
  role: 'ADMIN',
  status: 'BN',
  first_name: 'Mohamed Dhia',
  last_name: 'Ounally'
}));
// Puis recharger la page
```

### Connexion Membre standard
```javascript
localStorage.setItem('test_user', JSON.stringify({
  id: 'test-member-001',
  email: 'test.member@afneus.org',
  role: 'MEMBER',
  status: 'APPRENANT',
  first_name: 'Test',
  last_name: 'Member'
}));
```

---

## 📊 Nouvelles pages disponibles

### Pour tous les utilisateurs
- **`/dashboard`** - Vue d'ensemble statistiques et comptabilité
- **`/claims/new`** - Créer une demande (avec choix type d'événement + alerte distance)

### Pour les admins uniquement
- **`/admin/events`** - Gérer les événements et leurs barèmes
- **`/admin/tarifs`** - Configurer les plafonds généraux
- **`/admin/baremes`** - Gérer les taux kilométriques

---

## 🎯 Prochaines étapes

### Court terme (à faire maintenant)
1. ✅ Exécuter les 3 migrations SQL
2. ✅ Vérifier que les tables et vues sont créées
3. ✅ Tester le mode test (admin + membre)
4. ✅ Créer un événement de test dans `/admin/events`
5. ✅ Voir le dashboard dans `/dashboard`

### Moyen terme (à faire ensuite)
1. ⏳ Configurer Google OAuth dans Supabase
2. ⏳ Première connexion réelle des membres BN
3. ⏳ Créer les événements AFNEUS réels (Congrès 2025, etc.)
4. ⏳ Améliorer la page Validateur (`/validator`)
5. ⏳ Améliorer la page Trésorier (`/treasurer`)

---

## 🐛 Résolution de problèmes

### Erreur TypeScript dans VS Code
Les erreurs TypeScript sur les fichiers `.tsx` (notamment dans `/admin/events/page.tsx`) sont **normales** tant que les migrations ne sont pas exécutées. Une fois les tables créées dans Supabase, vous pouvez régénérer les types :

```bash
# Dans le terminal
npx supabase gen types typescript --project-id VOTRE_PROJECT_ID > lib/supabase/database.types.ts
```

### Les vues dashboard sont vides
C'est normal si vous n'avez pas encore de données. Créez une demande de test pour voir les statistiques apparaître.

### Impossible d'accéder à `/admin/events`
Vérifiez que vous êtes en mode test ADMIN (voir section "Mode Test" ci-dessus).

---

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez les logs SQL dans Supabase (SQL Editor → History)
2. Vérifiez la console navigateur (F12) pour les erreurs JavaScript
3. Vérifiez que vous êtes bien connecté en mode test

---

## 🎉 Résumé des améliorations

Cette version apporte :
- ✅ **Alerte distance approximative** pour les voitures
- ✅ **7 types d'événements** prédéfinis
- ✅ **Catégorie TGV Max** pour les abonnements
- ✅ **Dashboard complet** avec 7 vues statistiques SQL
- ✅ **Gestion événements** avec barèmes personnalisés
- ✅ **12 membres BN** pré-enregistrés avec auto-attribution
- ✅ **Comptabilité mensuelle** détaillée
- ✅ **Analyse covoiturage** et économies AFNEUS

**Économies estimées** : ~70% sur les frais kilométriques grâce au plafond 0.12€/km + bonus covoiturage plafonné à 40%.

---

**Bon déploiement ! 🚀**
