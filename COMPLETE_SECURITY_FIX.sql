-- ================================================================
-- FICHIER UNIQUE : COMPLETE_SECURITY_FIX.sql
-- ================================================================
-- Ce fichier contient TOUTES les corrections nécessaires :
-- 1. Trigger sécurisé pour auto-création des utilisateurs
-- 2. Fonction update_user_profile pour le profil
-- 3. Vue user_profile avec statistiques
-- 4. RLS complet pour TOUTES les tables
--
-- EXÉCUTER CE FICHIER DANS SUPABASE SQL EDITOR
-- ================================================================

-- ================================================================
-- PARTIE 1 : NETTOYAGE (si déjà exécuté avant)
-- ================================================================

-- Supprimer le trigger existant s'il existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.users;
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.users;

DROP POLICY IF EXISTS "Users can view own claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Users can create own claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Users can update own pending claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Validators can view all claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Validators can update claims" ON public.expense_claims;

DROP POLICY IF EXISTS "Everyone can view events" ON public.events;
DROP POLICY IF EXISTS "Admin can insert events" ON public.events;
DROP POLICY IF EXISTS "Admin can update events" ON public.events;

DROP POLICY IF EXISTS "Everyone can view event baremes" ON public.event_baremes;
DROP POLICY IF EXISTS "Admin can insert event baremes" ON public.event_baremes;
DROP POLICY IF EXISTS "Admin can update event baremes" ON public.event_baremes;

-- Supprimer fonction et vue
DROP FUNCTION IF EXISTS public.update_user_profile(TEXT, TEXT, TEXT);
DROP VIEW IF EXISTS public.user_profile;

-- ================================================================
-- PARTIE 2 : TRIGGER SÉCURISÉ POUR AUTO-CRÉATION UTILISATEURS
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT := 'MEMBER';
  v_status TEXT := 'PENDING';
  v_email TEXT;
BEGIN
  -- Récupérer l'email depuis NEW (pas OLD!)
  v_email := NEW.email;

  -- WHITELIST : Attribution des rôles privilégiés
  IF v_email = 'mohameddhia.ounally@afneus.org' THEN
    v_role := 'ADMIN';
    v_status := 'ACTIVE';
  ELSIF v_email = 'yannis.loumouamou@afneus.org' THEN
    v_role := 'TREASURER';
    v_status := 'ACTIVE';
  ELSIF v_email LIKE '%@afneus.org' THEN
    v_role := 'MEMBER';
    v_status := 'ACTIVE';
  ELSE
    -- Emails externes : en attente de validation
    v_role := 'MEMBER';
    v_status := 'PENDING';
  END IF;

  -- Créer l'utilisateur dans public.users
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    role,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    v_role,
    v_status,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Créer le trigger sur auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- PARTIE 3 : FONCTION UPDATE_USER_PROFILE
-- ================================================================

CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_first_name TEXT,
  p_last_name TEXT,
  p_iban TEXT
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  -- Récupérer l'ID de l'utilisateur connecté
  v_user_id := auth.uid();

  -- Vérifier que l'utilisateur est authentifié
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validation des données
  IF p_first_name IS NULL OR TRIM(p_first_name) = '' THEN
    RAISE EXCEPTION 'First name is required';
  END IF;

  IF p_last_name IS NULL OR TRIM(p_last_name) = '' THEN
    RAISE EXCEPTION 'Last name is required';
  END IF;

  IF p_iban IS NOT NULL AND (LENGTH(TRIM(p_iban)) < 15 OR LENGTH(TRIM(p_iban)) > 34) THEN
    RAISE EXCEPTION 'IBAN must be between 15 and 34 characters';
  END IF;

  -- Mettre à jour le profil (sans toucher role, status, email)
  UPDATE public.users
  SET
    first_name = TRIM(p_first_name),
    last_name = TRIM(p_last_name),
    iban = CASE WHEN p_iban IS NOT NULL THEN TRIM(p_iban) ELSE iban END,
    updated_at = NOW()
  WHERE id = v_user_id;

  -- Vérifier que la mise à jour a réussi
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Retourner les données mises à jour
  SELECT json_build_object(
    'id', id,
    'email', email,
    'first_name', first_name,
    'last_name', last_name,
    'iban', iban,
    'role', role,
    'status', status
  ) INTO v_result
  FROM public.users
  WHERE id = v_user_id;

  RETURN v_result;
