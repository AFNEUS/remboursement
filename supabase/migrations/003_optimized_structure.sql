-- ============================================
-- MIGRATION 003: Structure optimisée AFNEUS
-- ============================================

-- Activer UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Table des statuts membres
-- ============================================
CREATE TABLE IF NOT EXISTS public.member_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  coefficient DECIMAL(4,3) NOT NULL,
  description TEXT,
  display_order INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertion des statuts avec coefficients
INSERT INTO public.member_statuses (code, label, coefficient, description, display_order) VALUES
  ('BN', 'Bureau National', 1.200, 'Membres du Bureau National', 1),
  ('ADMIN', 'Membre administrateur', 1.100, 'Membres administrateurs', 2),
  ('ELU', 'Élu.e', 1.100, 'Membres élus', 3),
  ('OBSERVATEUR', 'Membre observateur', 1.075, 'Membres observateurs', 4),
  ('FORMATEUR', 'Formateur.ice', 1.050, 'Formateurs', 5),
  ('CDV', 'CDV', 1.050, 'Chargés de développement ville', 6),
  ('APPRENANT', 'Apprenant.e', 1.030, 'Apprenants', 7),
  ('AUTRE', 'Autres', 1.000, 'Autres membres', 8)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. Table users enrichie
-- ============================================
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  
  -- Rôle système
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'validator', 'treasurer', 'admin')),
  
  -- Statut membre (pour calcul bonus covoiturage)
  status_code TEXT REFERENCES member_statuses(code) DEFAULT 'AUTRE',
  
  -- Infos bancaires
  iban TEXT,
  iban_verified BOOLEAN DEFAULT false,
  
  -- Métadonnées
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status_code);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active);

-- ============================================
-- 3. Table des événements
-- ============================================
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'AUTRE' CHECK (event_type IN (
    'CONGRES_ANNUEL',      -- Congrès annuel AFNEUS
    'WEEKEND_PASSATION',   -- Week-end de passation
    'FORMATION',           -- Formation des membres
    'REUNION_BN',          -- Réunion Bureau National
    'REUNION_REGION',      -- Réunion régionale
    'EVENEMENT_EXTERNE',   -- Événement externe (partenaires, etc.)
    'AUTRE'                -- Autre type
  )),
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  location TEXT,
  
  -- Barèmes personnalisés pour cet événement
  custom_km_rate DECIMAL(5,3), -- Taux au km (NULL = utiliser barème par défaut)
  custom_km_cap DECIMAL(5,3) DEFAULT 0.12, -- Plafond km max
  allow_carpooling_bonus BOOLEAN DEFAULT true,
  carpooling_bonus_cap_percent INTEGER DEFAULT 40, -- Bonus max en % (40%)
  
  -- Plafonds spécifiques
  max_train_amount DECIMAL(10,2),
  max_hotel_per_night DECIMAL(10,2),
  max_meal_amount DECIMAL(10,2),
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_dates ON public.events(date_start, date_end);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(event_type);

-- ============================================
-- 4. Table des demandes de remboursement
-- ============================================
DROP TABLE IF EXISTS public.expense_claims CASCADE;

CREATE TABLE public.expense_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Lien utilisateur et événement
  user_id UUID REFERENCES users(id) NOT NULL,
  event_id UUID REFERENCES events(id), -- Optionnel
  
  -- Description
  description TEXT NOT NULL,
  
  -- Statut
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'validated', 'rejected', 'paid')),
  
  -- Montants
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  validated_amount DECIMAL(10,2), -- Peut être ajusté par validateur
  
  -- Validation
  validator_id UUID REFERENCES users(id),
  validated_at TIMESTAMPTZ,
  validation_comment TEXT,
  rejected_reason TEXT,
  
  -- Paiement
  payment_batch_id UUID, -- Lien vers lot de paiement SEPA
  paid_at TIMESTAMPTZ,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_claims_user ON public.expense_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.expense_claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_event ON public.expense_claims(event_id);
CREATE INDEX IF NOT EXISTS idx_claims_validator ON public.expense_claims(validator_id);
CREATE INDEX IF NOT EXISTS idx_claims_created ON public.expense_claims(created_at DESC);

