-- =====================================================================
-- AJOUTER UN ADMINISTRATEUR
-- =====================================================================
-- ⚠️  Remplace 'TON@EMAIL.FR', 'PRENOM', 'NOM' avant d'exécuter
-- =====================================================================

-- Étape 1 : ajouter à la liste blanche
INSERT INTO public.authorized_users (email, first_name, last_name, role, notes)
VALUES (
  'thomas.dujak@afneus.org',   -- ← ton email (le même que dans Supabase Auth → Users)
  'Thomas',         -- ← ton prénom
  'Dujak',            -- ← ton nom
  'admin_asso',
  'Administrateur principal'
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin_asso',
  notes = 'Administrateur principal';

-- Étape 2 : mettre à jour le profil si déjà connecté une fois
UPDATE public.users
SET role = 'admin_asso', is_active = true
WHERE LOWER(email) = LOWER('thomas.dujak@afneus.org');

-- Vérification
SELECT email, first_name, last_name, role
FROM public.authorized_users
WHERE LOWER(email) = LOWER('thomas.dujak@afneus.org');
