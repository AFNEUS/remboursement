-- ================================================================
-- 🔴 FAIRE DE MOHAMED UN SUPER ADMIN (IMMÉDIAT)
-- ================================================================
-- Exécute ce fichier dans Supabase SQL Editor MAINTENANT
-- ================================================================

-- 1. Vérifier ton user actuel
SELECT id, email, first_name, last_name, role, status, created_at
FROM public.users 
WHERE email = 'mohameddhia.ounally@afneus.org';

-- 2. Te mettre ADMIN immédiatement
UPDATE public.users 
SET 
  role = 'ADMIN',
  status = 'ADMIN',
  first_name = 'Mohamed Dhia',
  last_name = 'Ounally',
  updated_at = NOW()
WHERE email = 'mohameddhia.ounally@afneus.org';

-- 3. Vérifier que ça a marché
SELECT 
  email,
  first_name,
  last_name,
  role,
  status,
  updated_at
FROM public.users 
WHERE email = 'mohameddhia.ounally@afneus.org';

-- ✅ Tu devrais voir:
-- role = 'ADMIN'
-- status = 'ADMIN'
-- first_name = 'Mohamed Dhia'
-- last_name = 'Ounally'

-- ================================================================
-- 🔥 APRÈS AVOIR EXÉCUTÉ:
-- 1. Déconnecte-toi du site
-- 2. Reconnecte-toi avec Google OAuth
-- 3. Tu verras le bouton 👑 Admin
-- ================================================================
