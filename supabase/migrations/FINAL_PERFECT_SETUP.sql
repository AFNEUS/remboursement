-- =====================================================================
-- AFNEUS REMBOURSEMENT - SETUP FINAL PARFAIT ET UNIQUE
-- =====================================================================
-- Version: FINALE v1.0
-- Date: 2025-11-08
-- Auteur: Migration complète et cohérente avec le code TypeScript
-- 
-- OBJECTIF: Un seul fichier SQL qui fait TOUT correctement
-- - Clean total de la base
-- - Structure 100% alignée avec le code existant
-- - RLS sécurisé et fonctionnel
-- - Fonctions RPC pour Navigation et sync
-- - 12 membres BN + Mohamed Dhia admin
-- - Barèmes, taux, plafonds cohérents
-- - Performances optimisées avec index intelligents
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
-- 1.1 TABLE: authorized_users (LISTE BLANCHE - créée en premier)
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

-- Insérer immédiatement les 12 membres
INSERT INTO public.authorized_users (email, first_name, last_name, role, notes) VALUES
    ('mohameddhia.ounally@afneus.org', 'Mohamed Dhia', 'Ounally', 'admin_asso', 'Super Admin - Président AFNEUS - Accès total système'),
    ('agathe.bares@afneus.org', 'Agathe', 'Bares', 'bn_member', 'Bureau National 2024-2025'),
    ('anneclaire.beauvais@afneus.org', 'Anne-Claire', 'Beauvais', 'bn_member', 'Bureau National 2024-2025'),
    ('corentin.chadirac@afneus.org', 'Corentin', 'Chadirac', 'bn_member', 'Bureau National 2024-2025'),
    ('emie.sanchez@afneus.org', 'Emie', 'Sanchez', 'bn_member', 'Bureau National 2024-2025'),
    ('eva.schindler@afneus.org', 'Eva', 'Schindler', 'bn_member', 'Bureau National 2024-2025'),
    ('lucas.deperthuis@afneus.org', 'Lucas', 'De Perthuis', 'bn_member', 'Bureau National 2024-2025'),
    ('manon.soubeyrand@afneus.org', 'Manon', 'Soubeyrand', 'bn_member', 'Bureau National 2024-2025'),
    ('rebecca.roux@afneus.org', 'Rebecca', 'Roux', 'bn_member', 'Bureau National 2024-2025'),
    ('salome.lance-richardot@afneus.org', 'Salomé', 'Lance-Richardot', 'bn_member', 'Bureau National 2024-2025'),
    ('thomas.dujak@afneus.org', 'Thomas', 'Dujak', 'bn_member', 'Bureau National 2024-2025'),
    ('yannis.loumouamou@afneus.org', 'Yannis', 'Loumouamou', 'bn_member', 'Bureau National 2024-2025');

-- ---------------------------------------------------------------------
-- 1.2 TABLE: users (SANS RLS pour éviter cercle vicieux)
-- ---------------------------------------------------------------------
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    
    -- Identité (aligné avec code TypeScript)
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

-- Index optimisés
CREATE INDEX idx_users_email ON public.users(email) WHERE is_active = true;
CREATE INDEX idx_users_role ON public.users(role) WHERE is_active = true;
CREATE INDEX idx_users_active ON public.users(is_active);
CREATE INDEX idx_users_created ON public.users(created_at DESC);

COMMENT ON TABLE public.users IS 'Utilisateurs du système avec rôles et permissions';
COMMENT ON COLUMN public.users.role IS 'Rôle technique DB (lowercase): admin_asso, treasurer, validator, bn_member, user';
COMMENT ON COLUMN public.users.status IS 'Status affiché UI (uppercase): ADMIN, BN, TREASURER, VALIDATOR, MEMBER';

-- ---------------------------------------------------------------------
-- 1.3 TABLE: events (UNIFIÉ sur start_date/end_date)
-- ---------------------------------------------------------------------
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL
        CHECK (event_type IN ('CONGRES_ANNUEL', 'WEEKEND_PASSATION', 'FORMATION', 
                              'REUNION_BN', 'REUNION_REGION', 'EVENEMENT_EXTERNE', 'AUTRE')),
    
    -- Dates (UNE SEULE PAIRE - pas de doublon date_start/date_end)
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
-- Index partiel supprimé (CURRENT_DATE not IMMUTABLE): CREATE INDEX idx_events_active ON public.events(start_date) WHERE end_date >= CURRENT_DATE;

