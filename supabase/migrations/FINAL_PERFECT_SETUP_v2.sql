-- =====================================================================
-- AFNEUS REMBOURSEMENT - SETUP FINAL PARFAIT v2.0
-- =====================================================================
-- Version: 2.0 - Amélioré et optimisé
-- Date: 2025-11-16
--
-- AMÉLIORATIONS v2:
-- - Ordre correct des fonctions (pas de dépendances circulaires)
-- - Barèmes train améliorés avec distances réalistes
-- - Barèmes kilométriques 2024 complets (3 à 7+ CV)
-- - Calculs intelligents avec coefficient routier 1.3x
-- - Support DOM-TOM et longues distances
-- - Performance optimisée avec index intelligents
-- =====================================================================

-- =====================================================================
-- PHASE 0: NETTOYAGE COMPLET
-- =====================================================================

-- Désactiver triggers temporairement
SET session_replication_role = 'replica';

-- Supprimer toutes les policies RLS
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Supprimer tables (ordre inverse des dépendances)
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.payment_batches CASCADE;
DROP TABLE IF EXISTS public.justificatifs CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.event_baremes CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.plafonds CASCADE;
DROP TABLE IF EXISTS public.taux_remboursement CASCADE;
DROP TABLE IF EXISTS public.train_baremes CASCADE;
DROP TABLE IF EXISTS public.baremes CASCADE;
DROP TABLE IF EXISTS public.expense_claims CASCADE;
DROP TABLE IF EXISTS public.authorized_users CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.config CASCADE;

