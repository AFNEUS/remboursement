-- ============================================
-- Migration 005: Dashboard et statistiques
-- ============================================

-- ============================================
-- 1. Vue statistiques par événement
-- ============================================
CREATE OR REPLACE VIEW public.event_statistics AS
SELECT 
  e.id as event_id,
  e.name as event_name,
  COALESCE(e.event_type, 'AUTRE') as event_type,
  e.date_start,
  e.date_end,
  e.location,
  COUNT(DISTINCT ec.id) as total_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'submitted' THEN ec.id END) as pending_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'validated' THEN ec.id END) as validated_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'paid' THEN ec.id END) as paid_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'rejected' THEN ec.id END) as rejected_claims,
  COALESCE(SUM(ec.total_amount), 0) as total_requested,
  COALESCE(SUM(CASE WHEN ec.status = 'validated' THEN ec.validated_amount END), 0) as total_validated,
  COALESCE(SUM(CASE WHEN ec.status = 'paid' THEN ec.validated_amount END), 0) as total_paid,
  COUNT(DISTINCT ec.user_id) as unique_members
FROM public.events e
LEFT JOIN public.expense_claims ec ON e.id = ec.event_id
GROUP BY e.id, e.name, e.event_type, e.date_start, e.date_end, e.location;

-- ============================================
-- 2. Vue statistiques par type de dépense
-- ============================================
CREATE OR REPLACE VIEW public.expense_type_statistics AS
SELECT 
  ei.expense_type,
  COUNT(*) as total_items,
  COALESCE(SUM(ei.amount), 0) as total_amount,
  COALESCE(AVG(ei.amount), 0) as average_amount,
  COALESCE(SUM(CASE WHEN ei.expense_type = 'CAR' THEN ei.distance_km END), 0) as total_km,
  COALESCE(SUM(CASE WHEN ei.expense_type = 'CAR' THEN ei.carpooling_bonus END), 0) as total_carpooling_bonus,
  COUNT(CASE WHEN ei.expense_type = 'CAR' AND JSONB_ARRAY_LENGTH(ei.passengers) > 0 THEN 1 END) as carpooling_trips,
  COUNT(DISTINCT ei.claim_id) as unique_claims,
  DATE_TRUNC('month', ei.expense_date) as month
FROM public.expense_items ei
JOIN public.expense_claims ec ON ei.claim_id = ec.id
WHERE ec.status IN ('validated', 'paid')
GROUP BY ei.expense_type, DATE_TRUNC('month', ei.expense_date)
ORDER BY month DESC, ei.expense_type;

-- ============================================
-- 3. Vue statistiques par membre
-- ============================================
CREATE OR REPLACE VIEW public.member_statistics AS
SELECT 
  u.id as user_id,
  u.first_name,
  u.last_name,
  u.email,
  u.status_code,
  u.role,
  COUNT(DISTINCT ec.id) as total_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'draft' THEN ec.id END) as draft_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'submitted' THEN ec.id END) as pending_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'validated' THEN ec.id END) as validated_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'paid' THEN ec.id END) as paid_claims,
  COALESCE(SUM(ec.total_amount), 0) as total_requested,
  COALESCE(SUM(CASE WHEN ec.status = 'validated' OR ec.status = 'paid' THEN ec.validated_amount END), 0) as total_validated,
  COALESCE(SUM(CASE WHEN ec.status = 'paid' THEN ec.validated_amount END), 0) as total_paid,
  MAX(ec.created_at) as last_claim_date
FROM public.users u
LEFT JOIN public.expense_claims ec ON u.id = ec.user_id
GROUP BY u.id, u.first_name, u.last_name, u.email, u.status_code, u.role;

-- ============================================
-- 4. Vue statistiques globales (dashboard principal)
-- ============================================
CREATE OR REPLACE VIEW public.global_statistics AS
SELECT 
  'global' as scope,
  COUNT(DISTINCT ec.id) as total_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'submitted' THEN ec.id END) as pending_validation,
  COUNT(DISTINCT CASE WHEN ec.status = 'validated' THEN ec.id END) as pending_payment,
  COUNT(DISTINCT CASE WHEN ec.status = 'paid' THEN ec.id END) as paid_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'rejected' THEN ec.id END) as rejected_claims,
  COALESCE(SUM(ec.total_amount), 0) as total_requested,
  COALESCE(SUM(CASE WHEN ec.status IN ('validated', 'paid') THEN ec.validated_amount END), 0) as total_validated,
  COALESCE(SUM(CASE WHEN ec.status = 'paid' THEN ec.validated_amount END), 0) as total_paid,
  COUNT(DISTINCT ec.user_id) as active_members,
  COUNT(DISTINCT ei.id) as total_expense_items,
  COALESCE(SUM(CASE WHEN ei.expense_type = 'CAR' THEN ei.distance_km END), 0) as total_kilometers,
  COALESCE(SUM(CASE WHEN ei.expense_type = 'CAR' THEN ei.carpooling_bonus END), 0) as total_carpooling_savings,
  COUNT(DISTINCT CASE WHEN ei.expense_type = 'CAR' AND JSONB_ARRAY_LENGTH(ei.passengers) > 0 THEN ei.id END) as total_carpooling_trips,
  COUNT(DISTINCT CASE WHEN ei.expense_type = 'TGVMAX' THEN ec.user_id END) as members_with_tgvmax
