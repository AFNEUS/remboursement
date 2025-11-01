-- ================================================================
-- CONFIGURATION UTILISATEURS AFNEUS
-- ================================================================
-- À exécuter après 01_INIT_COMPLETE.sql
-- ================================================================

-- 1. MOHAMED = SUPER ADMIN (tous les droits)
UPDATE public.users
SET 
  role = 'ADMIN',
  status = 'ADMIN',
  first_name = 'Mohamed',
  last_name = 'Dhia Ounally'
WHERE email ILIKE '%mohamed%' AND email ILIKE '%afneus.org';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT 
  id, email, 'Mohamed', 'Dhia Ounally', 'ADMIN', 'ADMIN'
FROM auth.users
WHERE email ILIKE '%mohamed%' AND email ILIKE '%afneus.org'
ON CONFLICT (id) DO UPDATE SET
  role = 'ADMIN',
  status = 'ADMIN',
  first_name = 'Mohamed',
  last_name = 'Dhia Ounally';

-- 2. YANNIS = VALIDATOR + BN
UPDATE public.users
SET 
  role = 'VALIDATOR',
  status = 'BN',
  first_name = 'Yannis',
  last_name = 'Ferchichi'
WHERE email ILIKE '%yannis%' AND email ILIKE '%afneus.org';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT 
  id, email, 'Yannis', 'Ferchichi', 'VALIDATOR', 'BN'
FROM auth.users
WHERE email ILIKE '%yannis%' AND email ILIKE '%afneus.org'
ON CONFLICT (id) DO UPDATE SET
  role = 'VALIDATOR',
  status = 'BN',
  first_name = 'Yannis',
  last_name = 'Ferchichi';

-- 3. AUTRES MEMBRES BN (exemples - à personnaliser)
-- Président
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, email, 'Lucas', 'Martin', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'president@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Lucas', last_name = 'Martin';

-- Vice-Président
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, email, 'Emma', 'Bernard', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'vp@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Emma', last_name = 'Bernard';

-- Secrétaire Général
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, email, 'Thomas', 'Dubois', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'sg@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Thomas', last_name = 'Dubois';

-- Trésorier
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, email, 'Léa', 'Moreau', 'TREASURER', 'BN'
FROM auth.users WHERE email = 'tresorier@afneus.org'
ON CONFLICT (id) DO UPDATE SET role = 'TREASURER', status = 'BN', first_name = 'Léa', last_name = 'Moreau';

-- Responsable Com
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, email, 'Antoine', 'Laurent', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'com@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Antoine', last_name = 'Laurent';

-- Responsable Événements
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, email, 'Chloé', 'Simon', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'events@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Chloé', last_name = 'Simon';

-- ================================================================
-- VÉRIFICATION
-- ================================================================
SELECT 
  email,
  first_name || ' ' || last_name as nom_complet,
  CASE 
    WHEN role = 'ADMIN' THEN '👑 Administrateur'
    WHEN role = 'TREASURER' THEN '💰 Trésorier'
    WHEN role = 'VALIDATOR' THEN '✅ Validateur'
    ELSE '👤 Membre'
  END as role_label,
  CASE
    WHEN status = 'ADMIN' THEN '⚡ Super Admin'
    WHEN status = 'BN' THEN '🏛️ Bureau National'
    ELSE '📝 Membre'
  END as status_label,
  created_at
FROM public.users
ORDER BY 
  CASE role
    WHEN 'ADMIN' THEN 1
    WHEN 'TREASURER' THEN 2
    WHEN 'VALIDATOR' THEN 3
    ELSE 4
  END,
  email;