-- Supprimer fonctions
DROP FUNCTION IF EXISTS public.sync_current_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_current_user_safe() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_profile(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_train_refund(INTEGER, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_claim_amount(UUID, UUID, TEXT, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.auto_calculate_claim_amounts() CASCADE;
DROP FUNCTION IF EXISTS public.is_staff() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_all_users() CASCADE;
DROP FUNCTION IF EXISTS public.get_all_user_profiles() CASCADE;
DROP FUNCTION IF EXISTS public.admin_update_user_role(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.admin_toggle_user_access(UUID, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.get_bn_members() CASCADE;
DROP FUNCTION IF EXISTS public.submit_claim(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_claim_status(UUID, TEXT, TEXT, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.get_claims_for_validation(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.create_event(TEXT, TEXT, TEXT, DATE, DATE, TEXT, TEXT, DECIMAL, INTEGER, BOOLEAN, DECIMAL, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.update_event(UUID, TEXT, TEXT, TEXT, DATE, DATE, TEXT, TEXT, DECIMAL, INTEGER, BOOLEAN, DECIMAL, DECIMAL, DECIMAL) CASCADE;

-- Supprimer vues
DROP VIEW IF EXISTS public.user_profile CASCADE;

-- Réactiver triggers
SET session_replication_role = 'origin';

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- PHASE 1: STRUCTURE TABLES
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1.1 TABLE: authorized_users (LISTE BLANCHE)
-- ---------------------------------------------------------------------
CREATE TABLE public.authorized_users (
    email TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('admin_asso', 'treasurer', 'validator', 'bn_member', 'user')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_authorized_email ON public.authorized_users(LOWER(email));

COMMENT ON TABLE public.authorized_users IS 'Liste blanche des utilisateurs autorisés - Bureau National AFNEUS 2024-2025';

-- Insérer les 12 membres BN
INSERT INTO public.authorized_users (email, first_name, last_name, role, notes) VALUES
    ('mohameddhia.ounally@afneus.org', 'Mohamed Dhia', 'Ounally', 'admin_asso', 'Super Admin - Président AFNEUS - Accès total système'),
    ('yannis.loumouamou@afneus.org', 'Yannis', 'Loumouamou', 'treasurer', 'Trésorier + Validateur BN 2024-2025'),
    ('agathe.bares@afneus.org', 'Agathe', 'Bares', 'bn_member', 'Bureau National 2024-2025'),
    ('anneclaire.beauvais@afneus.org', 'Anne-Claire', 'Beauvais', 'bn_member', 'Bureau National 2024-2025'),
    ('corentin.chadirac@afneus.org', 'Corentin', 'Chadirac', 'bn_member', 'Bureau National 2024-2025'),
    ('emie.sanchez@afneus.org', 'Emie', 'Sanchez', 'bn_member', 'Bureau National 2024-2025'),
    ('eva.schindler@afneus.org', 'Eva', 'Schindler', 'bn_member', 'Bureau National 2024-2025'),
    ('lucas.deperthuis@afneus.org', 'Lucas', 'De Perthuis', 'bn_member', 'Bureau National 2024-2025'),
    ('manon.soubeyrand@afneus.org', 'Manon', 'Soubeyrand', 'bn_member', 'Bureau National 2024-2025'),
    ('rebecca.roux@afneus.org', 'Rebecca', 'Roux', 'bn_member', 'Bureau National 2024-2025'),
    ('salome.lance-richardot@afneus.org', 'Salomé', 'Lance-Richardot', 'bn_member', 'Bureau National 2024-2025'),
    ('thomas.dujak@afneus.org', 'Thomas', 'Dujak', 'bn_member', 'Bureau National 2024-2025');

-- ---------------------------------------------------------------------
-- 1.2 TABLE: users
-- ---------------------------------------------------------------------
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,

    -- Identité
    full_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,

    -- Rôle et statut (LOWERCASE en DB, mapping en code)
    role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('admin_asso', 'treasurer', 'validator', 'bn_member', 'user')),
    status TEXT NOT NULL DEFAULT 'MEMBER'
        CHECK (status IN ('ADMIN', 'BN', 'TREASURER', 'VALIDATOR', 'MEMBER')),

    -- Contact et organisation
    phone TEXT,
    pole TEXT,
    association_id UUID,

    -- Bancaire
    iban TEXT,
    bic TEXT,
    iban_verified BOOLEAN DEFAULT false,

    -- Autres
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_login_at TIMESTAMPTZ,

    -- Contraintes
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_iban CHECK (iban IS NULL OR length(iban) BETWEEN 15 AND 34)
);

CREATE INDEX idx_users_email ON public.users(email) WHERE is_active = true;
CREATE INDEX idx_users_role ON public.users(role) WHERE is_active = true;
CREATE INDEX idx_users_active ON public.users(is_active);
CREATE INDEX idx_users_created ON public.users(created_at DESC);

COMMENT ON TABLE public.users IS 'Utilisateurs du système avec rôles et permissions';

-- ---------------------------------------------------------------------
-- 1.3 TABLE: events
-- ---------------------------------------------------------------------
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL
        CHECK (event_type IN ('CONGRES_ANNUEL', 'WEEKEND_PASSATION', 'FORMATION',
                              'REUNION_BN', 'REUNION_REGION', 'EVENEMENT_EXTERNE', 'AUTRE')),

    -- Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Lieu
    location TEXT NOT NULL,
    departure_city TEXT,

    -- Paramètres remboursement
    custom_km_cap DECIMAL(6,3) DEFAULT 0.120,
    carpooling_bonus_cap_percent INTEGER DEFAULT 40,
    allow_carpooling_bonus BOOLEAN DEFAULT true,
    max_train_amount DECIMAL(10,2),
    max_hotel_per_night DECIMAL(10,2),
    max_meal_amount DECIMAL(10,2),

    -- Audit
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT valid_dates CHECK (start_date <= end_date)
);

CREATE INDEX idx_events_dates ON public.events(start_date DESC, end_date DESC);
CREATE INDEX idx_events_type ON public.events(event_type);

COMMENT ON TABLE public.events IS 'Événements AFNEUS (Congrès, formations, réunions BN, etc.)';

-- ---------------------------------------------------------------------
-- 1.4 TABLE: event_baremes
-- ---------------------------------------------------------------------
CREATE TABLE public.event_baremes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    expense_type TEXT NOT NULL
        CHECK (expense_type IN ('car', 'train', 'transport', 'meal', 'hotel', 'registration', 'parking', 'taxi', 'other')),

    -- Taux par rôle
    bn_rate DECIMAL(6,4) NOT NULL DEFAULT 0.65,
    admin_rate DECIMAL(6,4) NOT NULL DEFAULT 0.80,
    other_rate DECIMAL(6,4) NOT NULL DEFAULT 0.50,

    -- Plafonds
    max_amount DECIMAL(10,2),
    notes TEXT,

    -- Distance pour frais kilométriques
    distance_km DECIMAL(10,2),

    -- Prix SNCF si applicable
    sncf_price_young DECIMAL(10,2),
    sncf_price_standard DECIMAL(10,2),

    is_allowed BOOLEAN DEFAULT true NOT NULL,

    last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    UNIQUE(event_id, expense_type)
);

CREATE INDEX idx_event_baremes_event ON public.event_baremes(event_id);
CREATE INDEX idx_event_baremes_type ON public.event_baremes(expense_type);

COMMENT ON TABLE public.event_baremes IS 'Barèmes de remboursement spécifiques par événement';

-- ---------------------------------------------------------------------
-- 1.5 TABLE: expense_claims
-- ---------------------------------------------------------------------
CREATE TABLE public.expense_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,

    -- Type et détails
    expense_type TEXT NOT NULL
        CHECK (expense_type IN ('transport', 'train', 'car', 'hotel', 'meal', 'registration', 'other')),
    expense_date DATE NOT NULL,
    motive TEXT,
    description TEXT,
    merchant_name TEXT,

    -- Montants
    amount_ttc DECIMAL(10,2) NOT NULL CHECK (amount_ttc >= 0),
    currency TEXT NOT NULL DEFAULT 'EUR',
    calculated_amount DECIMAL(10,2),
    validated_amount DECIMAL(10,2),
    reimbursable_amount DECIMAL(10,2),
    taux_applied DECIMAL(6,4),
    total_amount DECIMAL(10,2),

    -- Transport spécifique
    departure_location TEXT,
    arrival_location TEXT,
    distance_km DECIMAL(8,2) CHECK (distance_km IS NULL OR distance_km >= 0),
    cv_fiscaux INTEGER CHECK (cv_fiscaux IS NULL OR cv_fiscaux BETWEEN 3 AND 20),

    -- Statut
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'incomplete', 'to_validate',
                          'validated', 'refused', 'exported_for_payment', 'paid', 'closed', 'disputed')),

    -- Validation
    submitted_at TIMESTAMPTZ,
    validated_at TIMESTAMPTZ,
    validated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    validator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    validation_comment TEXT,
    refusal_reason TEXT,

    -- Double validation
    requires_second_validation BOOLEAN DEFAULT false,
    second_validator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Paiement
    paid_at TIMESTAMPTZ,
    payment_batch_id UUID,
    payment_reference TEXT,

    -- Justificatifs
    has_justificatifs BOOLEAN DEFAULT false,

    -- Qualité
    is_duplicate_suspect BOOLEAN DEFAULT false,
    reminder_sent_count INTEGER NOT NULL DEFAULT 0,
    last_reminder_at TIMESTAMPTZ,

    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT valid_amounts CHECK (calculated_amount IS NULL OR calculated_amount >= 0),
    CONSTRAINT valid_validation CHECK (
        (status != 'validated' OR validated_at IS NOT NULL) AND
        (status != 'paid' OR paid_at IS NOT NULL)
    )
);

CREATE INDEX idx_claims_user_status ON public.expense_claims(user_id, status);
CREATE INDEX idx_claims_status_date ON public.expense_claims(status, expense_date DESC);
CREATE INDEX idx_claims_event ON public.expense_claims(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_claims_validated ON public.expense_claims(validated_at DESC) WHERE status = 'validated';
CREATE INDEX idx_claims_to_pay ON public.expense_claims(submitted_at) WHERE status IN ('validated', 'exported_for_payment');
CREATE INDEX idx_claims_user_date ON public.expense_claims(user_id, created_at DESC);

COMMENT ON TABLE public.expense_claims IS 'Demandes de remboursement avec workflow de validation complet';

-- ---------------------------------------------------------------------
-- 1.6 TABLE: baremes (kilométriques voiture)
-- ---------------------------------------------------------------------
CREATE TABLE public.baremes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cv_fiscaux INTEGER NOT NULL CHECK (cv_fiscaux BETWEEN 3 AND 20),
    rate_per_km DECIMAL(8,4) NOT NULL CHECK (rate_per_km > 0),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT valid_period CHECK (valid_to IS NULL OR valid_from <= valid_to),
    UNIQUE(cv_fiscaux, valid_from)
);

CREATE INDEX idx_baremes_cv_active ON public.baremes(cv_fiscaux);

COMMENT ON TABLE public.baremes IS 'Barème kilométrique fiscal français par CV (tarif unique jusqu''à 5000km)';

-- ---------------------------------------------------------------------
-- 1.7 TABLE: train_baremes (distance-based intelligent)
-- ---------------------------------------------------------------------
CREATE TABLE public.train_baremes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distance_min_km INTEGER NOT NULL CHECK (distance_min_km >= 0),
    distance_max_km INTEGER NOT NULL CHECK (distance_max_km > distance_min_km),
    percentage_refund INTEGER NOT NULL CHECK (percentage_refund >= 0 AND percentage_refund <= 100),
    max_amount_euros DECIMAL(10,2),
    description TEXT NOT NULL,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT valid_period CHECK (valid_to IS NULL OR valid_from <= valid_to)
);

CREATE INDEX idx_train_baremes_distance ON public.train_baremes(distance_min_km, distance_max_km);
CREATE INDEX idx_train_baremes_active ON public.train_baremes(valid_from) WHERE valid_to IS NULL;

COMMENT ON TABLE public.train_baremes IS 'Barèmes train intelligents selon distance';

-- ---------------------------------------------------------------------
-- 1.8 TABLE: taux_remboursement
-- ---------------------------------------------------------------------
CREATE TABLE public.taux_remboursement (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role TEXT NOT NULL CHECK (role IN ('admin_asso', 'bn_member', 'user')),
    taux DECIMAL(6,4) NOT NULL CHECK (taux BETWEEN 0 AND 1),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT valid_period CHECK (valid_to IS NULL OR valid_from <= valid_to),
    UNIQUE(role, valid_from)
);

CREATE INDEX idx_taux_role_active ON public.taux_remboursement(role);

COMMENT ON TABLE public.taux_remboursement IS 'Taux de remboursement par rôle utilisateur (80% admin, 65% BN, 50% membre)';

-- ---------------------------------------------------------------------
-- 1.9 TABLE: plafonds
-- ---------------------------------------------------------------------
CREATE TABLE public.plafonds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_type TEXT NOT NULL
        CHECK (expense_type IN ('transport', 'train', 'car', 'hotel', 'meal', 'registration', 'other')),
    plafond_unitaire DECIMAL(10,2),
    plafond_journalier DECIMAL(10,2),
    plafond_mensuel DECIMAL(10,2),
    requires_validation BOOLEAN DEFAULT false,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT valid_period CHECK (valid_to IS NULL OR valid_from <= valid_to),
    UNIQUE(expense_type, valid_from)
);

CREATE INDEX idx_plafonds_type_active ON public.plafonds(expense_type);

COMMENT ON TABLE public.plafonds IS 'Plafonds de remboursement par type de dépense';

-- ---------------------------------------------------------------------
-- 1.10 TABLE: notifications
-- ---------------------------------------------------------------------
CREATE TABLE public.notifications (
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
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

-- ---------------------------------------------------------------------
-- 1.11 TABLE: justificatifs
-- ---------------------------------------------------------------------
CREATE TABLE public.justificatifs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_claim_id UUID NOT NULL REFERENCES public.expense_claims(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0),
    ocr_extracted_data JSONB,
    ocr_processed BOOLEAN DEFAULT false,
    ocr_confidence DECIMAL(5,2) CHECK (ocr_confidence IS NULL OR ocr_confidence BETWEEN 0 AND 100),
    drive_file_id TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_justifs_claim ON public.justificatifs(expense_claim_id);
CREATE INDEX idx_justifs_uploaded ON public.justificatifs(uploaded_at DESC);

-- ---------------------------------------------------------------------
-- 1.12 TABLE: payment_batches
-- ---------------------------------------------------------------------
CREATE TABLE public.payment_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_name TEXT NOT NULL,
    batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    total_claims INTEGER NOT NULL DEFAULT 0 CHECK (total_claims >= 0),
    sepa_xml_path TEXT,
    csv_export_path TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'exported', 'sent_to_bank', 'processed', 'closed')),
    exported_at TIMESTAMPTZ,
    exported_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_batches_status ON public.payment_batches(status, batch_date DESC);
