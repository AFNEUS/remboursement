-- ================================================================
-- RESET COMPLET DE LA BASE DE DONNÉES
-- ================================================================
-- ⚠️  ATTENTION : CE FICHIER SUPPRIME TOUT !
-- À exécuter UNIQUEMENT pour repartir de zéro
-- ================================================================

-- Supprimer toutes les policies RLS
DO $$ 
DECLARE pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Supprimer les fonctions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_profile(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_user_profile(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, TEXT, TEXT) CASCADE;

-- Supprimer les vues
DROP VIEW IF EXISTS public.user_profile CASCADE;

-- Supprimer les triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_claims_updated_at ON public.expense_claims;
DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;

-- Supprimer les tables (CASCADE pour les dépendances)
DROP TABLE IF EXISTS public.expense_items CASCADE;
DROP TABLE IF EXISTS public.expense_claims CASCADE;
DROP TABLE IF EXISTS public.event_baremes CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ================================================================
-- BASE NETTOYÉE - Prêt pour 01_INIT_COMPLETE.sql
-- ================================================================