FROM public.expense_claims ec
LEFT JOIN public.expense_items ei ON ec.id = ei.claim_id;

-- ============================================
-- 5. Vue analyse par mois (comptabilité)
-- ============================================
CREATE OR REPLACE VIEW public.monthly_accounting AS
SELECT 
  DATE_TRUNC('month', ec.created_at) as month,
  COUNT(DISTINCT ec.id) as claims_count,
  COUNT(DISTINCT ec.user_id) as unique_members,
  COALESCE(SUM(ec.total_amount), 0) as requested_amount,
  COALESCE(SUM(CASE WHEN ec.status IN ('validated', 'paid') THEN ec.validated_amount END), 0) as validated_amount,
  COALESCE(SUM(CASE WHEN ec.status = 'paid' THEN ec.validated_amount END), 0) as paid_amount,
  COALESCE(SUM(CASE WHEN ec.status IN ('validated', 'paid') THEN ec.validated_amount END), 0) - 
    COALESCE(SUM(CASE WHEN ec.status = 'paid' THEN ec.validated_amount END), 0) as pending_payment,
  
  -- Détail par type de dépense
  COUNT(DISTINCT CASE WHEN ei.expense_type = 'CAR' THEN ei.id END) as car_expenses_count,
  COALESCE(SUM(CASE WHEN ei.expense_type = 'CAR' THEN ei.amount END), 0) as car_total,
  
  COUNT(DISTINCT CASE WHEN ei.expense_type = 'TRAIN' THEN ei.id END) as train_expenses_count,
  COALESCE(SUM(CASE WHEN ei.expense_type = 'TRAIN' THEN ei.amount END), 0) as train_total,
  
  COUNT(DISTINCT CASE WHEN ei.expense_type = 'TGVMAX' THEN ei.id END) as tgvmax_count,
  COALESCE(SUM(CASE WHEN ei.expense_type = 'TGVMAX' THEN ei.amount END), 0) as tgvmax_total,
  
  COUNT(DISTINCT CASE WHEN ei.expense_type = 'HOTEL' THEN ei.id END) as hotel_count,
  COALESCE(SUM(CASE WHEN ei.expense_type = 'HOTEL' THEN ei.amount END), 0) as hotel_total,
  
  COUNT(DISTINCT CASE WHEN ei.expense_type = 'MEAL' THEN ei.id END) as meal_count,
  COALESCE(SUM(CASE WHEN ei.expense_type = 'MEAL' THEN ei.amount END), 0) as meal_total
  
FROM public.expense_claims ec
LEFT JOIN public.expense_items ei ON ec.id = ei.claim_id
GROUP BY DATE_TRUNC('month', ec.created_at)
ORDER BY month DESC;

-- ============================================
-- 6. Vue analyse covoiturage (économies)
-- ============================================
CREATE OR REPLACE VIEW public.carpooling_analysis AS
SELECT 
  DATE_TRUNC('month', ei.expense_date) as month,
  COUNT(CASE WHEN JSONB_ARRAY_LENGTH(ei.passengers) > 0 THEN 1 END) as carpooling_trips,
  COUNT(CASE WHEN JSONB_ARRAY_LENGTH(ei.passengers) = 0 THEN 1 END) as solo_trips,
  COALESCE(SUM(CASE WHEN JSONB_ARRAY_LENGTH(ei.passengers) > 0 THEN ei.distance_km END), 0) as carpooling_km,
  COALESCE(SUM(CASE WHEN JSONB_ARRAY_LENGTH(ei.passengers) = 0 THEN ei.distance_km END), 0) as solo_km,
  COALESCE(SUM(ei.carpooling_bonus), 0) as total_bonus_paid,
  COALESCE(AVG(CASE WHEN JSONB_ARRAY_LENGTH(ei.passengers) > 0 THEN JSONB_ARRAY_LENGTH(ei.passengers) + 1 END), 0) as avg_passengers_per_car,
  
  -- Calcul économie AFNEUS (base 0.12€/km vs fiscal 0.636€/km)
  COALESCE(SUM(ei.distance_km), 0) * 0.636 as theoretical_fiscal_cost,
  COALESCE(SUM(ei.amount), 0) as actual_cost,
  (COALESCE(SUM(ei.distance_km), 0) * 0.636) - COALESCE(SUM(ei.amount), 0) as savings_for_afneus
