-- ================================================================
-- INITIALISATION COMPLÈTE DE LA BASE AFNEUS
-- ================================================================
-- Ce fichier contient TOUT le schéma de A à Z
-- Exécuter après 00_RESET_DATABASE.sql (si besoin de reset)
-- ================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- TABLES
-- ================================================================

-- Table USERS
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'MEMBER' CHECK (status IN ('BN', 'ADMIN', 'MEMBER')),
  role TEXT DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'TREASURER', 'VALIDATOR', 'MEMBER')),
  iban TEXT,
  iban_holder_name TEXT,
  iban_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);

-- Table EVENTS
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  departure_city TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  type TEXT CHECK (type IN ('AG', 'CONFERENCE', 'FORMATION', 'REUNION', 'OTHER')),
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_dates ON public.events(start_date, end_date);

-- Table EVENT_BAREMES
CREATE TABLE public.event_baremes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  car_rate_3cv DECIMAL(6,4) DEFAULT 0.529,
  car_rate_4cv DECIMAL(6,4) DEFAULT 0.606,
  car_rate_5cv DECIMAL(6,4) DEFAULT 0.636,
  car_rate_6cv DECIMAL(6,4) DEFAULT 0.665,
  car_rate_7cv_plus DECIMAL(6,4) DEFAULT 0.697,
  carpooling_bonus_per_passenger DECIMAL(6,2) DEFAULT 2.00,
  max_train_2nd_class DECIMAL(8,2) DEFAULT 150.00,
  max_train_1st_class DECIMAL(8,2) DEFAULT 200.00,
  max_meal DECIMAL(6,2) DEFAULT 20.00,
  max_hotel_per_night DECIMAL(7,2) DEFAULT 100.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_baremes_event ON public.event_baremes(event_id);

-- Table EXPENSE_CLAIMS
CREATE TABLE public.expense_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) NOT NULL,
  event_id UUID REFERENCES public.events(id),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VALIDATED', 'REJECTED', 'PAID')),
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  validated_amount DECIMAL(10,2),
  validator_id UUID REFERENCES public.users(id),
  validated_at TIMESTAMPTZ,
  validation_comment TEXT,
  rejected_reason TEXT,
  payment_batch_id UUID,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claims_user ON public.expense_claims(user_id);
CREATE INDEX idx_claims_event ON public.expense_claims(event_id);
CREATE INDEX idx_claims_status ON public.expense_claims(status);

-- Table EXPENSE_ITEMS
CREATE TABLE public.expense_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID REFERENCES public.expense_claims(id) ON DELETE CASCADE NOT NULL,
  expense_type TEXT NOT NULL CHECK (expense_type IN (
    'CAR', 'TRAIN', 'BUS', 'PLANE', 'TAXI', 'UBER', 'SCOOTER', 
    'MEAL', 'HOTEL', 'TGVMAX', 'NAVIGO', 'SUBSCRIPTION', 'OTHER'
  )),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL,
  
  -- Voiture
  departure TEXT,
  arrival TEXT,
  distance_km DECIMAL(8,2),
  fiscal_power INTEGER,
  is_round_trip BOOLEAN DEFAULT false,
  passengers JSONB DEFAULT '[]'::jsonb,
  carpooling_bonus DECIMAL(10,2) DEFAULT 0,
  fuel_type TEXT CHECK (fuel_type IN ('GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID')),
  vehicle_registration TEXT,
  
  -- Train
  train_type TEXT CHECK (train_type IN ('TGV', 'INTERCITES', 'TER', 'OUIGO', 'THALYS', 'EUROSTAR')),
  train_segments JSONB,
  journey_type TEXT CHECK (journey_type IN ('ONE_WAY', 'ROUND_TRIP', 'MULTI_DESTINATION')),
  class TEXT CHECK (class IN ('1ST', '2ND')),
  has_card BOOLEAN DEFAULT false,
  card_type TEXT CHECK (card_type IN ('YOUNG', 'SENIOR', 'WEEKEND', 'FAMILY', 'NONE')),
  booking_platform TEXT,
  
  -- Abonnements
  subscription_type TEXT CHECK (subscription_type IN ('TGVMAX', 'NAVIGO', 'TER_ILLIMITE', 'OTHER')),
  subscription_start_date DATE,
  subscription_end_date DATE,
  
  -- Justificatifs
  receipt_url TEXT,
  receipt_uploaded_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_items_claim ON public.expense_items(claim_id);