-- ============================================
-- 5. Table des lignes de dépense
-- ============================================
CREATE TABLE IF NOT EXISTS public.expense_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID REFERENCES expense_claims(id) ON DELETE CASCADE NOT NULL,
  
  -- Type et description
  expense_type TEXT NOT NULL CHECK (expense_type IN (
    'CAR',           -- Frais kilométriques voiture
    'TRAIN',         -- Train
    'BUS',           -- Bus/Car
    'MEAL',          -- Repas
    'HOTEL',         -- Hébergement
    'TGVMAX',        -- Abonnement TGV Max
    'OTHER'          -- Autre
  )),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  
  -- Date de la dépense
  expense_date DATE NOT NULL,
  
  -- === SPÉCIFIQUE VOITURE ===
  departure TEXT,
  arrival TEXT,
  distance_km INTEGER,
  distance_is_approximate BOOLEAN DEFAULT true, -- Indique si la distance est calculée automatiquement
  fiscal_power INTEGER,
  is_round_trip BOOLEAN DEFAULT false,
  
  -- Covoiturage (JSON array)
  -- Format: [{"name": "Marie Dupont", "email": "marie@test.fr", "status_code": "APPRENANT"}, ...]
  passengers JSONB DEFAULT '[]'::jsonb,
  carpooling_bonus DECIMAL(10,2) DEFAULT 0,
  
  -- Dépenses réelles pour la voiture
  fuel_cost DECIMAL(10,2), -- Essence
  toll_cost DECIMAL(10,2), -- Péage
  
  -- === SPÉCIFIQUE TRAIN/BUS ===
  ticket_price DECIMAL(10,2),
  
  -- === SPÉCIFIQUE HÔTEL ===
  hotel_name TEXT,
  nights INTEGER,
  price_per_night DECIMAL(10,2),
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_claim ON public.expense_items(claim_id);
CREATE INDEX IF NOT EXISTS idx_items_type ON public.expense_items(expense_type);
CREATE INDEX IF NOT EXISTS idx_items_date ON public.expense_items(expense_date);

-- ============================================
-- 6. Table des justificatifs (inchangée)
-- ============================================
DROP TABLE IF EXISTS public.justificatifs CASCADE;

CREATE TABLE public.justificatifs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID REFERENCES expense_claims(id) ON DELETE CASCADE,
  item_id UUID REFERENCES expense_items(id) ON DELETE CASCADE,
  
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  
  -- Type de justificatif
  justif_type TEXT CHECK (justif_type IN ('fuel', 'toll', 'ticket', 'invoice', 'other')),
  
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_justif_claim ON public.justificatifs(claim_id);
CREATE INDEX IF NOT EXISTS idx_justif_item ON public.justificatifs(item_id);

-- ============================================
-- 7. Table des lots de paiement SEPA
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_number TEXT UNIQUE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  claims_count INTEGER NOT NULL,
  
  -- Export SEPA
  sepa_xml_path TEXT,
  exported_at TIMESTAMPTZ,
  exported_by UUID REFERENCES users(id),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'exported', 'sent_to_bank', 'processed')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. Fonctions utilitaires
-- ============================================

-- Fonction pour calculer le bonus covoiturage
CREATE OR REPLACE FUNCTION calculate_carpooling_bonus(
  p_distance_km INTEGER,
  p_passengers JSONB,
  p_event_id UUID
) RETURNS DECIMAL(10,2) AS $$
DECLARE
  v_base_rate DECIMAL(5,3) := 0.12;
  v_total_coefficient DECIMAL(10,3) := 1.0;
  v_nb_passengers INTEGER;
  v_passenger JSONB;
  v_status_coef DECIMAL(4,3);
  v_base_amount DECIMAL(10,2);
  v_bonus DECIMAL(10,2);
  v_bonus_cap INTEGER := 40;
