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

-- Supprimer les fonctions (méthode brutale - supprimer le schéma public et le recréer)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- ================================================================
-- BASE NETTOYÉE - Prêt pour 01_INIT_COMPLETE.sql
-- ================================================================
