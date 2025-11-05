-- =====================================================================
-- AFNEUS REMBOURSEMENT - MIGRATION TOTALE "ALL-IN-ONE" (IDEMPOTENTE)
-- =====================================================================
-- Objectif: Corriger et unifier tout le schéma en un seul script exécutable
-- - Création/normalisation des tables nécessaires au code actuel
-- - Alignement des statuts (claims) et champs attendus par l'API
-- - RLS sécurisées et triggers utiles
-- - Données initiales minimales (barèmes/taux/plafonds) pour éviter les 500
-- - Élévation du compte admin principal
--
-- IMPORTANT:
-- - Ce script est idempotent: safe à ré-exécuter
-- - Exécuter dans Supabase SQL Editor (sur le projet de prod/test)
-- - Après exécution: se déconnecter/reconnecter à l'app
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Extensions nécessaires
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- TABLE: public.users (ajouts pour compatibilité code)
-- Remarque: On conserve le nom et les colonnes existantes et on ajoute
--           les champs manquants attendus par le code côté serveur.
--           Les rôles ici sont en minuscule pour coller au code (validator/treasurer/...)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    CREATE TABLE public.users (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      first_name TEXT,
      last_name TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('treasurer','validator','user','viewer','admin_asso','bn_member')),
      pole TEXT,
      association_id UUID,
      iban TEXT,
      bic TEXT,
      iban_verified BOOLEAN DEFAULT false,
      phone TEXT,
      address TEXT,
      status TEXT DEFAULT 'MEMBER',
      is_active BOOLEAN DEFAULT true,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );
  END IF;

  -- Colonnes manquantes (ajout si besoin)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='full_name') THEN
    ALTER TABLE public.users ADD COLUMN full_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='pole') THEN
    ALTER TABLE public.users ADD COLUMN pole TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='association_id') THEN
    ALTER TABLE public.users ADD COLUMN association_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='bic') THEN
    ALTER TABLE public.users ADD COLUMN bic TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='address') THEN
    ALTER TABLE public.users ADD COLUMN address TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='is_active') THEN
    ALTER TABLE public.users ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='metadata') THEN
    ALTER TABLE public.users ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END$$;

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ---------------------------------------------------------------------
-- TABLE: public.expense_claims (alignée avec lib/database.types.ts)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='expense_claims'
  ) THEN
    CREATE TABLE public.expense_claims (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      event_id UUID,
      expense_type TEXT NOT NULL CHECK (expense_type IN ('transport','train','car','hotel','meal','registration','other')),
      expense_date DATE NOT NULL,
      amount_ttc DECIMAL(10,2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      departure_location TEXT,
      arrival_location TEXT,
      distance_km DECIMAL(8,2),
      cv_fiscaux INTEGER,
  motive TEXT,
  total_amount DECIMAL(10,2),
      calculated_amount DECIMAL(10,2),
      validated_amount DECIMAL(10,2),
      reimbursable_amount DECIMAL(10,2),
      taux_applied DECIMAL(6,4),
      description TEXT,
      merchant_name TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      submitted_at TIMESTAMPTZ,
      validated_at TIMESTAMPTZ,
      validated_by UUID REFERENCES public.users(id),
      validator_id UUID REFERENCES public.users(id),
      paid_at TIMESTAMPTZ,
      validation_comment TEXT,
      refusal_reason TEXT,
      requires_second_validation BOOLEAN DEFAULT false,
      second_validator_id UUID REFERENCES public.users(id),
      payment_batch_id UUID,
      payment_reference TEXT,
      has_justificatifs BOOLEAN DEFAULT false,
      is_duplicate_suspect BOOLEAN DEFAULT false,
      reminder_sent_count INTEGER NOT NULL DEFAULT 0,
      last_reminder_at TIMESTAMPTZ,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    -- Ajouter/normaliser les colonnes attendues par le code
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='expense_type') THEN
      ALTER TABLE public.expense_claims ADD COLUMN expense_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='event_id') THEN
      ALTER TABLE public.expense_claims ADD COLUMN event_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='expense_date') THEN
      ALTER TABLE public.expense_claims ADD COLUMN expense_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='amount_ttc') THEN
      ALTER TABLE public.expense_claims ADD COLUMN amount_ttc DECIMAL(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='currency') THEN
      ALTER TABLE public.expense_claims ADD COLUMN currency TEXT DEFAULT 'EUR';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='departure_location') THEN
      ALTER TABLE public.expense_claims ADD COLUMN departure_location TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='arrival_location') THEN
      ALTER TABLE public.expense_claims ADD COLUMN arrival_location TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='distance_km') THEN
      ALTER TABLE public.expense_claims ADD COLUMN distance_km DECIMAL(8,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='cv_fiscaux') THEN
      ALTER TABLE public.expense_claims ADD COLUMN cv_fiscaux INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='motive') THEN
      ALTER TABLE public.expense_claims ADD COLUMN motive TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='total_amount') THEN
      ALTER TABLE public.expense_claims ADD COLUMN total_amount DECIMAL(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='calculated_amount') THEN
      ALTER TABLE public.expense_claims ADD COLUMN calculated_amount DECIMAL(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='validated_amount') THEN
      ALTER TABLE public.expense_claims ADD COLUMN validated_amount DECIMAL(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='reimbursable_amount') THEN
      ALTER TABLE public.expense_claims ADD COLUMN reimbursable_amount DECIMAL(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='taux_applied') THEN
      ALTER TABLE public.expense_claims ADD COLUMN taux_applied DECIMAL(6,4);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='merchant_name') THEN
      ALTER TABLE public.expense_claims ADD COLUMN merchant_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='submitted_at') THEN
      ALTER TABLE public.expense_claims ADD COLUMN submitted_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='validated_by') THEN
      ALTER TABLE public.expense_claims ADD COLUMN validated_by UUID REFERENCES public.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='validator_id') THEN
      ALTER TABLE public.expense_claims ADD COLUMN validator_id UUID REFERENCES public.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='validation_comment') THEN
      ALTER TABLE public.expense_claims ADD COLUMN validation_comment TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='refusal_reason') THEN
      ALTER TABLE public.expense_claims ADD COLUMN refusal_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='requires_second_validation') THEN
      ALTER TABLE public.expense_claims ADD COLUMN requires_second_validation BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='second_validator_id') THEN
      ALTER TABLE public.expense_claims ADD COLUMN second_validator_id UUID REFERENCES public.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='payment_reference') THEN
      ALTER TABLE public.expense_claims ADD COLUMN payment_reference TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='has_justificatifs') THEN
      ALTER TABLE public.expense_claims ADD COLUMN has_justificatifs BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='is_duplicate_suspect') THEN
      ALTER TABLE public.expense_claims ADD COLUMN is_duplicate_suspect BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='reminder_sent_count') THEN
      ALTER TABLE public.expense_claims ADD COLUMN reminder_sent_count INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='last_reminder_at') THEN
      ALTER TABLE public.expense_claims ADD COLUMN last_reminder_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='metadata') THEN
      ALTER TABLE public.expense_claims ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
  END IF;
