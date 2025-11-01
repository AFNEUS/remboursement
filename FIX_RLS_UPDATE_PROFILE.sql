-- ═══════════════════════════════════════════════════════════════
-- 🔧 CORRECTION COMPLÈTE RLS + FONCTIONS UPDATE
-- ═══════════════════════════════════════════════════════════════
-- 
-- Ce script corrige :
-- 1. Row Level Security (RLS) sur public.users
-- 2. Fonction update_user_profile pour modifier profil
-- 3. Permissions correctes pour UPDATE
--
-- ⚠️ À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1️⃣ SUPPRIMER ANCIENNES POLICIES (cleanup)
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Service role can do anything" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- ═══════════════════════════════════════════════════════════════
-- 2️⃣ NOUVELLES POLICIES RLS (CORRIGÉES)
-- ═══════════════════════════════════════════════════════════════

-- 🔒 POLICY 1 : Lecture de son propre profil
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- 🔒 POLICY 2 : Modification de son propre profil
-- ⚠️ CORRECTION : Permet UPDATE de first_name, last_name, iban uniquement
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Vérifie que les champs protégés ne sont PAS modifiés
    AND (OLD.role = NEW.role)
    AND (OLD.status = NEW.status)
    AND (OLD.email = NEW.email)
  );

-- 🔒 POLICY 3 : ADMIN peut voir tous les utilisateurs
CREATE POLICY "Admins can view all users"
  ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- 🔒 POLICY 4 : ADMIN peut modifier tous les utilisateurs
CREATE POLICY "Admins can update all users"
  ON public.users
  FOR UPDATE
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

-- 🔒 POLICY 5 : Service role (pour triggers uniquement)
CREATE POLICY "Service role can do anything"
  ON public.users
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 3️⃣ FONCTION : Update profil utilisateur (SÉCURISÉE)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_first_name TEXT,
  p_last_name TEXT,
  p_iban TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Exécute avec privilèges élevés
SET search_path = public
AS $$
BEGIN
  -- Validation : Utilisateur connecté
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté pour modifier votre profil';
  END IF;
  
  -- Validation : Prénom et nom obligatoires
  IF p_first_name IS NULL OR TRIM(p_first_name) = '' THEN
    RAISE EXCEPTION 'Le prénom est obligatoire';
  END IF;
  
  IF p_last_name IS NULL OR TRIM(p_last_name) = '' THEN
    RAISE EXCEPTION 'Le nom est obligatoire';
  END IF;
  
  -- Validation IBAN (si fourni)
  IF p_iban IS NOT NULL AND TRIM(p_iban) != '' THEN
    -- IBAN simplifié : entre 15 et 34 caractères alphanumériques
    IF LENGTH(REGEXP_REPLACE(p_iban, '[^A-Z0-9]', '', 'g')) < 15 THEN
      RAISE EXCEPTION 'IBAN invalide (trop court)';
    END IF;
  END IF;
  
  -- Mise à jour du profil
  UPDATE public.users
  SET 
    first_name = TRIM(p_first_name),
    last_name = TRIM(p_last_name),
    iban = CASE 
      WHEN p_iban IS NULL OR TRIM(p_iban) = '' THEN NULL
      ELSE UPPER(REGEXP_REPLACE(p_iban, '[^A-Z0-9]', '', 'g'))
    END,
    updated_at = NOW()
  WHERE id = auth.uid();
  
  -- Vérifier que la mise à jour a fonctionné
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil non trouvé pour cet utilisateur';
  END IF;
  
  RAISE NOTICE 'Profil mis à jour avec succès pour user %', auth.uid();
END;
$$;

COMMENT ON FUNCTION public.update_user_profile IS 
  'Permet à un utilisateur de modifier son prénom, nom et IBAN';

-- ═══════════════════════════════════════════════════════════════
-- 4️⃣ VUE : user_profile (pour affichage profil)
-- ═══════════════════════════════════════════════════════════════

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
  
  -- Label status
  CASE u.status
    WHEN 'BN' THEN 'Bureau National'
    WHEN 'MEMBER' THEN 'Membre'
    ELSE u.status
  END as status_label,
  
  -- Code status (pour affichage)
  u.status as status_code,
  
  -- Coefficient selon status
  CASE u.status
    WHEN 'BN' THEN 1.0
    WHEN 'MEMBER' THEN 0.8
    ELSE 1.0
  END as coefficient,
  
  -- Statistiques des demandes
  (SELECT COUNT(*) FROM public.expense_claims WHERE user_id = u.id AND status = 'DRAFT') as draft_claims,
  (SELECT COUNT(*) FROM public.expense_claims WHERE user_id = u.id AND status = 'PENDING') as pending_claims,
  (SELECT COUNT(*) FROM public.expense_claims WHERE user_id = u.id AND status = 'VALIDATED') as validated_claims,
  (SELECT COUNT(*) FROM public.expense_claims WHERE user_id = u.id AND status = 'PAID') as paid_claims,
  
  -- Total remboursé
  COALESCE(
    (SELECT SUM(reimbursable_amount) 
     FROM public.expense_claims 
     WHERE user_id = u.id AND status = 'PAID'),
    0
  ) as total_reimbursed

FROM public.users u;

-- RLS sur la vue user_profile
ALTER VIEW public.user_profile SET (security_invoker = true);

COMMENT ON VIEW public.user_profile IS 
  'Vue complète du profil utilisateur avec statistiques';

-- ═══════════════════════════════════════════════════════════════
-- 5️⃣ PERMISSIONS
-- ═══════════════════════════════════════════════════════════════

-- Permettre à tous les utilisateurs authentifiés d'utiliser la fonction
GRANT EXECUTE ON FUNCTION public.update_user_profile TO authenticated;

-- Permettre SELECT sur la vue user_profile
GRANT SELECT ON public.user_profile TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6️⃣ VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════

-- Lister les policies RLS actives
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Vérifier que la fonction existe
SELECT 
  proname,
  prosrc
FROM pg_proc
WHERE proname = 'update_user_profile';

-- Tester la vue user_profile (doit retourner les users)
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN role = 'ADMIN' THEN 1 END) as admins,
  COUNT(CASE WHEN role = 'MEMBER' THEN 1 END) as members
FROM public.user_profile;

-- ═══════════════════════════════════════════════════════════════
-- ✅ TERMINÉ !
-- ═══════════════════════════════════════════════════════════════
-- 
-- Corrections appliquées :
-- ✅ RLS policies permettent UPDATE de son propre profil
-- ✅ Fonction update_user_profile créée (SECURITY DEFINER)
-- ✅ Validation IBAN, prénom, nom
-- ✅ Vue user_profile avec statistiques
-- ✅ Permissions correctes
--
-- PROCHAINE ÉTAPE :
-- Tester dans l'application : /profile → Modifier informations
--
-- ═══════════════════════════════════════════════════════════════
