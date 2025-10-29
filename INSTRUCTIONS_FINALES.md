# 🎯 INSTRUCTIONS FINALES AFNEUS - Corrections à faire

## 1. Correction de la structure de la base de données

La table `expense_claims` dans votre base Supabase a cette structure :
- `description` (pas `motive`)
- `amount_ttc` (pas `total_amount`)
- `expense_type`, `expense_date`, etc.

**MAIS** notre code utilise un modèle simplifié avec plusieurs dépenses par demande.

### Solution : Créer une nouvelle structure

Exécutez ce SQL dans Supabase Dashboard > SQL Editor :

```sql
-- Créer une table pour les demandes (claims) avec motif général
CREATE TABLE IF NOT EXISTS public.reimbursement_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motive TEXT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'validated', 'refused', 'paid')),
  submitted_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES public.users(id),
  validator_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Créer une table pour les lignes de dépenses (chaque dépense individuelle)
CREATE TABLE IF NOT EXISTS public.expense_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.reimbursement_requests(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  theoretical_max DECIMAL(10, 2),
  expense_date DATE NOT NULL,
  departure TEXT,
  arrival TEXT,
  distance_km DECIMAL(8, 2),
  fiscal_power INTEGER,
  is_round_trip BOOLEAN DEFAULT FALSE,
  passengers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Créer une table pour les justificatifs
CREATE TABLE IF NOT EXISTS public.expense_justificatifs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_line_id UUID NOT NULL REFERENCES public.expense_lines(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_requests_user ON public.reimbursement_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.reimbursement_requests(status);
CREATE INDEX IF NOT EXISTS idx_expense_lines_request ON public.expense_lines(request_id);
CREATE INDEX IF NOT EXISTS idx_justificatifs_expense ON public.expense_justificatifs(expense_line_id);

-- RLS Policies
ALTER TABLE public.reimbursement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_justificatifs ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs voient leurs propres demandes
CREATE POLICY "Users can view own requests" ON public.reimbursement_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own requests" ON public.reimbursement_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Les admins voient tout
CREATE POLICY "Admins view all requests" ON public.reimbursement_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('treasurer', 'validator', 'admin')
    )
  );
```

## 2. Logique des frais kilométriques

Pour les frais de voiture, on doit :
1. Demander les **dépenses réelles** (essence + péage)
2. Calculer le **montant plafonné** selon le barème (0.636€/km pour 5CV par exemple)
3. Rembourser **le MINIMUM entre les deux**

### Exemple :
- Trajet Paris-Lyon : 392 km aller-retour = 784 km
- Montant plafonné : 784 km × 0.636€ = **498.62€**
- Dépenses réelles : Essence 65€ + Péage 48€ = **113€**
- **On rembourse 113€** (le minimum)

Si les dépenses réelles dépassent le plafond, on alerte l'utilisateur.

## 3. Membres du Bureau National à ajouter

Une fois la base prête, créez les utilisateurs admin avec ce SQL :

```sql
INSERT INTO public.users (id, email, full_name, role, is_active, iban_verified)
VALUES
  -- Remplacez par les vrais IDs UUID de Google Auth
  ('UUID_1', 'president@afneus.fr', 'Prénom NOM Président', 'admin', true, true),
  ('UUID_2', 'tresorier@afneus.fr', 'Prénom NOM Trésorier', 'treasurer', true, true),
  ('UUID_3', 'validateur@afneus.fr', 'Prénom NOM Validateur', 'validator', true, true);
```

## 4. Configuration Google OAuth

1. Allez sur [Google Cloud Console](https://console.cloud.google.com)
2. Créez un nouveau projet "AFNEUS Remboursements"
3. Activez l'API Google OAuth
4. Créez des identifiants OAuth 2.0 :
   - Authorized JavaScript origins: `https://revtmvfxvmuwycknesdc.supabase.co`
   - Authorized redirect URIs: `https://revtmvfxvmuwycknesdc.supabase.co/auth/v1/callback`
5. Copiez Client ID et Client Secret
6. Dans Supabase Dashboard > Authentication > Providers > Google :
   - Collez Client ID et Client Secret
   - Activez le provider

## 5. Tests à faire

### Test Utilisateur :
1. Se connecter en Mode Utilisateur
2. Créer une demande de frais kilométriques :
   - Paris → Lyon (392 km)
   - 5 CV, Aller-retour
   - Ajouter 1 passager (covoiturage)
   - Essence : 65€, Péage : 48€
   - Upload justificatifs
3. Soumettre
4. Vérifier que le montant est correct (divisé par 2 pour le covoiturage)

### Test Admin :
1. Se connecter en Mode Admin
2. Aller sur /validator
3. Voir la demande en attente
4. Vérifier les justificatifs
5. Valider ou refuser
6. Aller sur /treasurer
7. Exporter en SEPA

## 6. Checklist finale

- [ ] Exécuter le SQL de création des nouvelles tables
- [ ] Adapter le code de soumission pour utiliser les nouvelles tables
- [ ] Configurer Google OAuth
- [ ] Ajouter les membres du BN
- [ ] Tester le workflow complet
- [ ] Vérifier les calculs de plafonnement
- [ ] Tester le covoiturage
- [ ] Tester l'export SEPA

## 7. Prochaines étapes après votre validation

Donnez-moi la liste des membres du BN avec :
- Nom complet
- Email
- Rôle (président, trésorier, secrétaire, etc.)

Je créerai ensuite le SQL pour les insérer automatiquement.