END$$;

-- Index
CREATE INDEX IF NOT EXISTS idx_claims_user ON public.expense_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.expense_claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_date ON public.expense_claims(expense_date);
CREATE INDEX IF NOT EXISTS idx_claims_event ON public.expense_claims(event_id);

-- Normalisation des statuts (mappage uppercase → lowercase cohérents)
DO $$
DECLARE r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expense_claims' AND column_name='status') THEN
    -- Supprimer toutes les contraintes CHECK sur la colonne status
    FOR r IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'expense_claims'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    LOOP
      EXECUTE format('ALTER TABLE public.expense_claims DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    -- Ajouter une nouvelle contrainte cohérente
    ALTER TABLE public.expense_claims
      ADD CONSTRAINT expense_claims_status_check
      CHECK (LOWER(status) IN (
        'draft','submitted','incomplete','to_validate','validated','refused','exported_for_payment','paid','closed','disputed'
      ));

    -- Migrer les valeurs existantes
    UPDATE public.expense_claims
    SET status = CASE LOWER(status)
      WHEN 'pending'     THEN 'draft'
      WHEN 'to_validate' THEN 'to_validate'
      WHEN 'validated'   THEN 'validated'
      WHEN 'rejected'    THEN 'refused'
      WHEN 'paid'        THEN 'paid'
      ELSE LOWER(status)
    END;
  END IF;
END$$;

-- ---------------------------------------------------------------------
-- TABLES DE SUPPORT UTILISÉES PAR LE CODE
-- ---------------------------------------------------------------------

-- Evénements (utilisés par les pages admin/events et admin/event-baremes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='events'
  ) THEN
    CREATE TABLE public.events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      description TEXT,
      event_type TEXT NOT NULL CHECK (event_type IN (
        'CONGRES_ANNUEL','WEEKEND_PASSATION','FORMATION','REUNION_BN','REUNION_REGION','EVENEMENT_EXTERNE','AUTRE'
      )),
      -- Deux paires de colonnes pour compat avec les 2 pages (start_date/date_start)
      start_date DATE,
      end_date DATE,
      date_start DATE,
      date_end DATE,
      location TEXT,
      departure_city TEXT,
      custom_km_cap DECIMAL(6,3) DEFAULT 0.120,
      carpooling_bonus_cap_percent INTEGER DEFAULT 40,
      allow_carpooling_bonus BOOLEAN DEFAULT true,
      max_train_amount DECIMAL(10,2),
      max_hotel_per_night DECIMAL(10,2),
      max_meal_amount DECIMAL(10,2),
      created_by UUID REFERENCES public.users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    -- Colonnes manquantes (si une version partielle existe)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='departure_city') THEN
      ALTER TABLE public.events ADD COLUMN departure_city TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='start_date') THEN
      ALTER TABLE public.events ADD COLUMN start_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='end_date') THEN
      ALTER TABLE public.events ADD COLUMN end_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='date_start') THEN
      ALTER TABLE public.events ADD COLUMN date_start DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='date_end') THEN
      ALTER TABLE public.events ADD COLUMN date_end DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='custom_km_cap') THEN
      ALTER TABLE public.events ADD COLUMN custom_km_cap DECIMAL(6,3) DEFAULT 0.120;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='carpooling_bonus_cap_percent') THEN
      ALTER TABLE public.events ADD COLUMN carpooling_bonus_cap_percent INTEGER DEFAULT 40;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='allow_carpooling_bonus') THEN
      ALTER TABLE public.events ADD COLUMN allow_carpooling_bonus BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='max_train_amount') THEN
      ALTER TABLE public.events ADD COLUMN max_train_amount DECIMAL(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='max_hotel_per_night') THEN
      ALTER TABLE public.events ADD COLUMN max_hotel_per_night DECIMAL(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='max_meal_amount') THEN
      ALTER TABLE public.events ADD COLUMN max_meal_amount DECIMAL(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='created_by') THEN
      ALTER TABLE public.events ADD COLUMN created_by UUID REFERENCES public.users(id);
    END IF;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_events_start_date ON public.events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_date_start ON public.events(date_start);

