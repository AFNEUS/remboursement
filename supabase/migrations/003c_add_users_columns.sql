-- ============================================
-- Migration 003C: Ajout colonnes manquantes dans users
-- ============================================

-- Ajouter first_name si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'first_name'
    ) THEN
        ALTER TABLE public.users ADD COLUMN first_name TEXT;
    END IF;
END $$;

-- Ajouter last_name si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'last_name'
    ) THEN
        ALTER TABLE public.users ADD COLUMN last_name TEXT;
    END IF;
END $$;

-- Ajouter status_code si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'status_code'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN status_code TEXT DEFAULT 'AUTRE' 
        REFERENCES member_statuses(code);
        
        CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status_code);
    END IF;
END $$;

-- Ajouter role si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN role TEXT DEFAULT 'MEMBER' 
        CHECK (role IN ('ADMIN', 'TREASURER', 'VALIDATOR', 'MEMBER'));
        
        CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
    END IF;
END $$;

-- Ajouter is_active si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.users ADD COLUMN is_active BOOLEAN DEFAULT true;
        CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active);
    END IF;
END $$;

-- Ajouter iban si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'iban'
    ) THEN
        ALTER TABLE public.users ADD COLUMN iban TEXT;
    END IF;
END $$;

-- Ajouter iban_verified si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'iban_verified'
    ) THEN
        ALTER TABLE public.users ADD COLUMN iban_verified BOOLEAN DEFAULT false;
    END IF;
END $$;
