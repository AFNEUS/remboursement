-- ============================================
-- AFNEUS - Migration Master Complète
-- ============================================
-- Cette migration contient TOUT le schéma nécessaire
-- Exécuter UNE SEULE FOIS sur une base vide
-- ============================================

-- Extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================
-- 1. TABLES UTILISATEURS
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  
  -- Statut membre
  status TEXT DEFAULT 'MEMBER' CHECK (status IN ('BN', 'ADMIN', 'MEMBER')),
  role TEXT DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'TREASURER', 'VALIDATOR', 'MEMBER')),
  
  -- Informations bancaires
  iban TEXT,
  iban_holder_name TEXT,
  iban_verified BOOLEAN DEFAULT false,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- RLS Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ============================================
-- 2. TABLES ÉVÉNEMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  departure_city TEXT, -- Ville de départ pour calculs SNCF
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  type TEXT CHECK (type IN ('AG', 'CONFERENCE', 'FORMATION', 'REUNION', 'OTHER')),
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view published events" ON public.events
  FOR SELECT USING (status = 'PUBLISHED' OR status = 'ONGOING');

CREATE POLICY "Admins can manage events" ON public.events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ============================================
-- 3. TABLES DEMANDES DE REMBOURSEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS public.expense_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) NOT NULL,
  event_id UUID REFERENCES public.events(id),
  
  description TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VALIDATED', 'REJECTED', 'PAID')),
  
  -- Montants
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  validated_amount DECIMAL(10,2),
  
  -- Validation
  validator_id UUID REFERENCES public.users(id),
  validated_at TIMESTAMPTZ,
  validation_comment TEXT,
  rejected_reason TEXT,
  
  -- Paiement
  payment_batch_id UUID,
  paid_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table lignes de dépense (VERSION OPTIMISÉE)
CREATE TABLE IF NOT EXISTS public.expense_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID REFERENCES public.expense_claims(id) ON DELETE CASCADE NOT NULL,
  
  expense_type TEXT NOT NULL CHECK (expense_type IN (
    'CAR', 'TRAIN', 'BUS', 'PLANE', 'TAXI', 'UBER', 'SCOOTER', 
    'MEAL', 'HOTEL', 'TGVMAX', 'NAVIGO', 'SUBSCRIPTION', 'OTHER'
  )),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL,
  
  -- VOITURE (CAR) : Calcul automatique barème kilométrique
  departure TEXT,
  arrival TEXT,
  distance_km DECIMAL(8,2), -- Précision 2 décimales
  fiscal_power INTEGER, -- Puissance fiscale (CV)
  is_round_trip BOOLEAN DEFAULT false,
  passengers JSONB DEFAULT '[]'::jsonb, -- [{email, name, share_amount}]
  carpooling_bonus DECIMAL(10,2) DEFAULT 0,
  fuel_type TEXT CHECK (fuel_type IN ('GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID')),
  vehicle_registration TEXT, -- Immatriculation
  
  -- TRAIN : Détection intelligente
  train_type TEXT CHECK (train_type IN ('TGV', 'INTERCITES', 'TER', 'OUIGO', 'THALYS', 'EUROSTAR')),
  class TEXT CHECK (class IN ('1ST', '2ND')), -- Classe 1ère ou 2nde
  has_card BOOLEAN DEFAULT false, -- Carte avantage (jeune, senior, etc.)
  card_type TEXT CHECK (card_type IN ('YOUNG', 'SENIOR', 'WEEKEND', 'FAMILY', 'NONE')),
  booking_platform TEXT, -- SNCF, Trainline, Ouigo
  
  -- TGVMAX / ABONNEMENTS
  subscription_type TEXT CHECK (subscription_type IN ('TGVMAX', 'NAVIGO', 'TER_ILLIMITE', 'OTHER')),
  subscription_period TEXT CHECK (subscription_period IN ('MONTHLY', 'ANNUAL', 'WEEKLY', 'DAILY')),
  subscription_start_date DATE,
  subscription_end_date DATE,
  prorate_days INTEGER, -- Nombre de jours à proratiser
  usage_count INTEGER DEFAULT 1, -- Nombre d'utilisations sur la période
  
  -- BUS / AUTOCARS
  bus_company TEXT, -- FlixBus, BlaBlaBus, etc.
  bus_route_number TEXT,
  
  -- AVION
  flight_number TEXT,
  airline TEXT,
  cabin_class TEXT CHECK (cabin_class IN ('ECONOMY', 'PREMIUM', 'BUSINESS', 'FIRST')),
  booking_ref TEXT,
  
  -- TAXI / VTC
  ride_service TEXT CHECK (ride_service IN ('TAXI', 'UBER', 'BOLT', 'HEETCH', 'MARCEL', 'G7')),
  ride_ref TEXT, -- Référence course
  
  -- HÉBERGEMENT
  hotel_name TEXT,
  hotel_address TEXT,
  nights_count INTEGER,
  room_type TEXT,
  
  -- REPAS
  meal_type TEXT CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK')),
  guests_count INTEGER DEFAULT 1,
  restaurant_name TEXT,
  
  -- CALCULS AUTOMATIQUES
  calculated_amount DECIMAL(10,2), -- Montant calculé selon barème
  reimbursable_amount DECIMAL(10,2), -- Montant remboursable final
  auto_calculated BOOLEAN DEFAULT false,
  override_reason TEXT, -- Si montant manuel différent du calculé
  
  -- JUSTIFICATIFS
  receipt_url TEXT,
  additional_docs JSONB DEFAULT '[]'::jsonb, -- URLs documents supplémentaires
  
  -- MÉTADONNÉES
  metadata JSONB DEFAULT '{}'::jsonb, -- Données flexibles supplémentaires
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Expense Claims
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims" ON public.expense_claims
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create claims" ON public.expense_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Validators can view all claims" ON public.expense_claims
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'VALIDATOR', 'TREASURER')
    )
  );