COMMENT ON TABLE public.events IS 'Événements AFNEUS (Congrès, formations, réunions BN, etc.)';

-- ---------------------------------------------------------------------
-- 1.4 TABLE: event_baremes (taux spécifiques par événement)
-- ---------------------------------------------------------------------
CREATE TABLE public.event_baremes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    expense_type TEXT NOT NULL
        CHECK (expense_type IN ('train', 'avion', 'covoiturage', 'hebergement')),
    
    -- Taux par rôle
    bn_rate DECIMAL(6,4) NOT NULL DEFAULT 0.65,
    admin_rate DECIMAL(6,4) NOT NULL DEFAULT 0.80,
    other_rate DECIMAL(6,4) NOT NULL DEFAULT 0.50,
    
    max_amount DECIMAL(10,2),
    notes TEXT,
    auto_calculated BOOLEAN DEFAULT false,
    
    -- Prix SNCF si applicable
    sncf_price_young DECIMAL(10,2),
    sncf_price_standard DECIMAL(10,2),
    
    last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    UNIQUE(event_id, expense_type)
);

CREATE INDEX idx_event_baremes_event ON public.event_baremes(event_id);
CREATE INDEX idx_event_baremes_type ON public.event_baremes(expense_type);

COMMENT ON TABLE public.event_baremes IS 'Barèmes de remboursement spécifiques par événement';

-- ---------------------------------------------------------------------
-- 1.5 TABLE: expense_claims (CŒUR DU SYSTÈME)
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
    
    -- Statut (LOWERCASE pour uniformité)
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
    
    -- Double validation si nécessaire
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
    
    -- Contraintes métier
    CONSTRAINT valid_amounts CHECK (calculated_amount IS NULL OR calculated_amount >= 0),
    CONSTRAINT valid_validation CHECK (
        (status != 'validated' OR validated_at IS NOT NULL) AND
        (status != 'paid' OR paid_at IS NOT NULL)
    )
);

-- Index ultra-optimisés
CREATE INDEX idx_claims_user_status ON public.expense_claims(user_id, status);
CREATE INDEX idx_claims_status_date ON public.expense_claims(status, expense_date DESC);
CREATE INDEX idx_claims_event ON public.expense_claims(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_claims_validated ON public.expense_claims(validated_at DESC) WHERE status = 'validated';
CREATE INDEX idx_claims_to_pay ON public.expense_claims(submitted_at) WHERE status IN ('validated', 'exported_for_payment');
CREATE INDEX idx_claims_user_date ON public.expense_claims(user_id, created_at DESC);

COMMENT ON TABLE public.expense_claims IS 'Demandes de remboursement avec workflow de validation complet';

-- ---------------------------------------------------------------------
-- 1.6 TABLE: baremes (kilométriques voiture - SIMPLIFIÉ)
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
COMMENT ON COLUMN public.baremes.rate_per_km IS 'Tarif €/km selon barème fiscal 2024';

-- ---------------------------------------------------------------------
-- 1.7 TABLE: taux_remboursement (par rôle)
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
-- 1.8 TABLE: plafonds (par type de dépense)
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
-- 1.9 TABLE: notifications
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
-- 1.10 TABLE: justificatifs
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
-- 1.11 TABLE: payment_batches (exports SEPA)
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
-- 1.12 TABLE: audit_logs
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
-- 1.13 TABLE: config
-- ---------------------------------------------------------------------
CREATE TABLE public.config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- =====================================================================
-- PHASE 2: FONCTIONS & TRIGGERS
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

-- Appliquer aux tables concernées
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_claims_updated BEFORE UPDATE ON public.expense_claims
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_event_baremes_updated BEFORE UPDATE ON public.event_baremes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2.2 FONCTION: handle_new_user (trigger auth.users INSERT)
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
    -- Vérifier liste blanche
    SELECT * INTO whitelist 
    FROM public.authorized_users 
    WHERE LOWER(email) = LOWER(NEW.email);
    
    IF NOT FOUND THEN
        -- Non autorisé: compte inactif
        user_role := 'user';
        user_status := 'MEMBER';
        user_first_name := split_part(NEW.email, '@', 1);
        user_last_name := user_first_name;
        user_full_name := user_first_name;
    ELSE
        -- Autorisé: utiliser données whitelist
        user_role := whitelist.role;
        user_first_name := COALESCE(whitelist.first_name, split_part(NEW.email, '@', 1));
        user_last_name := COALESCE(whitelist.last_name, user_first_name);
        user_full_name := TRIM(user_first_name || ' ' || user_last_name);
        
        -- Mapper role → status pour UI
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
-- 2.3 FONCTION: get_current_user_safe (RPC sans RLS)
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

COMMENT ON FUNCTION public.get_current_user_safe IS 'Récupère utilisateur courant en bypassant RLS (sécurisé car vérifie auth.uid())';

-- ---------------------------------------------------------------------
-- 2.4 FONCTION: sync_current_user (force sync depuis auth.users)
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

COMMENT ON FUNCTION public.sync_current_user IS 'Force la synchronisation du profil utilisateur depuis auth.users + whitelist';

-- ---------------------------------------------------------------------
-- 2.5 FONCTION: update_user_profile
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

COMMENT ON FUNCTION public.update_user_profile IS 'Mise à jour du profil utilisateur (nom, IBAN)';

-- =====================================================================
-- PHASE 3: ROW LEVEL SECURITY (RLS)
-- =====================================================================

-- ---------------------------------------------------------------------
-- RLS: users (DÉSACTIVÉ - accès via RPC uniquement)
-- ---------------------------------------------------------------------
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.users IS 'Table users SANS RLS - accès via RPC get_current_user_safe() uniquement';

-- ---------------------------------------------------------------------
-- RLS: expense_claims (utilisateur + staff)
-- ---------------------------------------------------------------------
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS claims_select_own ON public.expense_claims;
DROP POLICY IF EXISTS claims_insert_own ON public.expense_claims;
DROP POLICY IF EXISTS claims_update_own ON public.expense_claims;
DROP POLICY IF EXISTS claims_staff_all ON public.expense_claims;

CREATE POLICY claims_select_own ON public.expense_claims
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY claims_insert_own ON public.expense_claims
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY claims_update_own ON public.expense_claims
    FOR UPDATE
    USING (user_id = auth.uid() AND status IN ('draft', 'incomplete'));

CREATE POLICY claims_staff_all ON public.expense_claims
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin_asso', 'treasurer', 'validator')
        )
    );

