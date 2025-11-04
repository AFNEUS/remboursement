-- ================================================================
-- 🔒 PR1: ROW LEVEL SECURITY POLICIES COMPLÈTES
-- ================================================================
-- CRITIQUE: Active RLS sur TOUTES les tables + policies par rôle
-- Exécuter APRÈS 01_INIT_COMPLETE.sql
-- ================================================================

-- ================================================================
-- ACTIVER RLS SUR TOUTES LES TABLES
-- ================================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_baremes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- POLICIES: public.events
-- ================================================================

-- Tous peuvent voir les événements publiés
CREATE POLICY "Anyone can view published events"
  ON public.events FOR SELECT
  USING (status = 'PUBLISHED' OR status = 'ONGOING');

-- Admins peuvent tout voir
CREATE POLICY "Admins can view all events"
  ON public.events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Seuls les admins peuvent créer/modifier
CREATE POLICY "Admins can insert events"
  ON public.events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can delete events"
  ON public.events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ================================================================
-- POLICIES: public.event_baremes
-- ================================================================

-- Tous peuvent lire les barèmes (pour calculer montants)
CREATE POLICY "Anyone can view baremes"
  ON public.event_baremes FOR SELECT
  USING (true);

-- Seuls les admins peuvent modifier
CREATE POLICY "Admins can modify baremes"
  ON public.event_baremes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ================================================================
-- POLICIES: public.expense_claims
-- ================================================================

-- Users peuvent voir leurs propres demandes
CREATE POLICY "Users can view own claims"
  ON public.expense_claims FOR SELECT
  USING (auth.uid() = user_id);

-- Validators/Treasurers/Admins peuvent voir toutes les demandes
CREATE POLICY "Staff can view all claims"
  ON public.expense_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('VALIDATOR', 'TREASURER', 'ADMIN')
    )
  );

-- Users peuvent créer leurs propres demandes
CREATE POLICY "Users can insert own claims"
  ON public.expense_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users peuvent modifier leurs DRAFT
CREATE POLICY "Users can update own draft claims"
  ON public.expense_claims FOR UPDATE
  USING (
    auth.uid() = user_id 
    AND status = 'DRAFT'
  )
  WITH CHECK (
    auth.uid() = user_id 
    AND status = 'DRAFT'
  );

-- Validators peuvent changer le statut (DRAFT → TO_VALIDATE → VALIDATED/REJECTED)
CREATE POLICY "Validators can update claim status"
  ON public.expense_claims FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('VALIDATOR', 'TREASURER', 'ADMIN')
    )
  );

-- Treasurers peuvent tout modifier (y compris passer à PAID)
CREATE POLICY "Treasurers can update all claims"
  ON public.expense_claims FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('TREASURER', 'ADMIN')
    )
  );

-- Admins peuvent supprimer
CREATE POLICY "Admins can delete claims"
  ON public.expense_claims FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- ================================================================
-- POLICIES: public.expense_items
-- ================================================================

-- Users peuvent voir les items de leurs demandes
CREATE POLICY "Users can view own expense items"
  ON public.expense_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.expense_claims
      WHERE id = expense_items.claim_id
      AND user_id = auth.uid()
    )
  );

-- Staff peuvent voir tous les items
CREATE POLICY "Staff can view all expense items"
  ON public.expense_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('VALIDATOR', 'TREASURER', 'ADMIN')
    )
  );

-- Users peuvent insérer items dans leurs demandes DRAFT
CREATE POLICY "Users can insert items in own draft claims"
  ON public.expense_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expense_claims
      WHERE id = expense_items.claim_id
      AND user_id = auth.uid()
      AND status = 'DRAFT'
    )
  );

-- Users peuvent modifier items dans leurs demandes DRAFT
CREATE POLICY "Users can update items in own draft claims"
  ON public.expense_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.expense_claims
      WHERE id = expense_items.claim_id
      AND user_id = auth.uid()
      AND status = 'DRAFT'
    )
  );

-- Validators/Treasurers peuvent modifier tous les items
CREATE POLICY "Staff can update all items"
  ON public.expense_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('VALIDATOR', 'TREASURER', 'ADMIN')
    )
  );

-- Users peuvent supprimer items dans leurs demandes DRAFT
CREATE POLICY "Users can delete items in own draft claims"
  ON public.expense_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.expense_claims
      WHERE id = expense_items.claim_id
      AND user_id = auth.uid()
      AND status = 'DRAFT'
    )
  );

-- Admins peuvent tout supprimer
CREATE POLICY "Admins can delete all items"
  ON public.expense_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- ================================================================
-- DENY ANONYMOUS ACCESS (CRITICAL)
-- ================================================================

-- Bloquer tout accès anon aux tables sensibles
CREATE POLICY "Deny anonymous access to events"
  ON public.events FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Deny anonymous access to claims"
  ON public.expense_claims FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Deny anonymous access to items"
  ON public.expense_items FOR ALL
  USING (auth.role() = 'authenticated');

-- ================================================================
-- TESTS RLS (À exécuter pour vérifier)
-- ================================================================

-- Test 1: User normal ne peut pas voir les demandes des autres
-- SET LOCAL ROLE authenticated;
-- SET LOCAL request.jwt.claim.sub = '<user_id>';
-- SELECT * FROM expense_claims; -- Devrait ne retourner QUE ses demandes

-- Test 2: Validator peut voir toutes les demandes
-- SET LOCAL ROLE authenticated;
-- SET LOCAL request.jwt.claim.sub = '<validator_id>';
-- SELECT * FROM expense_claims; -- Devrait tout retourner

-- Test 3: Anon ne peut rien faire
-- SET LOCAL ROLE anon;
-- SELECT * FROM expense_claims; -- Devrait retourner 0 lignes

-- ================================================================
-- RLS ACTIVÉ ✅
-- ================================================================

-- Vérifier l'activation
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
AND tablename IN ('users', 'events', 'event_baremes', 'expense_claims', 'expense_items')
ORDER BY tablename;

-- Résultat attendu:
-- users            | t | 5+
-- events           | t | 6
-- event_baremes    | t | 2
-- expense_claims   | t | 9
-- expense_items    | t | 9
