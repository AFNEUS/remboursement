# 🚄 Guide : Remboursement Train avec Gares SNCF

## 📋 Résumé des améliorations

### ✅ Nouvelles fonctionnalités
1. **Recherche de gares SNCF** : Autocomplete avec vraies gares via API SNCF
2. **3 types de trajets** :
   - 🚄 Aller simple
   - 🔄 Aller-retour
   - 🗺️ Multi-destinations
3. **Stockage optimisé** : Segments de trajet en JSON dans la base de données
4. **API dédiée** : `/api/sncf/stations` pour rechercher les gares

## 📁 Fichiers créés/modifiés

### Nouveaux fichiers
- `components/TrainJourneyForm.tsx` : Composant de saisie des trajets train
- `app/api/sncf/stations/route.ts` : API de recherche de gares SNCF
- `supabase/migrations/001_train_segments.sql` : Migration pour stocker les segments

### Fichiers modifiés
- `app/claims/new/page.tsx` : Intégration du composant TrainJourneyForm

## 🔧 Configuration requise

### Variables d'environnement
```bash
# .env.local
SNCF_API_TOKEN=your-sncf-token-here
```

**Obtenir un token SNCF gratuit** :
1. Aller sur https://numerique.sncf.com/startup/api/token-developpeur/
2. S'inscrire (gratuit)
3. Créer un token
4. Ajouter dans `.env.local` et Vercel

## 📊 Structure des données

### Table `expense_items`

#### Nouveaux champs
```sql
-- Type de trajet
journey_type TEXT CHECK (journey_type IN ('ONE_WAY', 'ROUND_TRIP', 'MULTI_DESTINATION'))

-- Segments de trajet (JSON)
train_segments JSONB DEFAULT '[]'::jsonb
```

#### Exemple de données stockées
```json
{
  "expense_type": "TRAIN",
  "journey_type": "ROUND_TRIP",
  "departure": "Paris Gare de Lyon",
  "arrival": "Lyon Part-Dieu",
  "is_round_trip": true,
  "train_segments": [
    {
      "id": "1",
      "from": "Paris Gare de Lyon",
      "to": "Lyon Part-Dieu",
      "fromStation": {
        "id": "stop_area:SNCF:87686006",
        "name": "Paris Gare de Lyon",
        "quality": 9
      },
      "toStation": {
        "id": "stop_area:SNCF:87723197",
        "name": "Lyon Part-Dieu",
        "quality": 9
      },
      "date": "2024-11-15",
      "price": 45.00
    },
    {
      "id": "2",
      "from": "Lyon Part-Dieu",
      "to": "Paris Gare de Lyon",
      "fromStation": {...},
      "toStation": {...},
      "date": "2024-11-17",
      "price": 45.00
    }
  ],
  "amount": 90.00,
  "description": "Paris Gare de Lyon → Lyon Part-Dieu (2024-11-15) | Lyon Part-Dieu → Paris Gare de Lyon (2024-11-17)"
}
```

## 🎯 Utilisation

### 1. Aller simple
```
Utilisateur clique sur "🚄 Aller simple"
→ Tape "Paris" dans départ
→ Sélectionne "Paris Gare de Lyon" dans la liste
→ Tape "Lyon" dans arrivée
→ Sélectionne "Lyon Part-Dieu"
→ Entre le prix: 45€
→ Upload le billet PDF
```

### 2. Aller-retour
```
Utilisateur clique sur "🔄 Aller-retour"
→ Remplit l'aller (voir ci-dessus)
→ Le retour est créé automatiquement (gares inversées)
→ Peut modifier la date/prix du retour
→ Prix total = aller + retour
```

### 3. Multi-destinations
```
Utilisateur clique sur "🗺️ Multi-destinations"
→ Remplit le 1er trajet: Paris → Lyon
→ Clique "➕ Ajouter une destination"
→ Remplit le 2ème trajet: Lyon → Marseille (départ pré-rempli avec "Lyon")
→ Clique "➕ Ajouter une destination"
→ Remplit le 3ème trajet: Marseille → Nice
→ Prix total = somme de tous les trajets
```