BEGIN
  -- Charger le taux personnalisé si événement
  IF p_event_id IS NOT NULL THEN
    SELECT COALESCE(custom_km_cap, 0.12), COALESCE(carpooling_bonus_cap_percent, 40)
    INTO v_base_rate, v_bonus_cap
    FROM events WHERE id = p_event_id;
  END IF;
  
  -- Calculer somme des coefficients
  v_nb_passengers := jsonb_array_length(p_passengers) + 1; -- +1 pour conducteur
  
  -- Ajouter coefficient du conducteur (considéré comme AUTRE = 1.0)
  v_total_coefficient := 1.0;
  
  -- Ajouter coefficients des passagers
  FOR v_passenger IN SELECT * FROM jsonb_array_elements(p_passengers)
  LOOP
    SELECT coefficient INTO v_status_coef
    FROM member_statuses
    WHERE code = (v_passenger->>'status_code');
    
    v_total_coefficient := v_total_coefficient + COALESCE(v_status_coef, 1.0);
  END LOOP;
  
  -- Calculer bonus
  v_base_amount := p_distance_km * v_base_rate;
  v_bonus := v_base_amount * ((v_total_coefficient - v_nb_passengers) / v_nb_passengers);
  
  -- Plafonner le bonus
  IF v_bonus > (v_base_amount * v_bonus_cap / 100.0) THEN
    v_bonus := v_base_amount * v_bonus_cap / 100.0;
  END IF;
  
  RETURN GREATEST(v_bonus, 0);
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour le total d'une demande
CREATE OR REPLACE FUNCTION update_claim_total(p_claim_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE expense_claims
  SET total_amount = (
    SELECT COALESCE(SUM(amount + COALESCE(carpooling_bonus, 0)), 0)
    FROM expense_items
    WHERE claim_id = p_claim_id
  ),
  updated_at = NOW()
  WHERE id = p_claim_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour recalculer le total automatiquement
CREATE OR REPLACE FUNCTION trigger_update_claim_total() RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_claim_total(COALESCE(NEW.claim_id, OLD.claim_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_expense_items_update_total ON expense_items;
CREATE TRIGGER tr_expense_items_update_total
  AFTER INSERT OR UPDATE OR DELETE ON expense_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_claim_total();

-- ============================================
-- 9. RLS (Row Level Security)
-- ============================================

-- Activer RLS sur toutes les tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE justificatifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_batches ENABLE ROW LEVEL SECURITY;

-- Policies pour users
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all users" ON users FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'treasurer'))
);

-- Policies pour member_statuses (lecture publique)
CREATE POLICY "Anyone can view member statuses" ON member_statuses FOR SELECT USING (true);

-- Policies pour events (lecture publique, création admin)
CREATE POLICY "Anyone can view events" ON events FOR SELECT USING (true);
CREATE POLICY "Admins can manage events" ON events FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'treasurer'))
);

-- Policies pour expense_claims
CREATE POLICY "Users can view their own claims" ON expense_claims FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create claims" ON expense_claims FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their draft claims" ON expense_claims FOR UPDATE USING (
  user_id = auth.uid() AND status = 'draft'
);
CREATE POLICY "Validators can view all claims" ON expense_claims FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('validator', 'treasurer', 'admin'))
);
CREATE POLICY "Validators can update claims" ON expense_claims FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('validator', 'treasurer', 'admin'))
);

-- Policies pour expense_items
CREATE POLICY "Users can view items of their claims" ON expense_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM expense_claims WHERE id = expense_items.claim_id AND user_id = auth.uid())
);
CREATE POLICY "Users can manage items of their draft claims" ON expense_items FOR ALL USING (
  EXISTS (SELECT 1 FROM expense_claims WHERE id = expense_items.claim_id AND user_id = auth.uid() AND status = 'draft')
);
CREATE POLICY "Validators can view all items" ON expense_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('validator', 'treasurer', 'admin'))
);

-- Policies pour justificatifs
CREATE POLICY "Users can manage justificatifs of their claims" ON justificatifs FOR ALL USING (
  EXISTS (SELECT 1 FROM expense_claims WHERE id = justificatifs.claim_id AND user_id = auth.uid())
);
CREATE POLICY "Validators can view all justificatifs" ON justificatifs FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('validator', 'treasurer', 'admin'))
);

-- Policies pour payment_batches
CREATE POLICY "Treasurers can manage payment batches" ON payment_batches FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('treasurer', 'admin'))
);

-- ============================================
-- 10. Vues utiles
-- ============================================

-- Vue des demandes enrichies
CREATE OR REPLACE VIEW claims_enriched AS
SELECT 
  c.id,
  c.description,
  c.status,
  c.total_amount,
  c.validated_amount,
  c.created_at,
  c.validated_at,
  c.paid_at,
  
  -- Utilisateur
  u.full_name as user_name,
  u.email as user_email,
  u.iban as user_iban,
  ms.label as user_status_label,
  
  -- Validateur
  v.full_name as validator_name,
  
  -- Événement
  e.name as event_name,
  e.date_start as event_date,
  
  -- Compteurs
  (SELECT COUNT(*) FROM expense_items WHERE claim_id = c.id) as items_count,
  (SELECT COUNT(*) FROM justificatifs WHERE claim_id = c.id) as justif_count
  
FROM expense_claims c
JOIN users u ON c.user_id = u.id
LEFT JOIN member_statuses ms ON u.status_code = ms.code
LEFT JOIN users v ON c.validator_id = v.id
LEFT JOIN events e ON c.event_id = e.id;

-- ============================================
-- Fin de la migration
-- ============================================
