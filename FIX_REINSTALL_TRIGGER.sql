-- 🔧 RÉINSTALLER LE TRIGGER handle_new_user
-- Ce trigger crée automatiquement un utilisateur dans public.users 
-- quand un nouvel utilisateur se connecte via OAuth

-- 1️⃣ Supprimer l'ancien trigger (si existe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2️⃣ Recréer la fonction handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
  v_role TEXT;
BEGIN
  -- Déterminer status (BN si @afneus.org)
  v_status := CASE 
    WHEN NEW.email LIKE '%@afneus.org' THEN 'BN'
    ELSE 'MEMBER'
  END;
  
  -- Déterminer rôle selon email
  v_role := CASE NEW.email
    -- ADMIN (Mohamed uniquement - accès full)
    WHEN 'mohameddhia.ounally@afneus.org' THEN 'ADMIN'
    
    -- TREASURER (Yannis uniquement - peut valider + trésorerie + barèmes)
    WHEN 'yannis.loumouamou@afneus.org' THEN 'TREASURER'
    
    -- MEMBER par défaut (tous les autres)
    ELSE 'MEMBER'
  END;
  
  -- Insérer dans public.users
  INSERT INTO public.users (id, email, first_name, last_name, status, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'given_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'family_name', ''),
    v_status,
    v_role
  )
  ON CONFLICT (id) DO NOTHING;  -- Éviter les doublons
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3️⃣ Créer le trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4️⃣ VÉRIFICATION: Afficher les triggers existants
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth' 
  AND event_object_table = 'users';

-- ✅ Si vous voyez "on_auth_user_created" dans les résultats, le trigger est actif !