CREATE POLICY "Validators can update claims" ON public.expense_claims
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'VALIDATOR')
    )
  );

-- RLS Expense Items
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own items" ON public.expense_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.expense_claims
      WHERE id = expense_items.claim_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Validators can view all items" ON public.expense_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'VALIDATOR', 'TREASURER')
    )
  );

-- ============================================
-- 4. TABLES PAIEMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.payment_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_date DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  claims_count INTEGER NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXPORTED', 'EXECUTED')),
  sepa_xml_path TEXT,
  processed_by UUID REFERENCES public.users(id),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Payment Batches
ALTER TABLE public.payment_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Treasurers can manage batches" ON public.payment_batches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'TREASURER')
    )
  );

-- ============================================
-- 5. TABLES EMAILS (sans SECURITY DEFINER)
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES public.email_templates(id),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Email (lecture seule pour admins)
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view emails" ON public.email_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ============================================
-- 6. TABLES BARÈMES ÉVÉNEMENTS + SNCF
-- ============================================

CREATE TABLE IF NOT EXISTS public.event_baremes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  expense_type TEXT NOT NULL CHECK (expense_type IN (
    'CAR', 'TRAIN', 'BUS', 'PLANE', 'TAXI', 'UBER', 'SCOOTER',
    'MEAL', 'HOTEL', 'TGVMAX', 'NAVIGO', 'SUBSCRIPTION', 'OTHER'
  )),
  
  -- Taux de remboursement (0.0 à 1.0)
  bn_rate DECIMAL(5,4) DEFAULT 0.80,      -- 80% pour BN
  admin_rate DECIMAL(5,4) DEFAULT 0.65,   -- 65% pour admin
  other_rate DECIMAL(5,4) DEFAULT 0.50,   -- 50% autres
  
  -- Montants maximum remboursables par statut
  max_amount_bn DECIMAL(10,2),
  max_amount_admin DECIMAL(10,2),
  max_amount_other DECIMAL(10,2),
  
  -- Règles spécifiques par type de dépense
  rules JSONB DEFAULT '{}'::jsonb,
  -- Exemples:
  -- CAR: {"km_rate_gasoline": 0.523, "km_rate_electric": 0.20, "max_km_per_day": 800}
  -- TRAIN: {"allow_1st_class": false, "max_price_per_km": 0.15}
  -- TGVMAX: {"prorate_enabled": true, "min_usage_count": 2}
  -- MEAL: {"breakfast_max": 8, "lunch_max": 15, "dinner_max": 20}
  -- HOTEL: {"max_per_night": 90, "require_receipt_above": 25}
  
  -- Prix SNCF automatiques (pour type TRAIN)
  sncf_price_young DECIMAL(10,2),      -- Tarif jeune (-26 ans)
  sncf_price_standard DECIMAL(10,2),   -- Tarif standard
  sncf_price_senior DECIMAL(10,2),     -- Tarif senior (+60 ans)
  sncf_last_check TIMESTAMPTZ,         -- Dernière vérification API
  sncf_api_details JSONB,              -- Détails API (horaires, trajets)
  
  -- Barème kilométrique (pour CAR)
  km_rate_up_to_5000 DECIMAL(6,4),    -- Taux jusqu'à 5000 km
  km_rate_5001_to_20000 DECIMAL(6,4), -- Taux de 5001 à 20000 km
  km_rate_above_20000 DECIMAL(6,4),   -- Taux au-delà de 20000 km
  carpooling_bonus_rate DECIMAL(5,4) DEFAULT 0.10, -- 10% bonus covoiturage
  
  -- Plafonds globaux
  require_validation_above DECIMAL(10,2), -- Validation spéciale au-dessus de ce montant
  auto_approve_below DECIMAL(10,2),       -- Auto-validation en-dessous
  
  -- Métadonnées
  auto_calculated BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  
  UNIQUE(event_id, expense_type)
);

