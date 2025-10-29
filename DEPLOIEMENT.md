# 🚀 Guide de Déploiement AFNEUS - Structure Optimisée

## ✅ Étape 1 : Exécuter les migrations dans Supabase

### 1.1 Accéder à Supabase SQL Editor
1. Va sur https://supabase.com
2. Sélectionne ton projet AFNEUS
3. Menu de gauche → **SQL Editor**
4. **New Query**

### 1.2 Exécuter les migrations dans l'ordre

**Migration 1** - Copie tout le contenu de `/supabase/migrations/003_optimized_structure.sql`
- Colle dans SQL Editor
- Clique sur **Run**
- Vérifie qu'il n'y a pas d'erreurs

**Migration 2** - Copie tout le contenu de `/supabase/migrations/004_admin_accounts.sql`
- Colle dans SQL Editor
- Clique sur **Run**

### 1.3 Vérifier que tout est créé
```sql
-- Exécute cette requête pour vérifier
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Tu devrais voir :
- ✅ member_statuses
- ✅ users
- ✅ events
- ✅ expense_claims
- ✅ expense_items
- ✅ justificatifs
- ✅ payment_batches

---

## ✅ Étape 2 : Configurer Google OAuth dans Supabase

### 2.1 Créer un projet Google Cloud
1. Va sur https://console.cloud.google.com
2. Crée un nouveau projet "AFNEUS Remboursements"
3. Active Google+ API

### 2.2 Créer les credentials OAuth
1. Menu → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID**
3. Type : **Web application**
4. Name : `AFNEUS Remboursements`
5. **Authorized JavaScript origins** :
   ```
   http://localhost:3000
   https://TON-DOMAINE.com
   ```
6. **Authorized redirect URIs** :
   ```
   https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/callback
   ```
7. Copie **Client ID** et **Client Secret**

### 2.3 Configurer Supabase
1. Supabase Dashboard → **Authentication** → **Providers**
2. Active **Google**
3. Colle le **Client ID** et **Client Secret**
4. **Authorized Client IDs** : Laisse vide
5. Clique **Save**

---

## ✅ Étape 3 : Créer les comptes admin

### 3.1 Demande aux admins de se connecter une première fois
1. Trésorier → Va sur http://localhost:3000
2. Clique sur **"Google"**
3. Se connecte avec son email Google Workspace AFNEUS
4. Pareil pour Vice-Trésorier et Admin système

### 3.2 Promouvoir les comptes
Dans Supabase SQL Editor, exécute :

```sql
-- Trésorier
SELECT promote_to_admin('tresorier@afneus.fr', 'treasurer', 'BN');

-- Vice-Trésorier
SELECT promote_to_admin('vice-tresorier@afneus.fr', 'treasurer', 'BN');

-- Admin système
SELECT promote_to_admin('admin@afneus.fr', 'admin', 'BN');
```

**Remplace les emails** par les vrais emails de ton Google Workspace !

---

## ✅ Étape 4 : Ajouter les membres du Bureau National

Quand les membres se connectent, exécute dans SQL Editor :

```sql
-- Pour chaque membre BN
UPDATE users 
SET status_code = 'BN'
WHERE email = 'membre@afneus.fr';

-- Pour les membres admins
UPDATE users 
SET status_code = 'ADMIN'
WHERE email = 'admin-membre@afneus.fr';

-- Pour les élus
UPDATE users 
SET status_code = 'ELU'
WHERE email = 'elu@afneus.fr';

-- etc...
```

---

## ✅ Étape 5 : Créer un événement test

Dans Supabase SQL Editor :

```sql
INSERT INTO events (name, description, date_start, date_end, location, custom_km_cap)
VALUES (
  'Formation Nationale 2025',
  'Formation annuelle du Bureau National',
  '2025-02-15',
  '2025-02-17',
  'Paris',
  0.12 -- Plafond km à 0.12€
);
```

---

## ✅ Étape 6 : Tester le workflow complet

### Test 1 : Demande simple
1. Connecte-toi en **Mode Utilisateur**
2. **Nouvelle demande**
3. Type : **Train**
4. Paris → Lyon, 85€
5. Upload billet
6. Soumettre

### Test 2 : Frais kilométriques avec covoiturage
1. **Nouvelle demande**
2. Type : **Frais kilométriques**
3. Paris → Lyon (distance auto : ~392km)
4. Ajoute 2 passagers "Apprenant.e"
5. Upload essence + péage
6. Vérifier que le montant est divisé par 3 !

### Test 3 : Validation
1. Déconnecte-toi
2. Connecte-toi avec compte **Trésorier**
3. Va sur **Validation**
4. Valide la demande
5. Vérifie le montant

### Test 4 : Export SEPA
1. En tant que Trésorier
2. Va sur **Trésorerie**
3. Sélectionne les demandes validées
4. **Export SEPA**
5. Télécharge le fichier XML

---

## 📧 Emails à me fournir

Envoie-moi la liste des membres avec :

```
Email | Nom complet | Statut | Rôle
tresorier@afneus.fr | Jean Dupont | BN | treasurer
vice-tresorier@afneus.fr | Marie Martin | BN | treasurer
admin@afneus.fr | Pierre Durand | BN | admin
membre1@afneus.fr | Sophie Bernard | APPRENANT | member
membre2@afneus.fr | Luc Robert | ADMIN | member
...
```

Et je créerai un script SQL pour tout insérer automatiquement !

---

## 🐛 En cas de problème

**Problème** : "Could not find column 'motive'"
**Solution** : Tu utilises l'ancien code, rafraîchis la page

**Problème** : Les calculs ne sont pas bons
**Solution** : Vérifie que les statuts membres sont bien insérés

**Problème** : Google OAuth ne marche pas
**Solution** : Vérifie les redirect URIs dans Google Console

---

## 🎯 Prochaines étapes

Une fois que tout marche :
1. Je finalise la page Validator avec vue consolidée
2. J'améliore la page Treasurer avec stats
3. On teste tout ensemble
4. Déploiement sur Vercel + domaine AFNEUS

**C'est parti ! 🚀**
