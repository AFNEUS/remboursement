-- ============================================
-- NETTOYAGE COMPLET - À EXÉCUTER EN PREMIER
-- ============================================
-- ⚠️ ATTENTION : Ce script supprime TOUT
-- Exécuter AVANT 000_master_init.sql
-- ============================================

-- 1. Supprimer toutes les TRIGGERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
DROP TRIGGER IF EXISTS update_claims_updated_at ON public.expense_claims;
DROP TRIGGER IF EXISTS update_items_updated_at ON public.expense_items;
DROP TRIGGER IF EXISTS auto_calc_reimbursement ON public.expense_items;
DROP TRIGGER IF EXISTS update_claim_total_on_item ON public.expense_items;
DROP TRIGGER IF EXISTS auto_create_baremes_on_event ON public.events;

-- 2. Supprimer toutes les VUES
DROP VIEW IF EXISTS public.claims_enriched CASCADE;
DROP VIEW IF EXISTS public.email_stats_simple CASCADE;
DROP VIEW IF EXISTS public.event_baremes_with_stats CASCADE;
DROP VIEW IF EXISTS public.event_summary CASCADE;

-- 3. Supprimer toutes les FONCTIONS
DROP FUNCTION IF EXISTS public.calculate_reimbursement(UUID, TEXT, DECIMAL, UUID, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_car_distance(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_tgvmax_worth_it(UUID, UUID, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.validate_receipt_requirement(TEXT, DECIMAL, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.create_default_baremes(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.auto_calculate_reimbursement() CASCADE;
DROP FUNCTION IF EXISTS public.update_claim_total() CASCADE;
DROP FUNCTION IF EXISTS public.auto_create_baremes() CASCADE;

-- 4. Supprimer toutes les TABLES (ordre important à cause des foreign keys)
DROP TABLE IF EXISTS public.sncf_price_history CASCADE;
DROP TABLE IF EXISTS public.event_baremes CASCADE;
DROP TABLE IF EXISTS public.email_queue CASCADE;
DROP TABLE IF EXISTS public.email_templates CASCADE;
DROP TABLE IF EXISTS public.payment_batches CASCADE;
DROP TABLE IF EXISTS public.expense_items CASCADE;
DROP TABLE IF EXISTS public.expense_claims CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 5. Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Nettoyage terminé ! Vous pouvez maintenant exécuter 000_master_init.sql';
END $$;
