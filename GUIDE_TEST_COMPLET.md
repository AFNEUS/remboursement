# 🧪 GUIDE DE TEST COMPLET - Site AFNEUS Remboursement

## ✅ PRÉREQUIS
- ✅ Base de données nettoyée et migrée (000_CLEAN_ALL_FIRST.sql + 000_master_init.sql)
- ✅ Serveur Next.js lancé (npm run dev sur http://localhost:3000)

---

## 📋 TESTS À EFFECTUER

### **1. CRÉER LES USERS DE TEST** (⏱️ 2 min)

```sql
-- Dans Supabase SQL Editor, exécute:
-- Fichier: TEST_CREATE_USER.sql
```

**Users créés:**
- `test@afneus.org` / `password123` (ADMIN + BN)
- `validator@afneus.org` / `password123` (VALIDATOR)

**Événement créé:**
- AG Annuelle 2025 (Lyon → Paris, 15 décembre 2025)

---

### **2. TEST CONNEXION** (⏱️ 3 min)

1. Va sur http://localhost:3000
2. Clique "Se connecter"
3. Entre:
   - Email: `test@afneus.org`
   - Password: `password123`
4. ✅ **Vérifier:** Tu arrives sur le Dashboard
5. ✅ **Vérifier:** Navbar affiche "Test BN" et bouton "Admin"

---

### **3. TEST CRÉATION DEMANDE VOITURE** (⏱️ 5 min)

1. Clique "Nouvelle demande"
2. Sélectionne événement "AG Annuelle 2025"
3. Description: "Déplacement AG Paris"
4. Ajoute une ligne de dépense:
   - Type: **Voiture**
   - Description: "Trajet Lyon → Paris"
   - Départ: Lyon
   - Arrivée: Paris
   - Distance: 470 km
   - Puissance fiscale: 5 CV
   - Aller-retour: ✅ Oui
   - Passagers: Ajoute 2 passagers (emails de membres)
5. ✅ **Vérifier:** Montant calculé automatiquement = **~600€**
   - Calcul: 470 km × 2 (A/R) × 0.606€/km (barème 5CV) × 1.10 (bonus 10% covoiturage)
6. Clique "Soumettre"
7. ✅ **Vérifier:** Message "Demande créée avec succès"

---

### **4. TEST CRÉATION DEMANDE TRAIN + TGVMAX** (⏱️ 5 min)

1. Clique "Nouvelle demande"
2. Sélectionne "AG Annuelle 2025"
3. Description: "Train + TGVMax AG"
4. Ajoute ligne Train:
   - Type: **Train**
   - Description: "TGV Lyon → Paris"
   - Montant: 85€
   - Type de train: TGV
   - Classe: 2nde
   - Carte jeune: ✅ Oui
5. Ajoute ligne TGVMax:
   - Type: **TGVMax**
   - Description: "Abonnement TGVMax novembre"
   - Montant: 79€
   - Période: Mensuel
   - Nombre d'utilisations: 4 trajets
   - Jours à proratiser: 15 (mi-mois)
6. ✅ **Vérifier:** Montant TGVMax calculé = **39.50€** (79€ × 15/30)
7. ✅ **Vérifier:** Total demande = Train + TGVMax proratisé
8. Soumettre

---

### **5. TEST CRÉATION DEMANDE REPAS + HÔTEL** (⏱️ 4 min)

1. Nouvelle demande "AG Annuelle 2025"
2. Description: "Repas et hébergement"
3. Ajoute ligne Repas:
   - Type: **Repas**
   - Description: "Déjeuner équipe"
   - Montant: 18€
   - Type de repas: Déjeuner
   - Invités: 3 personnes
4. ✅ **Vérifier:** Montant plafonné à **15€** (plafond lunch)
5. Ajoute ligne Hôtel:
   - Type: **Hôtel**
   - Description: "Hôtel Paris"
   - Montant: 110€
   - Nombre de nuits: 1
6. ✅ **Vérifier:** Montant plafonné à **90€** (max par nuit)
7. Upload justificatifs (factures PDF/JPG)
8. Soumettre

---

### **6. TEST DASHBOARD USER** (⏱️ 2 min)

1. Va sur Dashboard (page d'accueil après connexion)
2. ✅ **Vérifier:**
   - Nombre total de demandes: 3
   - Total demandé: ~700-800€
   - Statut: 3 en attente
   - Liste des demandes avec dates et montants
3. Clique sur une demande
4. ✅ **Vérifier:** Détails affichés (lignes, montants calculés, statut)

---

### **7. TEST VALIDATION (compte VALIDATOR)** (⏱️ 5 min)

1. Déconnexion (clique sur "Test BN" → Déconnexion)
2. Reconnexion avec:
   - Email: `validator@afneus.org`
   - Password: `password123`
3. ✅ **Vérifier:** Navbar affiche "Validator Test" et bouton "Validation"
4. Clique "Validation"
5. ✅ **Vérifier:** Liste des 3 demandes en attente
6. Clique sur la demande voiture
7. ✅ **Vérifier:** Détails complets:
   - Lignes de dépense avec calculs
   - Montant calculé auto vs montant saisi
   - Infos utilisateur (BN, IBAN)
8. Valide la demande:
   - Montant validé: 600€ (ou modifier)
   - Commentaire: "Validé - covoiturage confirmé"
9. ✅ **Vérifier:** Statut passe à "VALIDÉ"
10. Rejette une autre demande:
    - Motif: "Justificatif manquant"
11. ✅ **Vérifier:** Statut passe à "REJETÉ"

---

### **8. TEST ADMIN - GESTION ÉVÉNEMENTS** (⏱️ 3 min)

1. Reconnexion en `test@afneus.org` (ADMIN)
2. Clique "Admin"
3. Section Événements:
   - Clique "Créer événement"
   - Nom: "Formation Bureautique 2025"
   - Lieu: Toulouse
   - Ville départ: Marseille
   - Dates: 20-21 janvier 2025
   - Type: Formation
   - Publier
4. ✅ **Vérifier:** Événement créé
5. ✅ **Vérifier dans Supabase Table Editor:**
   - Table `event_baremes` a 9 lignes (CAR, TRAIN, TGVMAX, etc.)
   - Créées automatiquement par le trigger

---

### **9. TEST BARÈMES SNCF (si API configurée)** (⏱️ 3 min)

1. Admin → Événements
2. Clique sur "AG Annuelle 2025"
3. Onglet Barèmes
4. ✅ **Vérifier:** Liste des 9 barèmes
5. Clique sur barème "Train"
6. Voir:
   - Taux BN: 80%
   - Taux Admin: 65%
   - Taux Autres: 50%
   - Prix SNCF (si API configurée)
7. Modifier un barème:
   - BN rate: 85%
   - Max BN: 100€
   - Sauvegarder
8. ✅ **Vérifier:** Barème mis à jour

---

### **10. TEST EXPORT SEPA (TREASURER)** (⏱️ 4 min)

1. Mettre user `test@afneus.org` en TREASURER:
   ```sql
   UPDATE public.users 
   SET role = 'TREASURER' 
   WHERE email = 'test@afneus.org';
   ```
2. Reconnexion
3. ✅ **Vérifier:** Bouton "Trésorerie" dans navbar
4. Clique "Trésorerie"
5. ✅ **Vérifier:** Liste des demandes validées
6. Sélectionne demandes à payer
7. Clique "Créer lot SEPA"
8. ✅ **Vérifier:** Fichier XML téléchargé
9. Ouvre le XML:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
     <CstmrCdtTrfInitn>
       <PmtInf>
         <DbtrAcct>
           <Id><IBAN>FR76...</IBAN></Id>
         </DbtrAcct>
         <CdtTrfTxInf>
           <Amt><InstdAmt Ccy="EUR">600.00</InstdAmt></Amt>
           <CdtrAcct><Id><IBAN>FR76...</IBAN></Id></CdtrAcct>
         </CdtTrfTxInf>
       </PmtInf>
     </CstmrCdtTrfInitn>
   </Document>
   ```
10. ✅ **Vérifier:** Format SEPA valide pour Société Générale

---

### **11. TEST RESPONSIVE MOBILE** (⏱️ 2 min)

1. Ouvre DevTools (F12)
2. Mode mobile (Ctrl+Shift+M)
3. ✅ **Vérifier:**
   - Navbar hamburger menu
   - Dashboard lisible
   - Formulaire création demande utilisable
   - Tables scrollables horizontalement

---

### **12. TEST CALCULS AUTOMATIQUES** (⏱️ 2 min)

1. Dans Supabase SQL Editor:
   ```sql
   -- Test calcul voiture BN
   SELECT public.calculate_reimbursement(
     '33333333-3333-3333-3333-333333333333'::uuid,
     'CAR',
     100.00,
     '11111111-1111-1111-1111-111111111111'::uuid,
     '{"distance_km": 150, "fiscal_power": 5, "is_round_trip": true}'::jsonb
   );
   
   -- Test recommandation TGVMax
   SELECT public.is_tgvmax_worth_it(
     '11111111-1111-1111-1111-111111111111'::uuid,
     '33333333-3333-3333-3333-333333333333'::uuid,
     79.00
   );
   ```
2. ✅ **Vérifier:** Résultats JSON détaillés

---

## ✅ CHECKLIST FINALE

- [ ] Connexion fonctionne
- [ ] Dashboard affiche les demandes
- [ ] Création demande voiture + calcul auto
- [ ] Création demande train/TGVMax + proratisation
- [ ] Création demande repas/hôtel + plafonds
- [ ] Validation fonctionne (status change)
- [ ] Rejet fonctionne (motif enregistré)
- [ ] Admin peut créer événements
- [ ] Barèmes créés automatiquement
- [ ] Export SEPA génère XML valide
- [ ] Mobile responsive
- [ ] Calculs SQL fonctionnent

---

## 🐛 EN CAS DE PROBLÈME

### **Erreur "User not found"**
```sql
-- Vérifier que le trigger a créé le profil
SELECT * FROM public.users WHERE email = 'test@afneus.org';
```

### **Erreur calcul montant**
```sql
-- Vérifier barèmes existent
SELECT * FROM public.event_baremes WHERE event_id = '33333333-3333-3333-3333-333333333333';
```

### **Erreur "Unauthorized"**
```sql
-- Vérifier RLS policies
SELECT * FROM pg_policies WHERE tablename = 'expense_claims';
```

---

## 🎯 PROCHAINES ÉTAPES APRÈS LES TESTS

1. ✅ Configurer Google OAuth (todo list)
2. ✅ Configurer Resend emails
3. ✅ Déployer sur Vercel
4. ✅ Tester en production

**Bon test ! 🚀**