END;
$$;

-- ================================================================
-- PARTIE 4 : VUE USER_PROFILE AVEC STATISTIQUES
-- ================================================================

CREATE OR REPLACE VIEW public.user_profile AS
SELECT
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.iban,
  u.role,
  u.status,
  u.created_at,
  u.updated_at,
  COUNT(DISTINCT ec.id) AS total_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'PENDING' THEN ec.id END) AS pending_claims,
  COUNT(DISTINCT CASE WHEN ec.status = 'APPROVED' THEN ec.id END) AS approved_claims,
  COALESCE(SUM(CASE WHEN ec.status = 'APPROVED' THEN ec.total_amount ELSE 0 END), 0) AS total_reimbursed
FROM public.users u
LEFT JOIN public.expense_claims ec ON ec.user_id = u.id
GROUP BY u.id, u.email, u.first_name, u.last_name, u.iban, u.role, u.status, u.created_at, u.updated_at;

-- ================================================================
-- PARTIE 5 : RLS - TABLE USERS
-- ================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leur propre profil
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Les utilisateurs peuvent mettre à jour leur propre profil
-- (SANS changer role, status, email)
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND status = (SELECT status FROM public.users WHERE id = auth.uid())
    AND email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

-- Les admins peuvent voir tous les profils
CREATE POLICY "Admin can view all profiles"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Les admins peuvent mettre à jour tous les profils
CREATE POLICY "Admin can update all profiles"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Les admins peuvent supprimer des profils
CREATE POLICY "Admin can delete profiles"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ================================================================
-- PARTIE 6 : RLS - TABLE EXPENSE_CLAIMS
-- ================================================================

ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs propres demandes
CREATE POLICY "Users can view own claims"
  ON public.expense_claims
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('VALIDATOR', 'TREASURER', 'ADMIN')
    )
  );

-- Les utilisateurs peuvent créer leurs propres demandes
CREATE POLICY "Users can create own claims"
  ON public.expense_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Les utilisateurs peuvent mettre à jour leurs demandes (si PENDING)
CREATE POLICY "Users can update own pending claims"
  ON public.expense_claims
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'PENDING'
  );

-- Les validateurs peuvent voir toutes les demandes
CREATE POLICY "Validators can view all claims"
  ON public.expense_claims
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('VALIDATOR', 'TREASURER', 'ADMIN')
    )
  );

-- Les validateurs peuvent mettre à jour les demandes
CREATE POLICY "Validators can update claims"
  ON public.expense_claims
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('VALIDATOR', 'TREASURER', 'ADMIN')
    )
  );

-- ================================================================
-- PARTIE 7 : RLS - TABLE EVENTS
-- ================================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les événements
CREATE POLICY "Everyone can view events"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (true);

-- Seuls les admins peuvent créer des événements
CREATE POLICY "Admin can insert events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Seuls les admins peuvent mettre à jour des événements
CREATE POLICY "Admin can update events"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ================================================================
-- PARTIE 8 : RLS - TABLE EVENT_BAREMES
-- ================================================================

ALTER TABLE public.event_baremes ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les barèmes
CREATE POLICY "Everyone can view event baremes"
  ON public.event_baremes
  FOR SELECT
  TO authenticated
  USING (true);

-- Seuls les admins peuvent créer des barèmes
CREATE POLICY "Admin can insert event baremes"
  ON public.event_baremes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Seuls les admins peuvent mettre à jour des barèmes
CREATE POLICY "Admin can update event baremes"
  ON public.event_baremes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ================================================================
-- PARTIE 9 : FIN DU FICHIER
-- ================================================================

-- Vérifications après exécution :
-- 1. Vérifier le trigger :
--    SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';
--
-- 2. Vérifier la fonction :
--    SELECT proname FROM pg_proc WHERE proname = 'update_user_profile';
--
-- 3. Compter les policies (doit retourner 4 tables) :
--    SELECT tablename, COUNT(*) FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename;
--
-- 4. Tester la vue :
--    SELECT * FROM user_profile LIMIT 1;

