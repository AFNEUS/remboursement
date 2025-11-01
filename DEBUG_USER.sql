-- ================================================================
-- VÉRIFICATION RAPIDE - Exécute ces requêtes dans Supabase
-- ================================================================

-- 1. Vérifier que tu existes dans auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'mohameddhia.ounally@afneus.org';
-- Doit retourner 1 ligne avec ton ID

-- 2. Vérifier que tu existes dans public.users
SELECT id, email, role, status, created_at 
FROM public.users 
WHERE email = 'mohameddhia.ounally@afneus.org';
-- Doit retourner 1 ligne avec role='ADMIN'

-- 3. Vérifier que le trigger existe
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
-- Doit retourner 1 ligne

-- 4. Si public.users est vide, CRÉER MANUELLEMENT ton user
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
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'first_name', 'Mohamed'),
  COALESCE(raw_user_meta_data->>'last_name', 'Ounally'),
  'ADMIN',
  'ACTIVE',
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'mohameddhia.ounally@afneus.org'
ON CONFLICT (id) DO UPDATE SET
  role = 'ADMIN',
  status = 'ACTIVE',
  updated_at = NOW();

-- 5. Vérifier que ça a marché
SELECT id, email, role, status 
FROM public.users 
WHERE email = 'mohameddhia.ounally@afneus.org';
-- Doit maintenant retourner 1 ligne avec role='ADMIN' status='ACTIVE'
