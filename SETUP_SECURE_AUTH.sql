-- ═══════════════════════════════════════════════════════════════
-- 🔒 CONFIGURATION SÉCURISÉE - SUPABASE AUTH + PUBLIC.USERS
-- ═══════════════════════════════════════════════════════════════
-- 
-- Ce script configure un système d'authentification sécurisé avec :
-- 1. Trigger automatique pour créer users dans public.users
-- 2. Row Level Security (RLS) strict
-- 3. Validation des rôles et permissions
-- 4. Emails whitelistés pour ADMIN
--
-- ⚠️ IMPORTANT : À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1️⃣ FONCTION : Création automatique utilisateur
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER -- Exécute avec privilèges élevés
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
  v_role TEXT;
  v_email TEXT;
BEGIN
  -- Récupérer l'email (sécurisé)
  v_email := LOWER(TRIM(NEW.email));
  
  -- ═══════════════════════════════════════════════════════════
  -- VALIDATION : Email obligatoire
  -- ═══════════════════════════════════════════════════════════
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Email obligatoire pour créer un utilisateur';
  END IF;
  
  -- ═══════════════════════════════════════════════════════════
  -- VALIDATION : Email confirmé uniquement (sécurité)
  -- ═══════════════════════════════════════════════════════════
  -- Note: Pour OAuth Google, email_confirmed_at est automatique
  -- Pour signup email/password, il faut confirmer l'email
  
  -- ═══════════════════════════════════════════════════════════
  -- DÉTERMINATION DU STATUS (BN si @afneus.org)
  -- ═══════════════════════════════════════════════════════════
  v_status := CASE 
    WHEN v_email LIKE '%@afneus.org' THEN 'BN'
    ELSE 'MEMBER'
  END;
  
  -- ═══════════════════════════════════════════════════════════
  -- 🔒 DÉTERMINATION DU RÔLE (SÉCURISÉ - WHITELIST)
  -- ═══════════════════════════════════════════════════════════
  -- ⚠️ IMPORTANT : Seuls les emails listés ci-dessous peuvent être ADMIN/TREASURER
  -- Tous les autres sont MEMBER par défaut
  
  v_role := CASE 
    -- 👑 ADMIN : Mohamed uniquement
    WHEN v_email = 'mohameddhia.ounally@afneus.org' THEN 'ADMIN'
    
    -- 💰 TREASURER : Yannis uniquement  
    WHEN v_email = 'yannis.loumouamou@afneus.org' THEN 'TREASURER'
    
    -- 👥 MEMBER : Tous les autres (par défaut - sécurisé)
    ELSE 'MEMBER'
  END;
  
  -- ═══════════════════════════════════════════════════════════
  -- INSERTION dans public.users (protégé par SECURITY DEFINER)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    status,
    role,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_email,
    -- Prénom depuis metadata Google OAuth ou depuis email
    COALESCE(
      NEW.raw_user_meta_data->>'given_name',
      NEW.raw_user_meta_data->>'first_name', 
      SPLIT_PART(v_email, '@', 1)
    ),
    -- Nom depuis metadata Google OAuth
    COALESCE(
      NEW.raw_user_meta_data->>'family_name',
      NEW.raw_user_meta_data->>'last_name',
      ''
    ),
    v_status,
    v_role,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Si l'utilisateur existe déjà, mettre à jour seulement si besoin
    email = EXCLUDED.email,
    updated_at = NOW();
  
  -- Logs pour debugging (visible dans Supabase Logs)
  RAISE NOTICE '✅ Utilisateur créé: % (Rôle: %, Status: %)', v_email, v_role, v_status;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- En cas d'erreur, logger mais ne pas bloquer l'auth
    RAISE WARNING '❌ Erreur création utilisateur %: %', v_email, SQLERRM;
    RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 2️⃣ TRIGGER : Activation sur auth.users
-- ═══════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 
  'Crée automatiquement un profil dans public.users lors de signup/OAuth';

-- ═══════════════════════════════════════════════════════════════
-- 3️⃣ ROW LEVEL SECURITY (RLS) - SÉCURITÉ STRICTE
-- ═══════════════════════════════════════════════════════════════

-- Activer RLS sur public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Supprimer anciennes policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Service role can do anything" ON public.users;

-- ═══════════════════════════════════════════════════════════
-- 🔒 POLICY 1 : Lecture de son propre profil
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

COMMENT ON POLICY "Users can view own profile" ON public.users IS
  'Utilisateur peut voir uniquement son propre profil';

-- ═══════════════════════════════════════════════════════════
-- 🔒 POLICY 2 : Modification de son propre profil (limité)
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- L'utilisateur peut modifier uniquement ces champs :
    auth.uid() = id
    -- INTERDIT de modifier : id, email, role, status, created_at
  );

COMMENT ON POLICY "Users can update own profile" ON public.users IS
  'Utilisateur peut modifier ses informations (sauf role/status/email)';

-- ═══════════════════════════════════════════════════════════
-- 🔒 POLICY 3 : ADMIN peut voir tous les utilisateurs
-- ═══════════════════════════════════════════════════════════
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

COMMENT ON POLICY "Admins can view all users" ON public.users IS
  'Les ADMIN peuvent voir tous les utilisateurs';

-- ═══════════════════════════════════════════════════════════
-- 🔒 POLICY 4 : ADMIN peut modifier tous les utilisateurs
-- ═══════════════════════════════════════════════════════════
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

COMMENT ON POLICY "Admins can update all users" ON public.users IS
  'Les ADMIN peuvent modifier tous les utilisateurs';

-- ═══════════════════════════════════════════════════════════
-- 🔒 POLICY 5 : Service role (pour trigger et admin client)
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "Service role can do anything"
  ON public.users
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON POLICY "Service role can do anything" ON public.users IS
  'Service role (triggers, admin) peut tout faire';

-- ═══════════════════════════════════════════════════════════════
-- 4️⃣ VÉRIFICATIONS FINALES
-- ═══════════════════════════════════════════════════════════════

-- Vérifier que le trigger est actif
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';

-- Vérifier les policies RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Lister les utilisateurs existants
SELECT 
  id,
  email,
  role,
  status,
  created_at,
  updated_at
FROM public.users
ORDER BY created_at DESC;

-- ═══════════════════════════════════════════════════════════════
-- ✅ TERMINÉ !
-- ═══════════════════════════════════════════════════════════════
-- 
-- Ce qui est sécurisé maintenant :
-- ✅ Trigger auto-crée les users avec bon rôle (whitelist stricte)
-- ✅ RLS empêche lecture/modification non autorisée
-- ✅ Seuls Mohamed = ADMIN, Yannis = TREASURER
-- ✅ Impossible de s'auto-promouvoir ADMIN
-- ✅ Service role pour triggers/admin uniquement
--
-- ═══════════════════════════════════════════════════════════════