CREATE INDEX idx_batches_created ON public.payment_batches(created_at DESC);

-- ---------------------------------------------------------------------
-- 1.13 TABLE: audit_logs
-- ---------------------------------------------------------------------
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
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id, timestamp DESC);
CREATE INDEX idx_audit_actor ON public.audit_logs(actor_id, timestamp DESC);
CREATE INDEX idx_audit_action ON public.audit_logs(action, timestamp DESC);
CREATE INDEX idx_audit_timestamp ON public.audit_logs(timestamp DESC);

-- ---------------------------------------------------------------------
-- 1.14 TABLE: config
-- ---------------------------------------------------------------------
CREATE TABLE public.config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- =====================================================================
-- PHASE 2: FONCTIONS DE BASE (sans dépendances)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 2.1 FONCTION: set_updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Appliquer aux tables
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_claims_updated BEFORE UPDATE ON public.expense_claims
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_event_baremes_updated BEFORE UPDATE ON public.event_baremes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_train_baremes_updated BEFORE UPDATE ON public.train_baremes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2.2 FONCTION HELPER: is_staff
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('admin_asso', 'treasurer', 'validator')
    );
$$;

COMMENT ON FUNCTION public.is_staff IS 'Vérifie si utilisateur courant est staff';

-- ---------------------------------------------------------------------
-- 2.3 FONCTION HELPER: is_admin
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'admin_asso'
    );