-- Table historique prix SNCF
CREATE TABLE IF NOT EXISTS public.sncf_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  search_date TIMESTAMPTZ NOT NULL,
  travel_date TIMESTAMPTZ NOT NULL,
  price_young DECIMAL(10,2),
  price_standard DECIMAL(10,2),
  price_adult DECIMAL(10,2),
  api_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Barèmes
ALTER TABLE public.event_baremes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view baremes" ON public.event_baremes
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage baremes" ON public.event_baremes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ============================================
-- 7. VUES (SANS security_definer)
-- ============================================

-- Vue claims enrichies
CREATE OR REPLACE VIEW public.claims_enriched AS
SELECT 
  ec.*,
  u.email,
  u.first_name,
  u.last_name,
  u.status as user_status,
  u.iban,
  e.name as event_name,
  e.start_date as event_start_date,
  v.email as validator_email
FROM public.expense_claims ec
LEFT JOIN public.users u ON ec.user_id = u.id
LEFT JOIN public.events e ON ec.event_id = e.id
LEFT JOIN public.users v ON ec.validator_id = v.id;

-- Vue stats email (simple, sans SECURITY DEFINER)
CREATE OR REPLACE VIEW public.email_stats_simple AS
SELECT 
  status,
  COUNT(*) as count,
  MAX(created_at) as last_created
FROM public.email_queue
GROUP BY status;

-- Vue barèmes avec stats
CREATE OR REPLACE VIEW public.event_baremes_with_stats AS
SELECT 
  eb.*,
  e.name as event_name,
  e.start_date,
  e.departure_city,
  e.location,
  COUNT(DISTINCT ec.id) as usage_count,
  SUM(ec.validated_amount) as total_reimbursed
FROM public.event_baremes eb
LEFT JOIN public.events e ON e.id = eb.event_id
LEFT JOIN public.expense_claims ec ON ec.event_id = eb.event_id
LEFT JOIN public.expense_items ei ON ei.claim_id = ec.id 
  AND ei.expense_type = eb.expense_type
WHERE ec.status IN ('VALIDATED', 'PAID') OR ec.status IS NULL
GROUP BY eb.id, e.name, e.start_date, e.departure_city, e.location;

-- Vue récapitulatif par événement
CREATE OR REPLACE VIEW public.event_summary AS
SELECT 
  e.id as event_id,
  e.name as event_name,
  e.location,
  e.start_date,
  e.end_date,
  e.status,
  COUNT(DISTINCT ec.id) as total_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'PENDING' THEN ec.id END) as pending_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'VALIDATED' THEN ec.id END) as validated_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'PAID' THEN ec.id END) as paid_claims,
  COALESCE(SUM(ec.total_amount), 0) as total_requested,
  COALESCE(SUM(ec.validated_amount), 0) as total_validated,
  COUNT(DISTINCT eb.id) as baremes_count
FROM public.events e
LEFT JOIN public.expense_claims ec ON ec.event_id = e.id
LEFT JOIN public.event_baremes eb ON eb.event_id = e.id
GROUP BY e.id, e.name, e.location, e.start_date, e.end_date, e.status
ORDER BY e.start_date DESC;

-- ============================================
-- 8. FONCTIONS
-- ============================================

-- Fonction de calcul remboursement ULTRA-INTELLIGENTE
CREATE OR REPLACE FUNCTION public.calculate_reimbursement(
  p_event_id UUID,
  p_expense_type TEXT,
  p_amount DECIMAL,
  p_user_id UUID,
  p_item_data JSONB DEFAULT '{}'::jsonb -- Données complètes de la dépense
) RETURNS JSONB AS $$
DECLARE
  v_user_status TEXT;
  v_user_age INTEGER;
  v_rate DECIMAL;
  v_max_amount DECIMAL;
  v_calculated_amount DECIMAL;
  v_rules JSONB;
  v_bareme RECORD;
  v_distance DECIMAL;
  v_fiscal_power INTEGER;
  v_km_rate DECIMAL;
  v_result JSONB;
