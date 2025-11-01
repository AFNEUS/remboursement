-- ================================================================
-- CONFIGURATION UTILISATEURS AFNEUS
-- ================================================================
-- Création des comptes des membres du Bureau National
-- ================================================================

-- 1. MOHAMED DHIA OUNALLY = SUPER ADMIN
UPDATE public.users
SET role = 'ADMIN', status = 'ADMIN', first_name = 'Mohamed', last_name = 'Dhia Ounally'
WHERE email = 'mohameddhia.ounally@afneus.org';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'mohameddhia.ounally@afneus.org', 'Mohamed', 'Dhia Ounally', 'ADMIN', 'ADMIN'
FROM auth.users WHERE email = 'mohameddhia.ounally@afneus.org'
ON CONFLICT (id) DO UPDATE SET role = 'ADMIN', status = 'ADMIN', first_name = 'Mohamed', last_name = 'Dhia Ounally';

-- 2. YANNIS LOUMOUAMOU = VALIDATOR (Validateur)
UPDATE public.users
SET role = 'VALIDATOR', status = 'BN', first_name = 'Yannis', last_name = 'Loumouamou'
WHERE email = 'yannis.loumouamou@afneus.org';

INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'yannis.loumouamou@afneus.org', 'Yannis', 'Loumouamou', 'VALIDATOR', 'BN'
FROM auth.users WHERE email = 'yannis.loumouamou@afneus.org'
ON CONFLICT (id) DO UPDATE SET role = 'VALIDATOR', status = 'BN', first_name = 'Yannis', last_name = 'Loumouamou';

-- 3. MEMBRES DU BUREAU NATIONAL

-- Agathe Bares
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'agathe.bares@afneus.org', 'Agathe', 'Bares', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'agathe.bares@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Agathe', last_name = 'Bares';

-- Anne-Claire Beauvais
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'anneclaire.beauvais@afneus.org', 'Anne-Claire', 'Beauvais', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'anneclaire.beauvais@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Anne-Claire', last_name = 'Beauvais';

-- Corentin Chadirac
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'corentin.chadirac@afneus.org', 'Corentin', 'Chadirac', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'corentin.chadirac@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Corentin', last_name = 'Chadirac';

-- Emie Sanchez
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'emie.sanchez@afneus.org', 'Emie', 'Sanchez', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'emie.sanchez@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Emie', last_name = 'Sanchez';

-- Eva Schindler
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'eva.schindler@afneus.org', 'Eva', 'Schindler', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'eva.schindler@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Eva', last_name = 'Schindler';

-- Lucas De Perthuis
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'lucas.deperthuis@afneus.org', 'Lucas', 'De Perthuis', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'lucas.deperthuis@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Lucas', last_name = 'De Perthuis';

-- Manon Soubeyrand
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'manon.soubeyrand@afneus.org', 'Manon', 'Soubeyrand', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'manon.soubeyrand@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Manon', last_name = 'Soubeyrand';

-- Rebecca Roux
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'rebecca.roux@afneus.org', 'Rebecca', 'Roux', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'rebecca.roux@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Rebecca', last_name = 'Roux';

-- Salomé Lance-Richardot
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'salome.lance-richardot@afneus.org', 'Salomé', 'Lance-Richardot', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'salome.lance-richardot@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Salomé', last_name = 'Lance-Richardot';

-- Thomas Dujak
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'thomas.dujak@afneus.org', 'Thomas', 'Dujak', 'MEMBER', 'BN'
FROM auth.users WHERE email = 'thomas.dujak@afneus.org'
ON CONFLICT (id) DO UPDATE SET status = 'BN', first_name = 'Thomas', last_name = 'Dujak';

-- ================================================================
-- VÉRIFICATION
-- ================================================================
SELECT 
  first_name || ' ' || last_name as "Nom Complet",
  email as "Email",
  CASE 
    WHEN role = 'ADMIN' THEN '👑 Administrateur'
    WHEN role = 'TREASURER' THEN '💰 Trésorier'
    WHEN role = 'VALIDATOR' THEN '✅ Validateur'
    ELSE '👤 Membre'
  END as "Rôle",
  CASE
    WHEN status = 'ADMIN' THEN '⚡ Super Admin'
    WHEN status = 'BN' THEN '🏛️ Bureau National'
    ELSE '📝 Membre Simple'
  END as "Statut",
  created_at as "Créé le"
FROM public.users
WHERE email LIKE '%@afneus.org'
ORDER BY 
  CASE role
    WHEN 'ADMIN' THEN 1
    WHEN 'TREASURER' THEN 2
    WHEN 'VALIDATOR' THEN 3
    ELSE 4
  END,
  last_name;
