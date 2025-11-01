-- ================================================================
-- 🔴 FAIRE DE MOHAMED UN SUPER ADMIN
-- ================================================================
-- Exécute ce fichier dans Supabase SQL Editor pour devenir admin
-- Puis déconnecte-toi et reconnecte-toi pour recharger la session

UPDATE public.users 
SET 
  role = 'ADMIN',
  status = 'ADMIN',
  first_name = 'Mohamed Dhia',
  last_name = 'Ounally',
  updated_at = NOW()
WHERE email = 'mohameddhia.ounally@afneus.org';

-- Vérification
SELECT 
  email,
  first_name,
  last_name,
  role,
  status,
  created_at,
  updated_at
FROM public.users 
WHERE email = 'mohameddhia.ounally@afneus.org';