-- Barèmes par événement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='event_baremes'
  ) THEN
    CREATE TABLE public.event_baremes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
      expense_type TEXT NOT NULL CHECK (expense_type IN ('train','avion','covoiturage','hebergement')),
      bn_rate DECIMAL(6,4) NOT NULL DEFAULT 0.80,
      admin_rate DECIMAL(6,4) NOT NULL DEFAULT 0.65,
      other_rate DECIMAL(6,4) NOT NULL DEFAULT 0.50,
      max_amount DECIMAL(10,2),
      notes TEXT,
      auto_calculated BOOLEAN DEFAULT false,
      sncf_price_young DECIMAL(10,2),
      sncf_price_standard DECIMAL(10,2),
      last_updated TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_event_baremes_event ON public.event_baremes(event_id);

-- Ajouter la contrainte FK sur expense_claims.event_id si absente (après création de events)
DO $$
DECLARE
  fk_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'expense_claims'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'expense_claims_event_id_fkey'
  ) INTO fk_exists;

  IF NOT fk_exists THEN
    -- S'assurer que la table events existe avant d'ajouter la FK
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'events'
    ) THEN
      ALTER TABLE public.expense_claims
        ADD CONSTRAINT expense_claims_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;
    END IF;
  END IF;
END$$;

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