FROM public.expense_items ei
WHERE ei.expense_type = 'CAR'
GROUP BY DATE_TRUNC('month', ei.expense_date)
ORDER BY month DESC;

-- ============================================
-- 7. Vue TGV Max - Suivi abonnements
-- ============================================
CREATE OR REPLACE VIEW public.tgvmax_subscriptions AS
SELECT 
  u.id as user_id,
  u.first_name,
  u.last_name,
  u.email,
  COUNT(ei.id) as tgvmax_claims_count,
  COALESCE(SUM(ei.amount), 0) as total_tgvmax_amount,
  MIN(ei.expense_date) as first_claim_date,
  MAX(ei.expense_date) as last_claim_date,
  ARRAY_AGG(DISTINCT DATE_TRUNC('month', ei.expense_date)::date ORDER BY DATE_TRUNC('month', ei.expense_date)::date DESC) as months_with_claims
FROM public.users u
JOIN public.expense_claims ec ON u.id = ec.user_id
JOIN public.expense_items ei ON ec.id = ei.claim_id
WHERE ei.expense_type = 'TGVMAX'
  AND ec.status IN ('validated', 'paid')
GROUP BY u.id, u.first_name, u.last_name, u.email;

-- ============================================
-- 8. Permissions RLS pour les vues
-- ============================================

-- Statistiques événements : accessible aux validateurs et admins
ALTER VIEW public.event_statistics SET (security_invoker = true);
ALTER VIEW public.expense_type_statistics SET (security_invoker = true);
ALTER VIEW public.member_statistics SET (security_invoker = true);
ALTER VIEW public.global_statistics SET (security_invoker = true);
ALTER VIEW public.monthly_accounting SET (security_invoker = true);
ALTER VIEW public.carpooling_analysis SET (security_invoker = true);
ALTER VIEW public.tgvmax_subscriptions SET (security_invoker = true);

-- ============================================
-- 9. Fonction helper : Récupérer le dashboard complet
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'global', (SELECT row_to_json(g) FROM public.global_statistics g LIMIT 1),
    'recent_months', (SELECT json_agg(m) FROM (SELECT * FROM public.monthly_accounting ORDER BY month DESC LIMIT 6) m),
    'carpooling', (SELECT json_agg(c) FROM (SELECT * FROM public.carpooling_analysis ORDER BY month DESC LIMIT 6) c),
    'pending_claims', (
      SELECT json_agg(row_to_json(ec))
      FROM (
        SELECT ec.*, u.first_name, u.last_name
        FROM public.expense_claims ec
        JOIN public.users u ON ec.user_id = u.id
        WHERE ec.status = 'submitted'
        ORDER BY ec.created_at DESC
        LIMIT 10
      ) ec
    ),
    'recent_events', (
      SELECT json_agg(row_to_json(e))
      FROM (
        SELECT * FROM public.event_statistics
        WHERE date_start >= CURRENT_DATE - INTERVAL '3 months'
        ORDER BY date_start DESC
        LIMIT 5
      ) e
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ============================================
-- 10. Commentaires pour documentation
-- ============================================
COMMENT ON VIEW public.event_statistics IS 'Statistiques agrégées par événement pour le dashboard';
COMMENT ON VIEW public.expense_type_statistics IS 'Analyse des dépenses par type et par mois';
COMMENT ON VIEW public.member_statistics IS 'Statistiques par membre (total demandes, montants, etc.)';
COMMENT ON VIEW public.global_statistics IS 'Vue d''ensemble globale pour le dashboard principal';
COMMENT ON VIEW public.monthly_accounting IS 'Comptabilité mensuelle détaillée par type de dépense';
COMMENT ON VIEW public.carpooling_analysis IS 'Analyse du covoiturage et économies pour AFNEUS';
COMMENT ON VIEW public.tgvmax_subscriptions IS 'Suivi des membres avec abonnement TGV Max';
COMMENT ON FUNCTION public.get_dashboard_data IS 'Récupère toutes les données nécessaires pour le dashboard en une seule requête';
