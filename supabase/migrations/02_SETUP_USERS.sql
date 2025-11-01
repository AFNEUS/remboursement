-- ================================================================
-- CONFIGURATION UTILISATEURS AFNEUS
-- ================================================================
-- À exécuter après 01_INIT_COMPLETE.sql
-- Créé les comptes pour Mohamed (ADMIN) et membres BN
-- ================================================================

-- 1. MOHAMED = ADMIN (toi)
UPDATE public.users
SET 
  role = 'ADMIN',
  status = 'ADMIN',
  first_name = 'Mohamed',
  last_name = 'Dhia Ounally'
WHERE email ILIKE '%mohamed%ounally%' OR email ILIKE '%mohameddhia%';

-- Si pas encore créé, l'insérer
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT 
  id,
  email,
  'Mohamed' as first_name,
  'Dhia Ounally' as last_name,
  'ADMIN' as role,
  'ADMIN' as status
FROM auth.users
WHERE email ILIKE '%mohamed%ounally%'
ON CONFLICT (id) DO UPDATE SET
  role = 'ADMIN',
  status = 'ADMIN',
  first_name = 'Mohamed',
  last_name = 'Dhia Ounally';

-- 2. YANNIS = VALIDATOR
UPDATE public.users
SET 
  role = 'VALIDATOR',
  status = 'BN',
  first_name = 'Yannis',
  last_name = 'Nom' -- À remplacer par son vrai nom
WHERE email ILIKE '%yannis%@afneus.org';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT 
  id,
  email,
  'Yannis' as first_name,
  'Nom' as last_name, -- À remplacer
  'VALIDATOR' as role,
  'BN' as status
FROM auth.users
WHERE email ILIKE '%yannis%@afneus.org'
ON CONFLICT (id) DO UPDATE SET
  role = 'VALIDATOR',
  status = 'BN',
  first_name = 'Yannis';

-- ================================================================
-- MEMBRES DU BUREAU NATIONAL (à personnaliser)
-- ================================================================
-- Décommente et modifie selon les vrais noms/emails

-- Président·e
-- INSERT INTO public.users (id, email, first_name, last_name, role, status)
-- SELECT id, email, 'Prénom', 'Nom', 'MEMBER', 'BN'
-- FROM auth.users WHERE email = 'president@afneus.org'
-- ON CONFLICT (id) DO UPDATE SET status = 'BN';

-- Vice-Président·e
-- INSERT INTO public.users (id, email, first_name, last_name, role, status)
-- SELECT id, email, 'Prénom', 'Nom', 'MEMBER', 'BN'
-- FROM auth.users WHERE email = 'vp@afneus.org'
-- ON CONFLICT (id) DO UPDATE SET status = 'BN';

-- Secrétaire Général·e
-- INSERT INTO public.users (id, email, first_name, last_name, role, status)
-- SELECT id, email, 'Prénom', 'Nom', 'VALIDATOR', 'BN'
-- FROM auth.users WHERE email = 'sg@afneus.org'
-- ON CONFLICT (id) DO UPDATE SET role = 'VALIDATOR', status = 'BN';

-- Trésorier·e
-- INSERT INTO public.users (id, email, first_name, last_name, role, status)
-- SELECT id, email, 'Prénom', 'Nom', 'TREASURER', 'BN'
-- FROM auth.users WHERE email = 'tresorier@afneus.org'
-- ON CONFLICT (id) DO UPDATE SET role = 'TREASURER', status = 'BN';

-- ================================================================
-- VÉRIFICATION
-- ================================================================
SELECT 
  email,
  first_name,
  last_name,
  role,
  status,
  CASE 
    WHEN role = 'ADMIN' THEN '👑 Administrateur'
    WHEN role = 'TREASURER' THEN '💰 Trésorier'
    WHEN role = 'VALIDATOR' THEN '✅ Validateur'
    ELSE '👤 Membre'
  END as role_label,
  CASE
    WHEN status = 'ADMIN' THEN '⚡ Admin'
    WHEN status = 'BN' THEN '🏛️ Bureau National'
    ELSE '📝 Membre'
  END as status_label
FROM public.users
ORDER BY 
  CASE role
    WHEN 'ADMIN' THEN 1
    WHEN 'TREASURER' THEN 2
    WHEN 'VALIDATOR' THEN 3
    ELSE 4
  END,
  email;