## 🧪 Tests

### 1. Exécuter la migration SQL
```sql
-- Dans Supabase SQL Editor
-- Copier-coller le contenu de supabase/migrations/001_train_segments.sql
```

### 2. Tester l'API de recherche de gares
```bash
# Test local
curl http://localhost:3000/api/sncf/stations?q=Paris

# Réponse attendue
{
  "success": true,
  "query": "Paris",
  "stations": [
    {
      "id": "stop_area:SNCF:87686006",
      "name": "Paris Gare de Lyon",
      "quality": 9,
      "label": "Paris Gare de Lyon (Paris)",
      "coordinates": { "lat": 48.844, "lon": 2.373 }
    },
    ...
  ],
  "count": 10
}
```

### 3. Tester le formulaire
1. Aller sur `/claims/new`
2. Sélectionner "🚄 Train" comme type de dépense
3. Tester les 3 modes de trajet
4. Vérifier l'autocomplete des gares
5. Vérifier le résumé du trajet
6. Ajouter des billets (PDF/images)
7. Soumettre la demande

## 🚀 Déploiement

### 1. Exécuter la migration
```bash
# Dans Supabase Dashboard → SQL Editor
# Exécuter: supabase/migrations/001_train_segments.sql
```

### 2. Ajouter le token SNCF sur Vercel
```bash
# Vercel Dashboard → Settings → Environment Variables
SNCF_API_TOKEN=your-token-here
```

### 3. Build et deploy
```bash
npm run build
git add .
git commit -m "feat: Gares SNCF + trajets multi-destinations"
git push origin main
```

### 4. Vérification
```bash
# Vérifier que l'API fonctionne
curl https://votre-app.vercel.app/api/sncf/stations?q=Lyon

# Tester la création d'une demande avec train
# → Aller sur /claims/new
# → Remplir un trajet train
# → Vérifier que les données sont bien stockées dans expense_items
```

## 📝 Notes importantes

### Limites API SNCF
- Gratuit : **150 000 requêtes/mois** (5000/jour)
- Pas besoin de carte de crédit
- Délai de réponse : ~200-500ms

### Fallback sans token
Si le token SNCF n'est pas configuré :
- L'autocomplete ne fonctionnera pas
- L'utilisateur peut quand même taper les gares manuellement
- Message d'erreur affiché dans la console

### Données stockées
- Les segments sont stockés en JSON pour flexibilité
- Les champs `departure` et `arrival` contiennent la 1ère et dernière gare (pour recherche rapide)
- Le champ `is_round_trip` indique si c'est un A/R
- Le champ `journey_type` précise le type exact (ONE_WAY, ROUND_TRIP, MULTI_DESTINATION)

## 🔍 Débogage

### Problème : Autocomplete ne fonctionne pas
```bash
# Vérifier le token SNCF
echo $SNCF_API_TOKEN

# Tester l'API manuellement
curl -u "YOUR_TOKEN:" "https://api.sncf.com/v1/coverage/sncf/places?q=Paris&type[]=stop_area"
```

### Problème : Segments non sauvegardés
```sql
-- Vérifier la colonne existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'expense_items' 
AND column_name = 'train_segments';

-- Vérifier les données
SELECT id, expense_type, train_segments, journey_type 
FROM expense_items 
WHERE expense_type = 'TRAIN';
```

## ✅ Checklist finale

- [ ] Migration SQL exécutée
- [ ] Token SNCF configuré (local + Vercel)
- [ ] API `/api/sncf/stations` testée
- [ ] Formulaire aller simple testé
- [ ] Formulaire aller-retour testé
- [ ] Formulaire multi-destinations testé
- [ ] Upload de justificatifs testé
- [ ] Données correctement stockées en BDD
- [ ] Build réussi
- [ ] Déployé sur Vercel
- [ ] Test en production