BEGIN
  -- Récupérer infos utilisateur
  SELECT 
    status,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, (raw_user_meta_data->>'birth_date')::DATE))
  INTO v_user_status, v_user_age
  FROM public.users u
  LEFT JOIN auth.users au ON au.id = u.id
  WHERE u.id = p_user_id;
  
  -- Récupérer le barème complet
  SELECT * INTO v_bareme
  FROM public.event_baremes
  WHERE event_id = p_event_id AND expense_type = p_expense_type;
  
  -- Si pas de barème spécifique, utiliser taux par défaut
  IF v_bareme.id IS NULL THEN
    v_rate := CASE 
      WHEN v_user_status = 'BN' THEN 0.80
      WHEN v_user_status = 'ADMIN' THEN 0.65
      ELSE 0.50
    END;
    v_calculated_amount := p_amount * v_rate;
  ELSE
    -- Récupérer le taux selon statut
    v_rate := CASE 
      WHEN v_user_status = 'BN' THEN v_bareme.bn_rate
      WHEN v_user_status = 'ADMIN' THEN v_bareme.admin_rate
      ELSE v_bareme.other_rate
    END;
    
    v_max_amount := CASE 
      WHEN v_user_status = 'BN' THEN v_bareme.max_amount_bn
      WHEN v_user_status = 'ADMIN' THEN v_bareme.max_amount_admin
      ELSE v_bareme.max_amount_other
    END;
    
    v_rules := COALESCE(v_bareme.rules, '{}'::jsonb);
    
    -- LOGIQUE SPÉCIFIQUE PAR TYPE
    CASE p_expense_type
      
      -- ========== VOITURE ==========
      WHEN 'CAR' THEN
        v_distance := (p_item_data->>'distance_km')::DECIMAL;
        v_fiscal_power := (p_item_data->>'fiscal_power')::INTEGER;
        
        -- Barème kilométrique officiel 2024 (simplifié)
        v_km_rate := CASE
          WHEN v_fiscal_power <= 3 THEN 
            CASE WHEN v_distance <= 5000 THEN 0.529 ELSE 0.316 END
          WHEN v_fiscal_power <= 5 THEN
            CASE WHEN v_distance <= 5000 THEN 0.606 ELSE 0.340 END
          WHEN v_fiscal_power <= 7 THEN
            CASE WHEN v_distance <= 5000 THEN 0.636 ELSE 0.357 END
          ELSE 0.665
        END;
        
        -- Override si barème personnalisé
        IF v_rules ? 'km_rate_override' THEN
          v_km_rate := (v_rules->>'km_rate_override')::DECIMAL;
        END IF;
        
        v_calculated_amount := v_distance * v_km_rate;
        
        -- Bonus covoiturage
        IF (p_item_data->'passengers') IS NOT NULL AND 
           jsonb_array_length(p_item_data->'passengers') > 0 THEN
          v_calculated_amount := v_calculated_amount * (1 + COALESCE(v_bareme.carpooling_bonus_rate, 0.10));
        END IF;
        
        -- Aller-retour
        IF (p_item_data->>'is_round_trip')::BOOLEAN THEN
          v_calculated_amount := v_calculated_amount * 2;
        END IF;
      
      -- ========== TRAIN ==========
      WHEN 'TRAIN' THEN
        -- Utiliser prix SNCF si disponible
        IF v_user_age < 26 AND v_bareme.sncf_price_young IS NOT NULL THEN
          v_calculated_amount := LEAST(p_amount, v_bareme.sncf_price_young) * v_rate;
        ELSIF v_user_age >= 60 AND v_bareme.sncf_price_senior IS NOT NULL THEN
          v_calculated_amount := LEAST(p_amount, v_bareme.sncf_price_senior) * v_rate;
        ELSIF v_bareme.sncf_price_standard IS NOT NULL THEN
          v_calculated_amount := LEAST(p_amount, v_bareme.sncf_price_standard) * v_rate;
        ELSE
          v_calculated_amount := p_amount * v_rate;
        END IF;
        
        -- Pénalité 1ère classe si interdit
        IF (p_item_data->>'class') = '1ST' AND 
           (v_rules->>'allow_1st_class')::BOOLEAN = false THEN
          v_calculated_amount := v_calculated_amount * 0.7; -- -30%
        END IF;
      
      -- ========== TGVMAX / ABONNEMENTS ==========
      WHEN 'TGVMAX', 'NAVIGO', 'SUBSCRIPTION' THEN
        DECLARE
          v_prorate_days INTEGER;
          v_total_days INTEGER;
          v_subscription_cost DECIMAL;
        BEGIN
          v_subscription_cost := p_amount;
          
          -- Proratisation si activée
          IF (v_rules->>'prorate_enabled')::BOOLEAN = true THEN
            v_prorate_days := (p_item_data->>'prorate_days')::INTEGER;
            v_total_days := CASE (p_item_data->>'subscription_period')
              WHEN 'MONTHLY' THEN 30
              WHEN 'ANNUAL' THEN 365
              WHEN 'WEEKLY' THEN 7
              ELSE 1
            END;
            
            IF v_prorate_days IS NOT NULL AND v_prorate_days < v_total_days THEN
              v_subscription_cost := (p_amount / v_total_days) * v_prorate_days;
            END IF;
          END IF;
          
          -- Diviser par nombre d'utilisations si pertinent
          IF (p_item_data->>'usage_count')::INTEGER > 1 THEN
            v_subscription_cost := v_subscription_cost / (p_item_data->>'usage_count')::INTEGER;
          END IF;
          
          v_calculated_amount := v_subscription_cost * v_rate;
        END;
      
      -- ========== REPAS ==========
      WHEN 'MEAL' THEN
        DECLARE
          v_meal_max DECIMAL;
        BEGIN
          -- Plafonds selon type de repas
          v_meal_max := CASE (p_item_data->>'meal_type')
            WHEN 'BREAKFAST' THEN COALESCE((v_rules->>'breakfast_max')::DECIMAL, 8.00)
            WHEN 'LUNCH' THEN COALESCE((v_rules->>'lunch_max')::DECIMAL, 15.00)
            WHEN 'DINNER' THEN COALESCE((v_rules->>'dinner_max')::DECIMAL, 20.00)
            WHEN 'SNACK' THEN COALESCE((v_rules->>'snack_max')::DECIMAL, 5.00)
            ELSE 15.00
          END;
          
          v_calculated_amount := LEAST(p_amount, v_meal_max) * v_rate;
        END;
      
      -- ========== HÔTEL ==========
      WHEN 'HOTEL' THEN
        DECLARE
          v_nights INTEGER;
          v_max_per_night DECIMAL;
        BEGIN
          v_nights := COALESCE((p_item_data->>'nights_count')::INTEGER, 1);
          v_max_per_night := COALESCE((v_rules->>'max_per_night')::DECIMAL, 90.00);
          
          v_calculated_amount := LEAST(p_amount, v_max_per_night * v_nights) * v_rate;
        END;
      
      -- ========== AVION ==========
      WHEN 'PLANE' THEN
        -- Généralement pas remboursé ou très plafonné
        v_calculated_amount := p_amount * v_rate * 0.5; -- 50% du taux normal
      
      -- ========== TAXI / UBER ==========
      WHEN 'TAXI', 'UBER' THEN
        -- Plafonné à 50€ par défaut
        v_calculated_amount := LEAST(p_amount, 
          COALESCE((v_rules->>'max_ride_amount')::DECIMAL, 50.00)) * v_rate;
      
      -- ========== AUTRES ==========
      ELSE
        v_calculated_amount := p_amount * v_rate;
    END CASE;
    
    -- Appliquer plafond global si défini
    IF v_max_amount IS NOT NULL AND v_calculated_amount > v_max_amount THEN
      v_calculated_amount := v_max_amount;
    END IF;
  END IF;
  
  -- Construire le résultat avec détails
  v_result := jsonb_build_object(
    'original_amount', p_amount,
    'calculated_amount', v_calculated_amount,
    'applied_rate', v_rate,
    'user_status', v_user_status,
    'max_amount', v_max_amount,
    'calculation_details', jsonb_build_object(
      'expense_type', p_expense_type,
      'rules_applied', v_rules,
      'bareme_id', v_bareme.id
    )
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Fonction helper: Calculer distance voiture (Google Maps API ou formule haversine)
CREATE OR REPLACE FUNCTION public.calculate_car_distance(
  p_departure TEXT,
  p_arrival TEXT
) RETURNS DECIMAL AS $$
DECLARE
  v_distance DECIMAL;
BEGIN
  -- TODO: Intégration Google Maps Distance Matrix API
  -- Pour l'instant, retourne NULL (sera calculé côté client)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Fonction helper: Vérifier si TGVMax est rentable
CREATE OR REPLACE FUNCTION public.is_tgvmax_worth_it(
  p_user_id UUID,
  p_event_id UUID,
  p_tgvmax_cost DECIMAL DEFAULT 79.00
) RETURNS JSONB AS $$
DECLARE
  v_train_cost DECIMAL;
  v_recommendation TEXT;
  v_savings DECIMAL;
BEGIN
  -- Récupérer coût train standard
  SELECT sncf_price_young INTO v_train_cost
  FROM public.event_baremes
  WHERE event_id = p_event_id AND expense_type = 'TRAIN';
  
  IF v_train_cost IS NULL THEN
    RETURN jsonb_build_object(
      'recommendation', 'UNKNOWN',
      'reason', 'Prix SNCF non disponible'
    );
  END IF;
  
  -- Calculer économies
  v_savings := v_train_cost - p_tgvmax_cost;
  
  IF v_savings > 20 THEN
    v_recommendation := 'STRONGLY_RECOMMENDED';
  ELSIF v_savings > 0 THEN
    v_recommendation := 'RECOMMENDED';
  ELSE
    v_recommendation := 'NOT_RECOMMENDED';
  END IF;
  
  RETURN jsonb_build_object(
    'recommendation', v_recommendation,
    'train_cost', v_train_cost,
    'tgvmax_cost', p_tgvmax_cost,
    'potential_savings', v_savings,
    'breakeven_trips', CEIL(p_tgvmax_cost / NULLIF(v_train_cost, 0))
  );
END;
$$ LANGUAGE plpgsql;

-- Fonction helper: Valider justificatif requis
CREATE OR REPLACE FUNCTION public.validate_receipt_requirement(
  p_expense_type TEXT,
  p_amount DECIMAL,
  p_rules JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_required BOOLEAN;
  v_threshold DECIMAL;
  v_reason TEXT;
BEGIN
  -- Règles par défaut
  v_threshold := CASE p_expense_type
    WHEN 'CAR' THEN NULL -- Pas de reçu nécessaire (barème km)
    WHEN 'TRAIN' THEN 0 -- Toujours requis
    WHEN 'HOTEL' THEN COALESCE((p_rules->>'require_receipt_above')::DECIMAL, 25.00)
    WHEN 'MEAL' THEN COALESCE((p_rules->>'require_receipt_above')::DECIMAL, 15.00)
    ELSE 10.00
  END;
  
  v_required := (v_threshold IS NOT NULL AND p_amount >= v_threshold) OR p_expense_type = 'TRAIN';
  
  v_reason := CASE
    WHEN NOT v_required THEN 'Montant inférieur au seuil'
    WHEN p_expense_type = 'TRAIN' THEN 'Obligatoire pour les transports'
    WHEN p_amount >= v_threshold THEN 'Montant supérieur à ' || v_threshold || '€'
    ELSE 'Règle du barème'
  END;
  
  RETURN jsonb_build_object(
    'required', v_required,
    'threshold', v_threshold,
    'amount', p_amount,
    'reason', v_reason
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. TRIGGERS
-- ============================================

-- Trigger auto-création user depuis auth avec rôles automatiques
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
  v_role TEXT;
BEGIN
  -- Déterminer status (BN si @afneus.org)
  v_status := CASE 
    WHEN NEW.email LIKE '%@afneus.org' THEN 'BN'
    ELSE 'MEMBER'
  END;
  
  -- Déterminer rôle selon email
  v_role := CASE NEW.email
    -- ADMIN (Mohamed uniquement - accès full)
    WHEN 'mohameddhia.ounally@afneus.org' THEN 'ADMIN'
    
    -- TREASURER (Yannis uniquement - peut valider + trésorerie + barèmes)
    WHEN 'yannis.loumouamou@afneus.org' THEN 'TREASURER'
    
    -- MEMBER par défaut (tous les autres)
    ELSE 'MEMBER'
  END;
  
  INSERT INTO public.users (id, email, first_name, last_name, status, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    v_status,
    v_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON public.expense_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger auto-calcul montant remboursable
CREATE OR REPLACE FUNCTION public.auto_calculate_reimbursement()
RETURNS TRIGGER AS $$
DECLARE
  v_claim RECORD;
  v_calc_result JSONB;
  v_item_data JSONB;
BEGIN
  -- Récupérer infos de la demande
  SELECT * INTO v_claim
  FROM public.expense_claims
  WHERE id = NEW.claim_id;
  
  -- Construire données pour calcul
  v_item_data := jsonb_build_object(
    'distance_km', NEW.distance_km,
    'fiscal_power', NEW.fiscal_power,
    'is_round_trip', NEW.is_round_trip,
    'passengers', NEW.passengers,
    'class', NEW.class,
    'meal_type', NEW.meal_type,
    'nights_count', NEW.nights_count,
    'subscription_period', NEW.subscription_period,
    'prorate_days', NEW.prorate_days,
    'usage_count', NEW.usage_count
  );
  
  -- Calculer montant remboursable
  IF v_claim.event_id IS NOT NULL THEN
    v_calc_result := public.calculate_reimbursement(
      v_claim.event_id,
      NEW.expense_type,
      NEW.amount,
      v_claim.user_id,
      v_item_data
    );
    
    NEW.calculated_amount := (v_calc_result->>'calculated_amount')::DECIMAL;
    NEW.reimbursable_amount := (v_calc_result->>'calculated_amount')::DECIMAL;
    NEW.auto_calculated := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_calc_reimbursement ON public.expense_items;
CREATE TRIGGER auto_calc_reimbursement
  BEFORE INSERT OR UPDATE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.auto_calculate_reimbursement();

-- Trigger mise à jour total demande
CREATE OR REPLACE FUNCTION public.update_claim_total()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculer le total de la demande
  UPDATE public.expense_claims
  SET total_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.expense_items
    WHERE claim_id = COALESCE(NEW.claim_id, OLD.claim_id)
  )
  WHERE id = COALESCE(NEW.claim_id, OLD.claim_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_claim_total_on_item ON public.expense_items;
CREATE TRIGGER update_claim_total_on_item
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.update_claim_total();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 10. DONNÉES INITIALES
-- ============================================

-- Templates emails de base
INSERT INTO public.email_templates (name, subject, body_html, variables) VALUES
('CLAIM_SUBMITTED', 'Demande de remboursement soumise', 
 '<h2>Votre demande a été soumise</h2><p>Bonjour {{user_name}},</p><p>Votre demande de remboursement pour {{event_name}} d''un montant de {{amount}}€ a bien été soumise.</p>',
 '["user_name", "event_name", "amount"]'),
('CLAIM_VALIDATED', 'Demande validée', 
 '<h2>Demande validée ✅</h2><p>Bonjour {{user_name}},</p><p>Votre demande de {{amount}}€ a été validée. Vous serez remboursé sous 2-3 jours.</p>',
 '["user_name", "amount"]'),
('CLAIM_REJECTED', 'Demande refusée', 
 '<h2>Demande refusée ❌</h2><p>Bonjour {{user_name}},</p><p>Votre demande a été refusée. Motif : {{reason}}</p>',
 '["user_name", "reason"]'),
('CLAIM_PAID', 'Virement effectué', 
 '<h2>Virement effectué 💰</h2><p>Bonjour {{user_name}},</p><p>Le virement de {{amount}}€ a été effectué sur votre compte.</p>',
 '["user_name", "amount"]')
ON CONFLICT (name) DO NOTHING;

-- Fonction helper: Créer barèmes par défaut pour un événement
CREATE OR REPLACE FUNCTION public.create_default_baremes(p_event_id UUID)
RETURNS void AS $$
BEGIN
  -- Barème VOITURE
  INSERT INTO public.event_baremes (
    event_id, expense_type, bn_rate, admin_rate, other_rate,
    carpooling_bonus_rate, notes, rules
  ) VALUES (
    p_event_id, 'CAR', 0.80, 0.65, 0.50,
    0.10, 'Barème kilométrique officiel 2024',
    '{"km_rate_override": null, "max_km_per_day": 800, "fuel_bonus_electric": 0.20}'::jsonb
  ) ON CONFLICT (event_id, expense_type) DO NOTHING;
  
  -- Barème TRAIN
  INSERT INTO public.event_baremes (
    event_id, expense_type, bn_rate, admin_rate, other_rate,
    notes, rules
  ) VALUES (
    p_event_id, 'TRAIN', 0.80, 0.65, 0.50,
    'Prix SNCF à récupérer via API',
    '{"allow_1st_class": false, "max_price_per_km": 0.15}'::jsonb
  ) ON CONFLICT (event_id, expense_type) DO NOTHING;
  
  -- Barème TGVMAX
  INSERT INTO public.event_baremes (
    event_id, expense_type, bn_rate, admin_rate, other_rate,
    max_amount_bn, max_amount_admin, max_amount_other,
    notes, rules
  ) VALUES (
    p_event_id, 'TGVMAX', 0.80, 0.65, 0.50,
    79.00, 51.35, 39.50,
    'Abonnement TGVMax mensuel',
    '{"prorate_enabled": true, "min_usage_count": 2}'::jsonb
  ) ON CONFLICT (event_id, expense_type) DO NOTHING;
  
  -- Barème NAVIGO
  INSERT INTO public.event_baremes (
    event_id, expense_type, bn_rate, admin_rate, other_rate,
    max_amount_bn, max_amount_admin, max_amount_other,
    notes, rules
  ) VALUES (
    p_event_id, 'NAVIGO', 0.50, 0.50, 0.30,
    38.60, 25.09, 11.58,
    'Pass Navigo Île-de-France',
    '{"prorate_enabled": true, "zones": "1-5"}'::jsonb
  ) ON CONFLICT (event_id, expense_type) DO NOTHING;
  
  -- Barème BUS
  INSERT INTO public.event_baremes (
    event_id, expense_type, bn_rate, admin_rate, other_rate,
    notes, rules
  ) VALUES (
    p_event_id, 'BUS', 0.80, 0.65, 0.50,
    'FlixBus, BlaBlaBus, etc.',
    '{"require_receipt": true}'::jsonb
  ) ON CONFLICT (event_id, expense_type) DO NOTHING;
  
  -- Barème REPAS
  INSERT INTO public.event_baremes (
    event_id, expense_type, bn_rate, admin_rate, other_rate,
    notes, rules
  ) VALUES (
    p_event_id, 'MEAL', 0.80, 0.65, 0.50,
    'Plafonds selon type de repas',
    '{"breakfast_max": 8, "lunch_max": 15, "dinner_max": 20, "snack_max": 5, "require_receipt_above": 15}'::jsonb
  ) ON CONFLICT (event_id, expense_type) DO NOTHING;
  
  -- Barème HÔTEL
  INSERT INTO public.event_baremes (
    event_id, expense_type, bn_rate, admin_rate, other_rate,
    notes, rules
  ) VALUES (
    p_event_id, 'HOTEL', 0.80, 0.65, 0.50,
    'Maximum 90€ par nuit',
    '{"max_per_night": 90, "require_receipt_above": 25}'::jsonb
  ) ON CONFLICT (event_id, expense_type) DO NOTHING;
  
  -- Barème TAXI/UBER
  INSERT INTO public.event_baremes (
    event_id, expense_type, bn_rate, admin_rate, other_rate,
    max_amount_bn, max_amount_admin, max_amount_other,
    notes, rules
  ) VALUES (
    p_event_id, 'TAXI', 0.70, 0.50, 0.30,
    50.00, 32.50, 15.00,
    'Courses taxi/VTC plafonnées',
    '{"require_receipt": true, "max_ride_amount": 50}'::jsonb
  ) ON CONFLICT (event_id, expense_type) DO NOTHING;
  
  -- Barème AVION (rare)
  INSERT INTO public.event_baremes (
    event_id, expense_type, bn_rate, admin_rate, other_rate,
    max_amount_bn, max_amount_admin, max_amount_other,
    notes, rules
  ) VALUES (
    p_event_id, 'PLANE', 0.40, 0.30, 0.20,
    200.00, 130.00, 100.00,
    'Seulement si indispensable',
    '{"require_validation": true, "economy_only": true}'::jsonb
  ) ON CONFLICT (event_id, expense_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Créer barèmes automatiquement à la création d'un événement
CREATE OR REPLACE FUNCTION public.auto_create_baremes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.create_default_baremes(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_create_baremes_on_event ON public.events;
CREATE TRIGGER auto_create_baremes_on_event
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_baremes();

-- ============================================
-- 11. INDEXES PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_claims_user ON public.expense_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_event ON public.expense_claims(event_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.expense_claims(status);
CREATE INDEX IF NOT EXISTS idx_items_claim ON public.expense_items(claim_id);
CREATE INDEX IF NOT EXISTS idx_items_type ON public.expense_items(expense_type);
CREATE INDEX IF NOT EXISTS idx_email_status ON public.email_queue(status);
CREATE INDEX IF NOT EXISTS idx_events_dates ON public.events(start_date, end_date);

-- ============================================
-- FIN MIGRATION MASTER
-- ============================================