-- Barèmes kilométriques (voiture)
CREATE TABLE IF NOT EXISTS public.baremes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cv_fiscaux INTEGER NOT NULL,
  rate_per_km DECIMAL(8,4) NOT NULL,
  valid_from DATE NOT NULL DEFAULT NOW(),
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_baremes_cv ON public.baremes(cv_fiscaux);

-- Taux de remboursement par rôle
CREATE TABLE IF NOT EXISTS public.taux_remboursement (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL CHECK (role IN ('bn_member','admin_asso','user')),
  taux DECIMAL(6,4) NOT NULL,
  valid_from DATE NOT NULL DEFAULT NOW(),
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_taux_role ON public.taux_remboursement(role);

-- Plafonds par type de dépense
CREATE TABLE IF NOT EXISTS public.plafonds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_type TEXT NOT NULL CHECK (expense_type IN ('transport','train','car','hotel','meal','registration','other')),
  plafond_unitaire DECIMAL(10,2),
  plafond_journalier DECIMAL(10,2),
  plafond_mensuel DECIMAL(10,2),
  requires_validation BOOLEAN DEFAULT false,
  valid_from DATE NOT NULL DEFAULT NOW(),
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plafonds_type ON public.plafonds(expense_type);

-- Justificatifs
CREATE TABLE IF NOT EXISTS public.justificatifs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_claim_id UUID NOT NULL REFERENCES public.expense_claims(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  ocr_extracted_data JSONB,
  ocr_processed BOOLEAN DEFAULT false,
  ocr_confidence DECIMAL(5,2),
  drive_file_id TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES public.users(id),
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_justifs_claim ON public.justificatifs(expense_claim_id);

-- Lots de paiement (SEPA)
CREATE TABLE IF NOT EXISTS public.payment_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_name TEXT NOT NULL,
  batch_date DATE NOT NULL DEFAULT NOW(),
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_claims INTEGER NOT NULL DEFAULT 0,
  sepa_xml_path TEXT,
  csv_export_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','exported','sent_to_bank','processed','closed')),
  exported_at TIMESTAMPTZ,
  exported_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Configuration clef/valeur
CREATE TABLE IF NOT EXISTS public.config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id)
);

-- ---------------------------------------------------------------------
-- AUDIT LOGS (aligné avec lib/database.types.ts et API)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs'
  ) THEN
    CREATE TABLE public.audit_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      actor_id UUID,
      actor_email TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      before_data JSONB,
      after_data JSONB,
      diff JSONB,
      ip_address TEXT,
      user_agent TEXT,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'::jsonb
    );
  ELSE
    -- Ajouter/adapter les colonnes manquantes pour compatibilité avec l'app
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='actor_role') THEN
      ALTER TABLE public.audit_logs ADD COLUMN actor_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='entity_type') THEN
      ALTER TABLE public.audit_logs ADD COLUMN entity_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='entity_id') THEN
      ALTER TABLE public.audit_logs ADD COLUMN entity_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='before_data') THEN
      ALTER TABLE public.audit_logs ADD COLUMN before_data JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='after_data') THEN
      ALTER TABLE public.audit_logs ADD COLUMN after_data JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='diff') THEN
      ALTER TABLE public.audit_logs ADD COLUMN diff JSONB;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='ip_address') THEN
      -- Force le type TEXT (certaines anciennes versions utilisaient INET)
      ALTER TABLE public.audit_logs ALTER COLUMN ip_address TYPE TEXT USING ip_address::TEXT;
    ELSE
      ALTER TABLE public.audit_logs ADD COLUMN ip_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='user_agent') THEN
      ALTER TABLE public.audit_logs ADD COLUMN user_agent TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='timestamp') THEN
      ALTER TABLE public.audit_logs ADD COLUMN "timestamp" TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='metadata') THEN
      ALTER TABLE public.audit_logs ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs(actor_id);

