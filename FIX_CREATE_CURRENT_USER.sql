-- 🔧 FIX: Créer l'utilisateur actuel dans public.users
-- Si vous êtes déjà connecté avec Google OAuth mais n'avez pas accès à l'app

-- 1️⃣ D'ABORD: Vérifier quel utilisateur existe dans auth.users
SELECT id, email, created_at, raw_user_meta_data 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 2️⃣ ENSUITE: Vérifier si l'utilisateur existe déjà dans public.users
SELECT id, email, first_name, last_name, status, role, created_at 
FROM public.users 
ORDER BY created_at DESC;

-- 3️⃣ SI L'UTILISATEUR N'EXISTE PAS DANS public.users:
-- Créer l'utilisateur manuellement (remplacez l'email par le vôtre)
INSERT INTO public.users (id, email, first_name, last_name, status, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'given_name', split_part(email, '@', 1)) as first_name,
  COALESCE(raw_user_meta_data->>'family_name', '') as last_name,
  CASE 
    WHEN email LIKE '%@afneus.org' THEN 'BN'
    ELSE 'MEMBER'
  END as status,
  CASE email
    WHEN 'mohameddhia.ounally@afneus.org' THEN 'ADMIN'
    WHEN 'yannis.loumouamou@afneus.org' THEN 'TREASURER'
    ELSE 'MEMBER'
  END as role
FROM auth.users
WHERE email = 'mohameddhia.ounally@afneus.org'  -- 👈 REMPLACEZ PAR VOTRE EMAIL
AND NOT EXISTS (
  SELECT 1 FROM public.users WHERE public.users.id = auth.users.id
);

-- 4️⃣ VÉRIFIER que l'utilisateur a bien été créé
SELECT id, email, first_name, last_name, status, role, created_at 
FROM public.users 
WHERE email = 'mohameddhia.ounally@afneus.org';  -- 👈 REMPLACEZ PAR VOTRE EMAIL

-- 5️⃣ BONUS: Réactiver le trigger pour les futurs utilisateurs
-- (au cas où il aurait été désactivé)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6️⃣ VÉRIFIER que le trigger existe
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth' 
  AND event_object_table = 'users';
