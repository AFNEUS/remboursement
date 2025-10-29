# 📋 RÉPONSE RAPIDE - Ce qu'il faut exécuter dans Supabase

## ✅ OUI, exécutez ces 3 fichiers dans l'ordre :

### 1️⃣ Premier fichier (OBLIGATOIRE)
**Fichier :** `/supabase/migrations/003_optimized_structure.sql`  
**Contenu :** Structure complète de la base de données
- 7 tables principales
- Fonction de calcul bonus covoiturage
- RLS (Row Level Security)
- Triggers automatiques

### 2️⃣ Deuxième fichier (OBLIGATOIRE)
**Fichier :** `/supabase/migrations/005_dashboard_and_stats.sql`  
**Contenu :** Vues statistiques pour le dashboard
- 7 vues SQL (global_statistics, monthly_accounting, etc.)
- Fonction get_dashboard_data()
- Analyse covoiturage et TGV Max

### 3️⃣ Troisième fichier (RECOMMANDÉ)
**Fichier :** `/supabase/migrations/006_init_bn_members.sql`  
**Contenu :** Initialisation des 12 membres du BN
- Vos 12 emails @afneus.org
- Attribution automatique statut BN à la première connexion
- Mohamed Dhia configuré comme ADMIN

---

## ⚠️ IMPORTANT - Ordre d'exécution

**Dans Supabase SQL Editor, exécutez dans CET ORDRE :**

```
1. Copier/coller 003_optimized_structure.sql → Run
2. Copier/coller 005_dashboard_and_stats.sql → Run  
3. Copier/coller 006_init_bn_members.sql → Run
```

**Ne PAS exécuter** `004_admin_accounts.sql` pour l'instant (c'est pour Google OAuth).

---

## 👥 Les 12 membres BN qui seront initialisés

Tous auront le statut **BN** (coefficient 1.20 pour le covoiturage) :

1. agathe.bares@afneus.org
2. anneclaire.beauvais@afneus.org
3. corentin.chadirac@afneus.org
4. emie.sanchez@afneus.org
5. eva.schindler@afneus.org
6. lucas.deperthuis@afneus.org
7. manon.soubeyrand@afneus.org
8. **mohameddhia.ounally@afneus.org** ⭐ (ADMIN)
9. rebecca.roux@afneus.org
10. salome.lance-richardot@afneus.org
11. thomas.dujak@afneus.org
12. yannis.loumouamou@afneus.org

---

## 📊 Ce que vous aurez après l'exécution

✅ Base de données complète avec :
- Gestion des membres et statuts
- Événements avec barèmes personnalisés
- Demandes de remboursement avec workflow
- Covoiturage intelligent avec bonus
- TGV Max et autres catégories de dépenses
- Dashboard statistiques complet
- 12 membres BN pré-enregistrés

✅ Pages fonctionnelles :
- `/dashboard` - Vue d'ensemble statistiques
- `/admin/events` - Gestion événements
- `/claims/new` - Nouvelle demande (avec types événements + alerte distance)

---

**Ensuite** vous pourrez tester l'application en mode test (voir GUIDE_DEPLOIEMENT.md)