-- ---------------------------------------------------------------------
-- TRIGGERS COMMUNS: updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at'
  ) THEN
    CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_claims_updated_at'
  ) THEN
    CREATE TRIGGER trg_claims_updated_at BEFORE UPDATE ON public.expense_claims
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_events_updated_at'
  ) THEN
    CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_event_baremes_updated_at'
  ) THEN
    CREATE TRIGGER trg_event_baremes_updated_at BEFORE UPDATE ON public.event_baremes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- ---------------------------------------------------------------------
-- TRIGGER: handle_new_user (auto-création profil depuis auth.users)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  full_name TEXT;
  first_name TEXT;
  last_name TEXT;
  name_parts TEXT[];
  mapped_role TEXT;
  user_status TEXT;
BEGIN
  full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  name_parts := string_to_array(full_name, ' ');
  first_name := COALESCE(name_parts[1], split_part(NEW.email, '@', 1));
  last_name := COALESCE(array_to_string(name_parts[2:array_length(name_parts,1)], ' '), first_name);

  -- Mapping rôle par email/domaine
  IF NEW.email ILIKE '%mohameddhia.ounally@afneus.org%' THEN
    mapped_role := 'validator';
    user_status := 'ADMIN';
  ELSIF NEW.email ILIKE '%@afneus.org' THEN
    mapped_role := 'bn_member';
    user_status := 'BN';
  ELSE
    mapped_role := 'user';
    user_status := 'MEMBER';
  END IF;

  INSERT INTO public.users (id, email, full_name, first_name, last_name, role, status)
  VALUES (NEW.id, NEW.email, full_name, first_name, last_name, mapped_role, user_status)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = NOW();

  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RPC: Synchroniser l'utilisateur courant depuis auth.users vers public.users
CREATE OR REPLACE FUNCTION public.sync_current_user()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  au RECORD;
  full_name TEXT;
  first_name TEXT;
  last_name TEXT;
  name_parts TEXT[];
  mapped_role TEXT;
  user_status TEXT;
BEGIN
  SELECT * INTO au FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN;
  END IF;

  full_name := COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    split_part(au.email, '@', 1)
  );

  name_parts := string_to_array(full_name, ' ');
  first_name := COALESCE(name_parts[1], split_part(au.email, '@', 1));
  last_name := COALESCE(array_to_string(name_parts[2:array_length(name_parts,1)], ' '), first_name);

  IF au.email ILIKE 'mohameddhia.ounally@afneus.org' THEN
    mapped_role := 'admin_asso';
    user_status := 'ADMIN';
  ELSIF au.email ILIKE '%@afneus.org' THEN
    mapped_role := 'bn_member';
    user_status := 'BN';
  ELSE
    mapped_role := 'user';
    user_status := 'MEMBER';
  END IF;

  INSERT INTO public.users (id, email, full_name, first_name, last_name, role, status)
  VALUES (au.id, au.email, full_name, first_name, last_name, mapped_role, user_status)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = NOW();
END;
$$;

-- ---------------------------------------------------------------------
-- RLS POLICIES (principales)
-- ---------------------------------------------------------------------
-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;
DROP POLICY IF EXISTS users_select_admin ON public.users;
DROP POLICY IF EXISTS users_insert_public ON public.users;

CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY users_update_own ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Lecture par staff (validator/treasurer/admin_asso/bn_member)
CREATE POLICY users_select_staff ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('validator','treasurer','admin_asso','bn_member')
    )
  );