CREATE INDEX idx_items_type ON public.expense_items(expense_type);

-- ================================================================
-- FONCTIONS
-- ================================================================

-- Fonction pour créer un profil (bypass RLS)
CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_email TEXT,
  user_first_name TEXT,
  user_last_name TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, role, status)
  VALUES (user_id, user_email, user_first_name, user_last_name, 'MEMBER', 'MEMBER')
  ON CONFLICT (id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile TO anon;

-- Fonction pour mettre à jour le profil
CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_iban TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET 
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    phone = COALESCE(p_phone, phone),
    iban = COALESCE(p_iban, iban),
    updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_profile TO authenticated;

-- Trigger auto-création profil OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_first_name TEXT;
  user_last_name TEXT;
  full_name TEXT;
  name_parts TEXT[];
  user_role TEXT;
  user_status TEXT;
BEGIN
  -- Extraire le nom complet depuis metadata ou email
  full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );
  
  -- Séparer prénom et nom
  name_parts := string_to_array(full_name, ' ');
  user_first_name := name_parts[1];
  user_last_name := array_to_string(name_parts[2:array_length(name_parts, 1)], ' ');
  
  -- Si pas de nom de famille, utiliser le prénom
  IF user_last_name IS NULL OR user_last_name = '' THEN
    user_last_name := user_first_name;
  END IF;
  
  -- Déterminer le rôle
  IF NEW.email ILIKE ANY(ARRAY[
    '%mohamed%ounally%',
    '%admin@afneus.org%'
  ]) THEN
    user_role := 'ADMIN';
    user_status := 'ADMIN';
  ELSIF NEW.email ILIKE '%@afneus.org' THEN
    user_role := 'MEMBER';
    user_status := 'BN';
  ELSE
    user_role := 'MEMBER';
    user_status := 'MEMBER';
  END IF;
  
  -- Désactiver RLS pour cette transaction
  PERFORM set_config('request.jwt.claim.sub', NEW.id::text, true);
  
  -- Créer le profil
  INSERT INTO public.users (id, email, first_name, last_name, role, status)
  VALUES (NEW.id, NEW.email, user_first_name, user_last_name, user_role, user_status)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Erreur handle_new_user pour %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Fonction updated_at automatique
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON public.expense_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ================================================================
-- RLS POLICIES
-- ================================================================

-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_select_admin" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- CRITICAL: Permettre INSERT pour trigger (bypass RLS avec fonction SECURITY DEFINER)
CREATE POLICY "users_insert_trigger" ON public.users
  FOR INSERT WITH CHECK (true);

-- Events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_published" ON public.events
  FOR SELECT USING (status IN ('PUBLISHED', 'ONGOING', 'COMPLETED'));

CREATE POLICY "events_all_admin" ON public.events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Event Baremes
ALTER TABLE public.event_baremes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "baremes_select_all" ON public.event_baremes
  FOR SELECT USING (true);

CREATE POLICY "baremes_all_admin" ON public.event_baremes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Expense Claims
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claims_select_own" ON public.expense_claims
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "claims_insert_own" ON public.expense_claims
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "claims_update_own_pending" ON public.expense_claims
  FOR UPDATE USING (user_id = auth.uid() AND status = 'PENDING');

CREATE POLICY "claims_select_validators" ON public.expense_claims
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ADMIN', 'VALIDATOR', 'TREASURER'))
  );