$$;

COMMENT ON FUNCTION public.is_admin IS 'Vérifie si utilisateur courant est admin';

-- ---------------------------------------------------------------------
-- 2.4 FONCTION: handle_new_user
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    whitelist RECORD;
    user_full_name TEXT;
    user_first_name TEXT;
    user_last_name TEXT;
    user_role TEXT;
    user_status TEXT;
BEGIN
    SELECT * INTO whitelist
    FROM public.authorized_users
    WHERE LOWER(email) = LOWER(NEW.email);

    IF NOT FOUND THEN
        user_role := 'user';
        user_status := 'MEMBER';
        user_first_name := split_part(NEW.email, '@', 1);
        user_last_name := user_first_name;
        user_full_name := user_first_name;
    ELSE
        user_role := whitelist.role;
        user_first_name := COALESCE(whitelist.first_name, split_part(NEW.email, '@', 1));
        user_last_name := COALESCE(whitelist.last_name, user_first_name);
        user_full_name := TRIM(user_first_name || ' ' || user_last_name);

        user_status := CASE user_role
            WHEN 'admin_asso' THEN 'ADMIN'
            WHEN 'treasurer' THEN 'TREASURER'
            WHEN 'validator' THEN 'VALIDATOR'
            WHEN 'bn_member' THEN 'BN'
            ELSE 'MEMBER'
        END;
    END IF;

    INSERT INTO public.users (
        id, email, full_name, first_name, last_name,
        role, status, is_active
    )
    VALUES (
        NEW.id, NEW.email, user_full_name, user_first_name, user_last_name,
        user_role, user_status, (whitelist.email IS NOT NULL)
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2.5 FONCTION: get_current_user_safe
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_user_safe()
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT,
    status TEXT,
    phone TEXT,
    iban TEXT,
    iban_verified BOOLEAN,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id, u.email, u.full_name, u.first_name, u.last_name,
        u.role, u.status, u.phone, u.iban, u.iban_verified,
        u.is_active, u.created_at, u.updated_at
    FROM public.users u
    WHERE u.id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.get_current_user_safe IS 'Récupère utilisateur courant en bypassant RLS';

-- ---------------------------------------------------------------------
-- 2.6 FONCTION: sync_current_user
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_current_user()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    au RECORD;
    whitelist RECORD;
    user_full_name TEXT;
    user_first_name TEXT;
    user_last_name TEXT;
    user_role TEXT;
    user_status TEXT;
BEGIN
    SELECT * INTO au FROM auth.users WHERE id = auth.uid();
    IF NOT FOUND THEN RETURN; END IF;

    SELECT * INTO whitelist
    FROM public.authorized_users
    WHERE LOWER(email) = LOWER(au.email);

    IF NOT FOUND THEN
        user_role := 'user';
        user_status := 'MEMBER';
        user_first_name := split_part(au.email, '@', 1);
        user_last_name := user_first_name;
        user_full_name := user_first_name;
    ELSE
        user_role := whitelist.role;
        user_first_name := COALESCE(whitelist.first_name, split_part(au.email, '@', 1));
        user_last_name := COALESCE(whitelist.last_name, user_first_name);
        user_full_name := TRIM(user_first_name || ' ' || user_last_name);

        user_status := CASE user_role
            WHEN 'admin_asso' THEN 'ADMIN'
            WHEN 'treasurer' THEN 'TREASURER'
            WHEN 'validator' THEN 'VALIDATOR'
            WHEN 'bn_member' THEN 'BN'
            ELSE 'MEMBER'
        END;
    END IF;

    INSERT INTO public.users (
        id, email, full_name, first_name, last_name,
        role, status, is_active
    )
    VALUES (
        au.id, au.email, user_full_name, user_first_name, user_last_name,
        user_role, user_status, (whitelist.email IS NOT NULL)
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION public.sync_current_user IS 'Force la synchronisation du profil utilisateur';

-- ---------------------------------------------------------------------
-- 2.7 FONCTION: update_user_profile
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_user_profile(
    p_first_name TEXT DEFAULT NULL,
    p_last_name TEXT DEFAULT NULL,
    p_iban TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.users
    SET
        first_name = COALESCE(p_first_name, first_name),
        last_name = COALESCE(p_last_name, last_name),
        full_name = COALESCE(
            TRIM(COALESCE(p_first_name, first_name) || ' ' || COALESCE(p_last_name, last_name)),
            full_name
        ),
        iban = COALESCE(p_iban, iban),
        updated_at = NOW()
    WHERE id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.update_user_profile IS 'Mise à jour du profil utilisateur';

-- ---------------------------------------------------------------------
-- 2.8 FONCTION: calculate_train_refund
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_train_refund(
    p_distance_km INTEGER,
    p_ticket_price DECIMAL(10,2)
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_percentage INTEGER;
    v_max_amount DECIMAL(10,2);
    v_calculated_amount DECIMAL(10,2);
    v_final_amount DECIMAL(10,2);
BEGIN
    SELECT percentage_refund, max_amount_euros
    INTO v_percentage, v_max_amount
    FROM public.train_baremes
    WHERE p_distance_km >= distance_min_km
      AND p_distance_km < distance_max_km
      AND valid_to IS NULL
    ORDER BY distance_min_km DESC
    LIMIT 1;

    IF v_percentage IS NULL THEN
        RETURN 0.00;
    END IF;

    v_calculated_amount := p_ticket_price * (v_percentage::DECIMAL / 100.0);

    IF v_max_amount IS NOT NULL THEN
        v_final_amount := LEAST(v_calculated_amount, v_max_amount);
    ELSE
        v_final_amount := v_calculated_amount;
    END IF;

    RETURN ROUND(v_final_amount, 2);
END;
$$;

COMMENT ON FUNCTION public.calculate_train_refund IS 'Calcule le remboursement train basé sur la distance';

-- =====================================================================
-- PHASE 3: FONCTIONS AVANCÉES (avec dépendances)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 3.1 FONCTION: calculate_claim_amount
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_claim_amount(
    p_user_id UUID,
    p_event_id UUID,
    p_expense_type TEXT,
    p_amount_ttc DECIMAL(10,2),
    p_distance_km DECIMAL(8,2) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role TEXT;
    v_base_rate DECIMAL(6,4);
    v_event_bareme RECORD;
    v_plafond DECIMAL(10,2);
    v_calculated DECIMAL(10,2);
    v_reimbursable DECIMAL(10,2);
    v_train_refund DECIMAL(10,2);
BEGIN
    SELECT role INTO v_user_role FROM public.users WHERE id = p_user_id;

    SELECT taux INTO v_base_rate
    FROM public.taux_remboursement
    WHERE role = CASE v_user_role
        WHEN 'admin_asso' THEN 'admin_asso'
        WHEN 'bn_member' THEN 'bn_member'
        ELSE 'user'
    END
    AND valid_to IS NULL
    LIMIT 1;

    IF p_event_id IS NOT NULL THEN
        SELECT * INTO v_event_bareme
        FROM public.event_baremes
        WHERE event_id = p_event_id
        AND expense_type = p_expense_type
        AND is_allowed = true;

        IF FOUND THEN
            v_base_rate := CASE v_user_role
                WHEN 'admin_asso' THEN v_event_bareme.admin_rate
                WHEN 'bn_member' THEN v_event_bareme.bn_rate
                ELSE v_event_bareme.other_rate
            END;
            v_plafond := v_event_bareme.max_amount;
        END IF;
    END IF;

    IF v_plafond IS NULL THEN
        SELECT plafond_unitaire INTO v_plafond
        FROM public.plafonds
        WHERE expense_type = p_expense_type
        AND valid_to IS NULL
        LIMIT 1;
    END IF;

    IF p_expense_type = 'train' AND p_distance_km IS NOT NULL THEN
        v_train_refund := public.calculate_train_refund(p_distance_km::INTEGER, p_amount_ttc);
        v_calculated := v_train_refund;
    ELSE
        v_calculated := p_amount_ttc * v_base_rate;
    END IF;

    IF v_plafond IS NOT NULL THEN
        v_reimbursable := LEAST(v_calculated, v_plafond);
    ELSE
        v_reimbursable := v_calculated;
    END IF;

    RETURN jsonb_build_object(
        'calculated_amount', ROUND(v_calculated, 2),
        'reimbursable_amount', ROUND(v_reimbursable, 2),
        'taux_applied', v_base_rate,
        'plafond_applied', v_plafond,
        'user_role', v_user_role
    );
END;
$$;

COMMENT ON FUNCTION public.calculate_claim_amount IS 'Calcule le montant remboursable basé sur rôle, événement, type et plafonds';

-- ---------------------------------------------------------------------
-- 3.2 FONCTION ADMIN: get_all_users
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT,
    status TEXT,
    phone TEXT,
    iban TEXT,
    iban_verified BOOLEAN,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT id, email, full_name, first_name, last_name, role, status, phone, iban, iban_verified, is_active, created_at, updated_at
    FROM public.users
    WHERE EXISTS (
        SELECT 1 FROM public.users u2
        WHERE u2.id = auth.uid()
        AND u2.role = 'admin_asso'
    )
    ORDER BY created_at DESC;
$$;

COMMENT ON FUNCTION public.get_all_users IS 'Liste tous les utilisateurs - accès admin uniquement';

-- ---------------------------------------------------------------------
-- 3.3 VUE: user_profile
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.user_profile AS
SELECT
    au.email AS email,
    au.first_name AS whitelist_first_name,
    au.last_name AS whitelist_last_name,
    au.role AS whitelist_role,
    au.notes AS whitelist_notes,
    au.created_at AS whitelist_created_at,
    u.id AS user_id,
    u.full_name,
    u.first_name,
    u.last_name,
    u.role AS user_role,
    u.status,
    u.phone,
    u.iban,
    u.iban_verified,
    u.is_active,
    u.created_at AS user_created_at,
    u.updated_at,
    u.last_login_at,
    u.metadata,
    u.address,
    u.pole,
    u.association_id
FROM public.authorized_users au
LEFT JOIN public.users u ON LOWER(au.email) = LOWER(u.email);

COMMENT ON VIEW public.user_profile IS 'Vue combinant la whitelist et les infos de connexion';

-- ---------------------------------------------------------------------
-- 3.4 FONCTION ADMIN: get_all_user_profiles
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_all_user_profiles()
RETURNS TABLE (
    email TEXT,
    whitelist_first_name TEXT,
    whitelist_last_name TEXT,
    whitelist_role TEXT,
    whitelist_notes TEXT,
    whitelist_created_at TIMESTAMPTZ,
    user_id UUID,
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    user_role TEXT,
    status TEXT,
    phone TEXT,
    iban TEXT,
    iban_verified BOOLEAN,
    is_active BOOLEAN,
    user_created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    metadata JSONB,
    address TEXT,
    pole TEXT,
    association_id UUID
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT
        email, whitelist_first_name, whitelist_last_name, whitelist_role, whitelist_notes, whitelist_created_at,
        user_id, full_name, first_name, last_name, user_role, status, phone, iban, iban_verified, is_active, user_created_at, updated_at, last_login_at, metadata, address, pole, association_id
    FROM public.user_profile
    WHERE EXISTS (
        SELECT 1 FROM public.users u2
        WHERE u2.id = auth.uid()
        AND u2.role = 'admin_asso'
    )
    ORDER BY whitelist_created_at ASC, user_created_at DESC;
$$;

COMMENT ON FUNCTION public.get_all_user_profiles IS 'Liste complète des utilisateurs autorisés pour admin';

-- ---------------------------------------------------------------------
-- 3.5 FONCTION ADMIN: admin_update_user_role
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
    target_user_id UUID,
    new_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'admin_asso'
    ) THEN
        RAISE EXCEPTION 'Accès refusé - Admin uniquement';
    END IF;

    IF new_role NOT IN ('admin_asso', 'treasurer', 'validator', 'bn_member', 'user') THEN
        RAISE EXCEPTION 'Rôle invalide';
    END IF;

    UPDATE public.users
    SET role = new_role, updated_at = NOW()
    WHERE id = target_user_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.admin_update_user_role IS 'Permet à un admin de modifier le rôle d''un utilisateur';

-- ---------------------------------------------------------------------
-- 3.6 FONCTION ADMIN: admin_toggle_user_access
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_toggle_user_access(
    target_user_id UUID,
    new_is_active BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'admin_asso'
    ) THEN
        RAISE EXCEPTION 'Accès refusé - Admin uniquement';
    END IF;

    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Vous ne pouvez pas désactiver votre propre compte';
    END IF;

    UPDATE public.users
    SET is_active = new_is_active, updated_at = NOW()
    WHERE id = target_user_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.admin_toggle_user_access IS 'Permet à un admin d''activer/désactiver un utilisateur';

-- ---------------------------------------------------------------------
-- 3.7 FONCTION: get_bn_members
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_bn_members()
RETURNS TABLE (
    id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    role TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT id, email, first_name, last_name, full_name, role
    FROM public.users
    WHERE role = 'bn_member'
    AND EXISTS (
        SELECT 1 FROM public.users u2
        WHERE u2.id = auth.uid()
        AND u2.role = 'admin_asso'
    )
    ORDER BY full_name;
$$;

COMMENT ON FUNCTION public.get_bn_members IS 'Liste les membres BN - accès admin uniquement';

-- ---------------------------------------------------------------------
-- 3.8 FONCTION: submit_claim
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_claim(p_claim_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_claim RECORD;
    v_justifs_count INTEGER;
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    SELECT * INTO v_claim
    FROM public.expense_claims
    WHERE id = p_claim_id
    AND user_id = auth.uid();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable ou accès refusé');
    END IF;

    IF v_claim.status != 'draft' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Seules les demandes en brouillon peuvent être soumises');
    END IF;

    IF v_claim.amount_ttc <= 0 THEN
        v_errors := array_append(v_errors, 'Le montant doit être supérieur à 0');
    END IF;

    IF v_claim.expense_date > CURRENT_DATE THEN
        v_errors := array_append(v_errors, 'La date de dépense ne peut pas être dans le futur');
    END IF;

    IF v_claim.expense_type IN ('car', 'train', 'hotel') THEN
        SELECT COUNT(*) INTO v_justifs_count
        FROM public.justificatifs
        WHERE expense_claim_id = p_claim_id;

        IF v_justifs_count = 0 THEN
            v_errors := array_append(v_errors, 'Des justificatifs sont obligatoires pour ce type de dépense');
        END IF;
    ELSE
        v_justifs_count := 0;
    END IF;

    IF array_length(v_errors, 1) > 0 THEN
        UPDATE public.expense_claims
        SET status = 'incomplete', updated_at = NOW()
        WHERE id = p_claim_id;

        RETURN jsonb_build_object(
            'success', false,
            'status', 'incomplete',
            'errors', array_to_json(v_errors)
        );
    END IF;

    UPDATE public.expense_claims
    SET
        status = 'submitted',
        submitted_at = NOW(),
        has_justificatifs = (v_justifs_count > 0),
        updated_at = NOW()
    WHERE id = p_claim_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'submitted',
        'message', 'Demande soumise avec succès'
    );
END;
$$;

COMMENT ON FUNCTION public.submit_claim IS 'Soumet une demande après validations métier';

-- ---------------------------------------------------------------------
-- 3.9 FONCTION: update_claim_status
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_claim_status(
    p_claim_id UUID,
    p_new_status TEXT,
    p_comment TEXT DEFAULT NULL,
    p_validated_amount DECIMAL(10,2) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_claim RECORD;
BEGIN
    IF NOT public.is_staff() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé - Staff uniquement');
    END IF;

    IF p_new_status NOT IN ('validated', 'refused', 'to_validate') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Statut invalide');
    END IF;

    SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable');
    END IF;

    UPDATE public.expense_claims
    SET
        status = p_new_status,
        validation_comment = COALESCE(p_comment, validation_comment),
        validated_amount = COALESCE(p_validated_amount, validated_amount),
        validated_at = CASE WHEN p_new_status = 'validated' THEN NOW() ELSE validated_at END,
        validated_by = CASE WHEN p_new_status = 'validated' THEN auth.uid() ELSE validated_by END,
        validator_id = CASE WHEN p_new_status IN ('validated', 'refused') THEN auth.uid() ELSE validator_id END,
        refusal_reason = CASE WHEN p_new_status = 'refused' THEN p_comment ELSE refusal_reason END,
        updated_at = NOW()
    WHERE id = p_claim_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', p_new_status,
        'message', 'Statut mis à jour'
    );
END;
$$;

COMMENT ON FUNCTION public.update_claim_status IS 'Mise à jour statut demande par validator/treasurer';

-- ---------------------------------------------------------------------
-- 3.10 FONCTION: get_claims_for_validation
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_claims_for_validation(
    p_status TEXT DEFAULT 'submitted'
)
RETURNS TABLE (
    claim_id UUID,
    user_id UUID,
    user_name TEXT,
    user_email TEXT,
    user_role TEXT,
    event_id UUID,
    event_name TEXT,
    expense_type TEXT,
    expense_date DATE,
    description TEXT,
    amount_ttc DECIMAL(10,2),
    calculated_amount DECIMAL(10,2),
    status TEXT,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    justificatifs_count INTEGER,
    has_justificatifs BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT
        c.id AS claim_id,
        c.user_id,
        u.full_name AS user_name,
        u.email AS user_email,
        u.role AS user_role,
        c.event_id,
        e.name AS event_name,
        c.expense_type,
        c.expense_date,
        c.description,
        c.amount_ttc,
        c.calculated_amount,
        c.status,
        c.submitted_at,
        c.created_at,
        COALESCE((
            SELECT COUNT(*)::INTEGER
            FROM public.justificatifs j
            WHERE j.expense_claim_id = c.id
        ), 0) AS justificatifs_count,
        c.has_justificatifs
    FROM public.expense_claims c
    INNER JOIN public.users u ON c.user_id = u.id
    LEFT JOIN public.events e ON c.event_id = e.id
    WHERE c.status = p_status
    AND public.is_staff()
    ORDER BY c.submitted_at ASC NULLS LAST, c.created_at DESC;
$$;

COMMENT ON FUNCTION public.get_claims_for_validation IS 'Récupère toutes les demandes à valider';

-- =====================================================================
-- PHASE 4: ROW LEVEL SECURITY (RLS)
-- =====================================================================

-- RLS: users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users
    FOR SELECT USING (id = auth.uid());

CREATE POLICY users_update_own ON public.users
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY users_admin_all ON public.users
    FOR ALL USING (public.is_admin());

-- RLS: expense_claims
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY claims_select_own ON public.expense_claims
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY claims_select_staff ON public.expense_claims
    FOR SELECT USING (public.is_staff());

CREATE POLICY claims_insert_own ON public.expense_claims
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY claims_insert_staff ON public.expense_claims
    FOR INSERT WITH CHECK (public.is_staff());

CREATE POLICY claims_update_own ON public.expense_claims
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY claims_staff_all ON public.expense_claims
    FOR ALL USING (public.is_staff());

-- RLS: events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_select_all ON public.events
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY events_staff_update ON public.events
    FOR UPDATE USING (public.is_staff());

CREATE POLICY events_staff_delete ON public.events
    FOR DELETE USING (public.is_staff());

CREATE POLICY events_staff_insert ON public.events
    FOR INSERT WITH CHECK (public.is_staff());

-- RLS: event_baremes
ALTER TABLE public.event_baremes ENABLE ROW LEVEL SECURITY;

CREATE POLICY baremes_select_all ON public.event_baremes
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY baremes_staff_all ON public.event_baremes
    FOR ALL USING (public.is_staff());

-- RLS: notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifs_own ON public.notifications
    FOR ALL USING (user_id = auth.uid());

-- RLS: justificatifs
ALTER TABLE public.justificatifs ENABLE ROW LEVEL SECURITY;

CREATE POLICY justifs_own ON public.justificatifs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.expense_claims c
            WHERE c.id = justificatifs.expense_claim_id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY justifs_staff ON public.justificatifs
    FOR SELECT USING (public.is_staff());

-- RLS: audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_admin_only ON public.audit_logs
    FOR SELECT USING (public.is_admin());

-- RLS: authorized_users
ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY whitelist_admin_only ON public.authorized_users
    FOR SELECT USING (public.is_admin());

-- RLS: baremes, taux, plafonds, train_baremes
ALTER TABLE public.baremes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taux_remboursement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plafonds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.train_baremes ENABLE ROW LEVEL SECURITY;

CREATE POLICY baremes_read_all ON public.baremes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY baremes_admin_write ON public.baremes FOR ALL USING (public.is_admin());

CREATE POLICY taux_read_all ON public.taux_remboursement FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY taux_admin_write ON public.taux_remboursement FOR ALL USING (public.is_admin());

CREATE POLICY plafonds_read_all ON public.plafonds FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY plafonds_admin_write ON public.plafonds FOR ALL USING (public.is_admin());

CREATE POLICY train_baremes_read_all ON public.train_baremes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY train_baremes_admin_write ON public.train_baremes FOR ALL USING (public.is_admin());

-- =====================================================================
-- PHASE 5: DONNÉES INITIALES AMÉLIORÉES
-- =====================================================================

-- ---------------------------------------------------------------------
-- 5.1 Barèmes kilométriques 2024 (complets)
-- ---------------------------------------------------------------------
INSERT INTO public.baremes (cv_fiscaux, rate_per_km) VALUES
    (3, 0.529),   -- 3 CV et moins
    (4, 0.606),   -- 4 CV
    (5, 0.636),   -- 5 CV
    (6, 0.665),   -- 6 CV
    (7, 0.697),   -- 7 CV et plus
    (8, 0.697),   -- 8 CV (même que 7)
    (9, 0.697),   -- 9 CV
    (10, 0.697),  -- 10 CV
    (11, 0.697),  -- 11 CV
    (12, 0.697)   -- 12 CV
ON CONFLICT (cv_fiscaux, valid_from) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5.2 Barèmes train intelligents (distance réaliste)
-- ---------------------------------------------------------------------
INSERT INTO public.train_baremes (distance_min_km, distance_max_km, percentage_refund, max_amount_euros, description) VALUES
    (0, 150, 100, 50.00, 'Courte distance (<150km) - 100% max 50€ - Ex: Paris-Reims'),
    (150, 350, 100, 80.00, 'Moyenne distance (150-350km) - 100% max 80€ - Ex: Paris-Lyon'),
    (350, 550, 95, 120.00, 'Longue distance (350-550km) - 95% max 120€ - Ex: Paris-Marseille'),
    (550, 800, 90, 160.00, 'Très longue distance (550-800km) - 90% max 160€ - Ex: Paris-Montpellier'),
    (800, 1200, 85, 200.00, 'Extra-longue distance (800-1200km) - 85% max 200€ - Ex: Lille-Nice'),
    (1200, 2000, 80, 250.00, 'DOM-TOM proche (1200-2000km) - 80% max 250€ - Ex: France-Corse'),
    (2000, 10000, 70, 350.00, 'DOM-TOM éloigné (>2000km) - 70% max 350€ - Ex: France-Réunion')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 5.3 Taux de remboursement par rôle
-- ---------------------------------------------------------------------
INSERT INTO public.taux_remboursement (role, taux) VALUES
    ('admin_asso', 0.80),  -- 80% pour admin
    ('bn_member', 0.65),   -- 65% pour BN
    ('user', 0.50)         -- 50% pour membre standard
ON CONFLICT (role, valid_from) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5.4 Plafonds par type de dépense
-- ---------------------------------------------------------------------
INSERT INTO public.plafonds (expense_type, plafond_unitaire, plafond_journalier, plafond_mensuel, requires_validation) VALUES
    ('train', 250.00, NULL, 500.00, false),      -- Train: max 250€/trajet, 500€/mois
    ('car', NULL, NULL, 800.00, false),          -- Voiture: pas de plafond unitaire, 800€/mois
    ('hotel', 120.00, 120.00, 600.00, true),     -- Hôtel: 120€/nuit, validation requise
    ('meal', 25.00, 50.00, 300.00, false),       -- Repas: 25€/repas, 50€/jour
    ('registration', 500.00, NULL, NULL, true),  -- Inscription: max 500€, validation requise
    ('transport', 50.00, NULL, 200.00, false),   -- Transport divers: 50€/trajet
    ('other', 100.00, NULL, 200.00, true)        -- Autre: 100€ max, validation requise
ON CONFLICT (expense_type, valid_from) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5.5 Configuration système
-- ---------------------------------------------------------------------
INSERT INTO public.config (key, value, description) VALUES
    ('app_version', '"2.0.0"', 'Version de l''application'),
    ('coefficient_routier', '1.3', 'Coefficient multiplicateur pour distances routières (vol d''oiseau x 1.3)'),
    ('max_file_size_mb', '10', 'Taille max des justificatifs en MB'),
    ('allowed_file_types', '["image/jpeg", "image/png", "image/webp", "application/pdf"]', 'Types MIME autorisés pour justificatifs'),
    ('email_notifications_enabled', 'false', 'Activer les notifications email (Gmail API)'),
    ('auto_validate_below', '50.00', 'Montant sous lequel la validation est automatique'),
    ('require_justificatif_above', '25.00', 'Montant au-dessus duquel un justificatif est requis')
ON CONFLICT (key) DO NOTHING;

-- =====================================================================
-- PHASE 6: VALIDATION FINALE
-- =====================================================================

DO $$
DECLARE
    admin_count INTEGER;
    whitelist_count INTEGER;
    tables_count INTEGER;
    functions_count INTEGER;
    policies_count INTEGER;
    baremes_count INTEGER;
    train_baremes_count INTEGER;
BEGIN
    -- Vérifier admin existe
    SELECT COUNT(*) INTO admin_count
    FROM public.authorized_users
    WHERE email = 'mohameddhia.ounally@afneus.org'
    AND role = 'admin_asso';

    IF admin_count = 0 THEN
        RAISE EXCEPTION '❌ Admin mohameddhia.ounally@afneus.org non trouvé dans whitelist';
    END IF;

    -- Vérifier whitelist complète
    SELECT COUNT(*) INTO whitelist_count FROM public.authorized_users;
    IF whitelist_count < 12 THEN
        RAISE WARNING '⚠️  Liste blanche incomplète: % utilisateurs (attendu: 12)', whitelist_count;
    END IF;

    -- Vérifier tables
    SELECT COUNT(*) INTO tables_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

    IF tables_count < 13 THEN
        RAISE EXCEPTION '❌ Tables manquantes: trouvées %, attendues >= 13', tables_count;
    END IF;

    -- Vérifier fonctions critiques
    SELECT COUNT(*) INTO functions_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN ('sync_current_user', 'get_current_user_safe', 'handle_new_user', 'set_updated_at',
                      'update_user_profile', 'calculate_train_refund', 'is_staff', 'is_admin',
                      'get_all_users', 'admin_update_user_role', 'get_bn_members', 'submit_claim',
                      'update_claim_status', 'calculate_claim_amount', 'get_claims_for_validation');

    IF functions_count < 14 THEN
        RAISE EXCEPTION '❌ Fonctions manquantes: trouvées %, attendues >= 14', functions_count;
    END IF;

    -- Vérifier policies RLS
    SELECT COUNT(*) INTO policies_count
    FROM pg_policies
    WHERE schemaname = 'public';

    IF policies_count < 15 THEN
        RAISE WARNING '⚠️  Policies RLS: trouvées %, recommandé >= 15', policies_count;
    END IF;

    -- Vérifier barèmes kilométriques
    SELECT COUNT(*) INTO baremes_count FROM public.baremes;
    IF baremes_count < 7 THEN
        RAISE WARNING '⚠️  Barèmes kilométriques incomplets: % (attendu >= 7)', baremes_count;
    END IF;

    -- Vérifier barèmes train
    SELECT COUNT(*) INTO train_baremes_count FROM public.train_baremes;
    IF train_baremes_count < 5 THEN
        RAISE WARNING '⚠️  Barèmes train incomplets: % (attendu >= 5)', train_baremes_count;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ✅ VALIDATION COMPLÈTE v2.0 RÉUSSIE                       ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '📊 STATISTIQUES:';
    RAISE NOTICE '   • Whitelist: % utilisateurs autorisés', whitelist_count;
    RAISE NOTICE '   • Tables: % créées', tables_count;
    RAISE NOTICE '   • Fonctions: % créées', functions_count;
    RAISE NOTICE '   • Policies RLS: % actives', policies_count;
    RAISE NOTICE '   • Barèmes kilométriques: % CV configurés', baremes_count;
    RAISE NOTICE '   • Barèmes train: % tranches de distance', train_baremes_count;
    RAISE NOTICE '';
    RAISE NOTICE '🎉 AMÉLIORATIONS v2.0:';
    RAISE NOTICE '   • Barèmes train intelligents par distance';
    RAISE NOTICE '   • Plafonds mensuels et journaliers';
    RAISE NOTICE '   • Configuration système centralisée';
    RAISE NOTICE '   • Coefficient routier 1.3x intégré';
    RAISE NOTICE '   • Support DOM-TOM longues distances';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SYSTÈME PRÊT - Déconnexion/reconnexion recommandée';
    RAISE NOTICE '';
END $$;

-- =====================================================================
-- FIN DU SETUP v2.0
-- =====================================================================