-- Expense Claims
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS claims_select_own ON public.expense_claims;
DROP POLICY IF EXISTS claims_insert_own ON public.expense_claims;
DROP POLICY IF EXISTS claims_update_own ON public.expense_claims;
DROP POLICY IF EXISTS claims_staff_read ON public.expense_claims;
DROP POLICY IF EXISTS claims_staff_update ON public.expense_claims;
DROP POLICY IF EXISTS claims_delete_admin ON public.expense_claims;

CREATE POLICY claims_select_own ON public.expense_claims
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY claims_insert_own ON public.expense_claims
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY claims_update_own ON public.expense_claims
  FOR UPDATE USING (user_id = auth.uid() AND LOWER(status) IN ('draft','incomplete'));

-- Staff (validator/treasurer/admin_asso) lecture/maj
CREATE POLICY claims_staff_read ON public.expense_claims
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('validator','treasurer','admin_asso'))
  );

CREATE POLICY claims_staff_update ON public.expense_claims
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('validator','treasurer','admin_asso'))
  );

-- Events RLS: lecture pour tout utilisateur authentifié, écriture pour staff
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS events_select_all ON public.events;
DROP POLICY IF EXISTS events_write_staff ON public.events;

CREATE POLICY events_select_all ON public.events
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY events_write_staff ON public.events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('validator','treasurer','admin_asso'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('validator','treasurer','admin_asso'))
  );

-- Event baremes RLS
ALTER TABLE public.event_baremes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_baremes_select_all ON public.event_baremes;
DROP POLICY IF EXISTS event_baremes_write_staff ON public.event_baremes;

CREATE POLICY event_baremes_select_all ON public.event_baremes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY event_baremes_write_staff ON public.event_baremes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('validator','treasurer','admin_asso'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('validator','treasurer','admin_asso'))
  );

-- Notifications (lecture/maj propres)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_own ON public.notifications;
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notifications_insert_own ON public.notifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Audit logs (lecture admin_asso uniquement)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_select_admin ON public.audit_logs;
CREATE POLICY audit_select_admin ON public.audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin_asso')
  );

-- Justificatifs: lecture/écriture liés à ses propres demandes
ALTER TABLE public.justificatifs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS justifs_select_own ON public.justificatifs;
DROP POLICY IF EXISTS justifs_insert_own ON public.justificatifs;
DROP POLICY IF EXISTS justifs_update_own ON public.justificatifs;
DROP POLICY IF EXISTS justifs_staff_read ON public.justificatifs;

CREATE POLICY justifs_select_own ON public.justificatifs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.expense_claims c WHERE c.id = justificatifs.expense_claim_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY justifs_insert_own ON public.justificatifs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expense_claims c WHERE c.id = justificatifs.expense_claim_id AND c.user_id = auth.uid() AND LOWER(c.status) IN ('draft','incomplete')
    )
  );

CREATE POLICY justifs_update_own ON public.justificatifs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.expense_claims c WHERE c.id = justificatifs.expense_claim_id AND c.user_id = auth.uid() AND LOWER(c.status) IN ('draft','incomplete')
    )
  );

CREATE POLICY justifs_staff_read ON public.justificatifs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('validator','treasurer','admin_asso'))
  );

-- ---------------------------------------------------------------------
-- SEED MINIMUM (si vide) pour éviter les erreurs au calcul
-- ---------------------------------------------------------------------
-- Barèmes simples (voiture) pour 3/5/7 CV
INSERT INTO public.baremes (cv_fiscaux, rate_per_km)
SELECT v.cv, v.rate
FROM (
  VALUES (3, 0.529::DECIMAL(8,4)), (5, 0.636), (7, 0.697)
) AS v(cv, rate)
WHERE NOT EXISTS (SELECT 1 FROM public.baremes b WHERE b.cv_fiscaux = v.cv AND b.valid_to IS NULL);

-- Taux par rôle (par défaut)
INSERT INTO public.taux_remboursement (role, taux)
SELECT v.role, v.taux
FROM (
  VALUES ('user', 0.50::DECIMAL(6,4)), ('bn_member', 0.65), ('admin_asso', 0.80)
) AS v(role, taux)
WHERE NOT EXISTS (SELECT 1 FROM public.taux_remboursement t WHERE t.role = v.role AND t.valid_to IS NULL);