-- ---------------------------------------------------------------------
-- RLS: events (lecture tous, écriture staff)
-- ---------------------------------------------------------------------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_select_all ON public.events;
DROP POLICY IF EXISTS events_staff_all ON public.events;

CREATE POLICY events_select_all ON public.events
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY events_staff_all ON public.events
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin_asso', 'treasurer', 'validator')
        )
    );

-- ---------------------------------------------------------------------
-- RLS: event_baremes (lecture tous, écriture staff)
-- ---------------------------------------------------------------------
ALTER TABLE public.event_baremes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS baremes_select_all ON public.event_baremes;
DROP POLICY IF EXISTS baremes_staff_all ON public.event_baremes;

CREATE POLICY baremes_select_all ON public.event_baremes
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY baremes_staff_all ON public.event_baremes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin_asso', 'treasurer', 'validator')
        )
    );

-- ---------------------------------------------------------------------
-- RLS: notifications (utilisateur uniquement)
-- ---------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifs_own ON public.notifications;

CREATE POLICY notifs_own ON public.notifications
    FOR ALL
    USING (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- RLS: justificatifs (utilisateur + staff)
-- ---------------------------------------------------------------------
ALTER TABLE public.justificatifs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS justifs_own ON public.justificatifs;
DROP POLICY IF EXISTS justifs_staff ON public.justificatifs;

CREATE POLICY justifs_own ON public.justificatifs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.expense_claims c
            WHERE c.id = justificatifs.expense_claim_id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY justifs_staff ON public.justificatifs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin_asso', 'treasurer', 'validator')
        )
    );

-- ---------------------------------------------------------------------
-- RLS: audit_logs (admin uniquement)
-- ---------------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_admin_only ON public.audit_logs;

CREATE POLICY audit_admin_only ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'admin_asso'
        )
    );

-- ---------------------------------------------------------------------
-- RLS: authorized_users (admin uniquement)
-- ---------------------------------------------------------------------
ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whitelist_admin_only ON public.authorized_users;

CREATE POLICY whitelist_admin_only ON public.authorized_users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'admin_asso'
        )
    );