CREATE POLICY "claims_update_validators" ON public.expense_claims
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ADMIN', 'VALIDATOR', 'TREASURER'))
  );

-- Expense Items
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select_own" ON public.expense_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.expense_claims WHERE id = claim_id AND user_id = auth.uid())
  );

CREATE POLICY "items_all_own_pending" ON public.expense_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.expense_claims 
      WHERE id = claim_id AND user_id = auth.uid() AND status = 'PENDING'
    )
  );

CREATE POLICY "items_select_validators" ON public.expense_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ADMIN', 'VALIDATOR', 'TREASURER'))
  );

-- ================================================================
-- DONNÉES INITIALES
-- ================================================================

-- Événement par défaut
INSERT INTO public.events (name, description, location, start_date, end_date, type, status)
VALUES (
  'Événement Général',
  'Pour les frais généraux',
  'Divers',
  '2024-01-01',
  '2025-12-31',
  'OTHER',
  'PUBLISHED'
) ON CONFLICT DO NOTHING;

-- Barème par défaut
INSERT INTO public.event_baremes (event_id)
SELECT id FROM public.events WHERE name = 'Événement Général'
ON CONFLICT DO NOTHING;

-- ================================================================
-- UTILISATEURS AFNEUS (Bureau National)
-- ================================================================

-- Mohamed Dhia Ounally = SUPER ADMIN
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'mohameddhia.ounally@afneus.org', 'Mohamed Dhia', 'Ounally', 'ADMIN', 'ADMIN'
FROM auth.users WHERE email = 'mohameddhia.ounally@afneus.org'
ON CONFLICT (id) DO UPDATE SET role = 'ADMIN', status = 'ADMIN', first_name = 'Mohamed Dhia', last_name = 'Ounally';

-- Yannis Loumouamou = VALIDATOR
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'yannis.loumouamou@afneus.org', 'Yannis', 'Loumouamou', 'VALIDATOR', 'BN'
FROM auth.users WHERE email = 'yannis.loumouamou@afneus.org'
ON CONFLICT (id) DO UPDATE SET role = 'VALIDATOR', status = 'BN', first_name = 'Yannis', last_name = 'Loumouamou';

-- Membres BN
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'agathe.bares@afneus.org', 'Agathe', 'Bares', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'agathe.bares@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Agathe', last_name = 'Bares';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'anneclaire.beauvais@afneus.org', 'Anne-Claire', 'Beauvais', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'anneclaire.beauvais@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Anne-Claire', last_name = 'Beauvais';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'corentin.chadirac@afneus.org', 'Corentin', 'Chadirac', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'corentin.chadirac@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Corentin', last_name = 'Chadirac';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'emie.sanchez@afneus.org', 'Emie', 'Sanchez', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'emie.sanchez@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Emie', last_name = 'Sanchez';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'eva.schindler@afneus.org', 'Eva', 'Schindler', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'eva.schindler@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Eva', last_name = 'Schindler';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'lucas.deperthuis@afneus.org', 'Lucas', 'De Perthuis', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'lucas.deperthuis@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Lucas', last_name = 'De Perthuis';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'manon.soubeyrand@afneus.org', 'Manon', 'Soubeyrand', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'manon.soubeyrand@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Manon', last_name = 'Soubeyrand';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'rebecca.roux@afneus.org', 'Rebecca', 'Roux', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'rebecca.roux@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Rebecca', last_name = 'Roux';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'salome.lance-richardot@afneus.org', 'Salomé', 'Lance-Richardot', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'salome.lance-richardot@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Salomé', last_name = 'Lance-Richardot';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'thomas.dujak@afneus.org', 'Thomas', 'Dujak', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'thomas.dujak@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Thomas', last_name = 'Dujak';

-- ================================================================
-- INITIALISATION TERMINÉE ✅
-- ================================================================
