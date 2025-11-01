-- ═══════════════════════════════════════════════════════════════
-- 🔒 ROW LEVEL SECURITY (RLS) - CONFIGURATION COMPLÈTE
-- ═══════════════════════════════════════════════════════════════
-- 
-- Ce script configure RLS sur TOUTES les tables pour permettre :
-- - Lecture/écriture selon les rôles
-- - Sécurité stricte
-- - Fonctionnement correct de l'application
--
-- Tables concernées :
-- - public.users ✅
-- - public.expense_claims (demandes de remboursement)
-- - public.events (événements)
-- - public.event_baremes (barèmes événements)
-- - public.mileage_rates (barèmes kilométriques)
-- - public.expense_claim_history (historique)
--
-- ⚠️ À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1️⃣ TABLE: expense_claims (Demandes de remboursement)
-- ═══════════════════════════════════════════════════════════════

-- Activer RLS
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;

-- Supprimer anciennes policies
DROP POLICY IF EXISTS "Users can view own claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Users can create own claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Users can update own draft claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Validators can view all claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Validators can update claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Service role full access" ON public.expense_claims;

-- 🔒 POLICY: Users peuvent voir leurs propres demandes
CREATE POLICY "Users can view own claims"
  ON public.expense_claims
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('ADMIN', 'TREASURER', 'VALIDATOR')
    )
  );

-- 🔒 POLICY: Users peuvent créer leurs demandes
CREATE POLICY "Users can create own claims"
  ON public.expense_claims
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 🔒 POLICY: Users peuvent modifier leurs brouillons
CREATE POLICY "Users can update own draft claims"
  ON public.expense_claims
  FOR UPDATE
  USING (
    auth.uid() = user_id 
    AND status IN ('DRAFT', 'INFO_REQUESTED')
  )
  WITH CHECK (
    auth.uid() = user_id 
    AND status IN ('DRAFT', 'PENDING', 'INFO_REQUESTED')
  );

-- 🔒 POLICY: Validators peuvent modifier les demandes
CREATE POLICY "Validators can update claims"
  ON public.expense_claims
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('ADMIN', 'TREASURER', 'VALIDATOR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('ADMIN', 'TREASURER', 'VALIDATOR')
    )
  );

-- 🔒 POLICY: Service role
CREATE POLICY "Service role full access"
  ON public.expense_claims
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 2️⃣ TABLE: events (Événements)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view events" ON public.events;
DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
DROP POLICY IF EXISTS "Service role events" ON public.events;

-- 🔒 POLICY: Tous peuvent voir les événements
CREATE POLICY "Everyone can view events"
  ON public.events
  FOR SELECT
  USING (true);

-- 🔒 POLICY: Admin peut gérer les événements
CREATE POLICY "Admins can manage events"
  ON public.events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- 🔒 POLICY: Service role
CREATE POLICY "Service role events"
  ON public.events
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 3️⃣ TABLE: event_baremes (Barèmes événements)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.event_baremes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view event baremes" ON public.event_baremes;
DROP POLICY IF EXISTS "Admins can manage event baremes" ON public.event_baremes;
DROP POLICY IF EXISTS "Service role event baremes" ON public.event_baremes;

-- 🔒 POLICY: Tous peuvent voir les barèmes
CREATE POLICY "Everyone can view event baremes"
  ON public.event_baremes
  FOR SELECT
  USING (true);

-- 🔒 POLICY: Admin peut gérer les barèmes
CREATE POLICY "Admins can manage event baremes"
  ON public.event_baremes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- 🔒 POLICY: Service role
CREATE POLICY "Service role event baremes"
  ON public.event_baremes
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 4️⃣ TABLE: mileage_rates (Barèmes kilométriques)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.mileage_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view mileage rates" ON public.mileage_rates;
DROP POLICY IF EXISTS "Admins can manage mileage rates" ON public.mileage_rates;
DROP POLICY IF EXISTS "Service role mileage rates" ON public.mileage_rates;

-- 🔒 POLICY: Tous peuvent voir les barèmes
CREATE POLICY "Everyone can view mileage rates"
  ON public.mileage_rates
  FOR SELECT
  USING (true);

-- 🔒 POLICY: Admin peut gérer les barèmes
CREATE POLICY "Admins can manage mileage rates"
  ON public.mileage_rates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- 🔒 POLICY: Service role
CREATE POLICY "Service role mileage rates"
  ON public.mileage_rates
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 5️⃣ TABLE: expense_claim_history (Historique)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.expense_claim_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view related history" ON public.expense_claim_history;
DROP POLICY IF EXISTS "System can insert history" ON public.expense_claim_history;
DROP POLICY IF EXISTS "Service role history" ON public.expense_claim_history;

-- 🔒 POLICY: Users peuvent voir l'historique de leurs demandes
CREATE POLICY "Users can view related history"
  ON public.expense_claim_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.expense_claims
      WHERE id = expense_claim_history.expense_claim_id
      AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('ADMIN', 'TREASURER', 'VALIDATOR')
    )
  );

-- 🔒 POLICY: Système peut insérer historique
CREATE POLICY "System can insert history"
  ON public.expense_claim_history
  FOR INSERT
  WITH CHECK (true); -- Géré par triggers

-- 🔒 POLICY: Service role
CREATE POLICY "Service role history"
  ON public.expense_claim_history
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 6️⃣ VÉRIFICATIONS FINALES
-- ═══════════════════════════════════════════════════════════════

-- Compter les policies par table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Lister toutes les policies RLS
SELECT 
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Vérifier que RLS est activé sur toutes les tables
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'expense_claims', 'events', 'event_baremes', 'mileage_rates', 'expense_claim_history')
ORDER BY tablename;

-- ═══════════════════════════════════════════════════════════════
-- ✅ CONFIGURATION TERMINÉE !
-- ═══════════════════════════════════════════════════════════════
-- 
-- Policies créées pour :
-- ✅ users (5 policies)
-- ✅ expense_claims (5 policies)
-- ✅ events (3 policies)
-- ✅ event_baremes (3 policies)
-- ✅ mileage_rates (3 policies)
-- ✅ expense_claim_history (3 policies)
--
-- Total : ~22 policies RLS
--
-- PERMISSIONS :
-- - Users : Voir/créer/modifier leurs demandes
-- - Validators : Voir/modifier toutes les demandes
-- - Admin : Gérer événements, barèmes, utilisateurs
-- - Tous : Voir événements et barèmes (lecture seule)
--
-- ═══════════════════════════════════════════════════════════════