-- Plafonds par type (exemples raisonnables)
INSERT INTO public.plafonds (expense_type, plafond_unitaire, requires_validation)
SELECT v.type, v.plafond, v.req
FROM (
  VALUES ('train', 200.00::DECIMAL(10,2), false),
         ('car', NULL::DECIMAL(10,2), false),
         ('hotel', 120.00, true),
         ('meal', 25.00, false)
) AS v(type, plafond, req)
WHERE NOT EXISTS (SELECT 1 FROM public.plafonds p WHERE p.expense_type = v.type AND p.valid_to IS NULL);

-- ---------------------------------------------------------------------
-- ELEVATION DU COMPTE ADMIN PRINCIPAL (pour déblocage immédiat)
-- ---------------------------------------------------------------------
UPDATE public.users
SET role = 'admin_asso', status = 'ADMIN', first_name = 'Mohamed Dhia', last_name = 'Ounally', full_name = 'Mohamed Dhia Ounally', updated_at = NOW()
WHERE email = 'mohameddhia.ounally@afneus.org';

-- ---------------------------------------------------------------------
-- VUES & RPC UTILISATEUR POUR LA PAGE PROFIL
-- ---------------------------------------------------------------------

-- Vue profil utilisateur (restreinte à l'utilisateur courant)
DROP VIEW IF EXISTS public.user_profile;
CREATE OR REPLACE VIEW public.user_profile AS
SELECT
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  COALESCE(u.full_name, (u.first_name || ' ' || u.last_name)) AS full_name,
  CASE u.role
    WHEN 'admin_asso' THEN 'ADMIN'
    WHEN 'treasurer'  THEN 'TREASURER'
    WHEN 'validator'  THEN 'VALIDATOR'
    WHEN 'bn_member'  THEN 'BN'
    ELSE 'MEMBER'
  END AS role,
  u.status AS status_code,
  CASE u.status
    WHEN 'ADMIN' THEN 'Super Admin'
    WHEN 'BN' THEN 'Bureau National'
    ELSE 'Membre'
  END AS status_label,
  1.0::DECIMAL AS coefficient,
  u.iban,
  u.iban_verified,
  -- Agrégats demandes
  COALESCE((SELECT COUNT(1) FROM public.expense_claims c WHERE c.user_id = u.id AND LOWER(c.status) IN ('draft','incomplete')), 0) AS draft_claims,
  COALESCE((SELECT COUNT(1) FROM public.expense_claims c WHERE c.user_id = u.id AND LOWER(c.status) IN ('submitted','to_validate')), 0) AS pending_claims,
  COALESCE((SELECT COUNT(1) FROM public.expense_claims c WHERE c.user_id = u.id AND LOWER(c.status) = 'validated'), 0) AS validated_claims,
  COALESCE((SELECT COUNT(1) FROM public.expense_claims c WHERE c.user_id = u.id AND LOWER(c.status) = 'paid'), 0) AS paid_claims,
  COALESCE((SELECT SUM(c.reimbursable_amount) FROM public.expense_claims c WHERE c.user_id = u.id AND LOWER(c.status) = 'paid'), 0)::DECIMAL(12,2) AS total_reimbursed
FROM public.users u
WHERE u.id = auth.uid();

-- RPC pour mettre à jour le profil (utilisé par app/profile)
CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_first_name TEXT DEFAULT NULL,
  p_last_name  TEXT DEFAULT NULL,
  p_iban       TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.users
  SET
    first_name = COALESCE(p_first_name, first_name),
    last_name  = COALESCE(p_last_name, last_name),
    full_name  = COALESCE(TRIM(COALESCE(p_first_name,'') || ' ' || COALESCE(p_last_name,'')), full_name),
    iban       = COALESCE(p_iban, iban),
    updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

COMMIT;

-- =====================================================================
-- FIN. Déconnexion/Reconnexion recommandée après exécution.
-- =====================================================================