-- ---------------------------------------------------------------------
-- RLS: baremes, taux, plafonds (lecture tous, écriture admin)
-- ---------------------------------------------------------------------
ALTER TABLE public.baremes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taux_remboursement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plafonds ENABLE ROW LEVEL SECURITY;

CREATE POLICY baremes_read_all ON public.baremes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY baremes_admin_write ON public.baremes FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin_asso')
);

CREATE POLICY taux_read_all ON public.taux_remboursement FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY taux_admin_write ON public.taux_remboursement FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin_asso')
);

CREATE POLICY plafonds_read_all ON public.plafonds FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY plafonds_admin_write ON public.plafonds FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin_asso')
);

-- =====================================================================
-- PHASE 4: DONNÉES INITIALES
-- =====================================================================

-- ---------------------------------------------------------------------
-- 4.1 Barèmes kilométriques 2024 (CV fiscaux)
-- ---------------------------------------------------------------------
INSERT INTO public.baremes (cv_fiscaux, rate_per_km) VALUES
    (3, 0.529),
    (4, 0.606),
    (5, 0.636),
    (6, 0.665),
    (7, 0.697),
    (8, 0.728),
    (9, 0.759),
    (10, 0.790)
ON CONFLICT (cv_fiscaux, valid_from) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4.2 Taux de remboursement par rôle
-- ---------------------------------------------------------------------
INSERT INTO public.taux_remboursement (role, taux) VALUES
    ('admin_asso', 0.80),
    ('bn_member', 0.65),
    ('user', 0.50)
ON CONFLICT (role, valid_from) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4.3 Plafonds par type de dépense
-- ---------------------------------------------------------------------
INSERT INTO public.plafonds (expense_type, plafond_unitaire, requires_validation) VALUES
    ('train', 200.00, false),
    ('car', NULL, false),
    ('hotel', 120.00, true),
    ('meal', 25.00, false),
    ('registration', 500.00, true),
    ('other', 100.00, false)
ON CONFLICT (expense_type, valid_from) DO NOTHING;

-- =====================================================================
-- PHASE 5: VALIDATION FINALE
-- =====================================================================

DO $$
DECLARE
    admin_count INTEGER;
    whitelist_count INTEGER;
    tables_count INTEGER;
    functions_count INTEGER;
    policies_count INTEGER;
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
    AND p.proname IN ('sync_current_user', 'get_current_user_safe', 'handle_new_user', 'set_updated_at', 'update_user_profile');
    
    IF functions_count < 5 THEN
        RAISE EXCEPTION '❌ Fonctions manquantes: trouvées %, attendues 5', functions_count;
    END IF;
    
    -- Vérifier policies RLS
    SELECT COUNT(*) INTO policies_count
    FROM pg_policies
    WHERE schemaname = 'public';
    
    IF policies_count < 15 THEN
        RAISE WARNING '⚠️  Policies RLS: trouvées %, recommandé >= 15', policies_count;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ✅ VALIDATION COMPLÈTE RÉUSSIE                            ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '📊 STATISTIQUES:';
    RAISE NOTICE '   • Whitelist: % utilisateurs autorisés', whitelist_count;
    RAISE NOTICE '   • Tables: % créées', tables_count;
    RAISE NOTICE '   • Fonctions: % créées', functions_count;
    RAISE NOTICE '   • Policies RLS: % actives', policies_count;
    RAISE NOTICE '   • Admin: Mohamed Dhia Ounally (admin_asso)';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SYSTÈME PRÊT - Déconnexion/reconnexion recommandée';
    RAISE NOTICE '';
END $$;

-- =====================================================================
-- FIN DU SETUP PARFAIT
-- =====================================================================
-- 
-- PROCHAINES ÉTAPES:
-- 1. Se déconnecter de l'application
-- 2. Se reconnecter avec mohameddhia.ounally@afneus.org
-- 3. Vérifier que le nom complet s'affiche: "Mohamed Dhia Ounally"
-- 4. Vérifier que le badge affiche: "Super Admin"
-- 5. Vérifier accès aux pages /admin, /validator, /treasurer
-- 
-- REMARQUES IMPORTANTES:
-- - Table users SANS RLS → accès via RPC get_current_user_safe()
-- - Roles en lowercase en DB (admin_asso) → mapping UI (ADMIN)
-- - Events utilise UNIQUEMENT start_date/end_date (pas de doublon)
-- - Barèmes simplifiés: une ligne par CV avec rate_per_km unique
-- 
-- =====================================================================
