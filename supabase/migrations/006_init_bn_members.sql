-- ============================================
-- Migration 006: Initialisation des membres BN
-- ============================================

-- ============================================
-- 1. Insertion des membres du Bureau National
-- ============================================

-- Note: Ces utilisateurs seront créés dans la table 'users' après leur première connexion Google OAuth
-- En attendant, on peut créer une table temporaire pour référence

CREATE TABLE IF NOT EXISTS public.bn_members_reference (
  email TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  status_code TEXT DEFAULT 'BN' CHECK (status_code IN ('BN', 'ADMIN', 'ELU', 'OBSERVATEUR', 'FORMATEUR', 'CDV', 'APPRENANT', 'AUTRE')),
  role TEXT DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'TREASURER', 'VALIDATOR', 'MEMBER')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertion des membres BN avec leurs emails
INSERT INTO public.bn_members_reference (email, first_name, last_name, status_code, role, notes) VALUES
  ('agathe.bares@afneus.org', 'Agathe', 'Bares', 'BN', 'MEMBER', 'Membre Bureau National'),
  ('anneclaire.beauvais@afneus.org', 'Anne-Claire', 'Beauvais', 'BN', 'MEMBER', 'Membre Bureau National'),
  ('corentin.chadirac@afneus.org', 'Corentin', 'Chadirac', 'BN', 'MEMBER', 'Membre Bureau National'),
  ('emie.sanchez@afneus.org', 'Emie', 'Sanchez', 'BN', 'MEMBER', 'Membre Bureau National'),
  ('eva.schindler@afneus.org', 'Eva', 'Schindler', 'BN', 'MEMBER', 'Membre Bureau National'),
  ('lucas.deperthuis@afneus.org', 'Lucas', 'De Perthuis', 'BN', 'MEMBER', 'Membre Bureau National'),
  ('manon.soubeyrand@afneus.org', 'Manon', 'Soubeyrand', 'BN', 'MEMBER', 'Membre Bureau National'),
  ('mohameddhia.ounally@afneus.org', 'Mohamed Dhia', 'Ounally', 'BN', 'ADMIN', 'Membre Bureau National - Administrateur système'),
  ('rebecca.roux@afneus.org', 'Rebecca', 'Roux', 'BN', 'MEMBER', 'Membre Bureau National'),
  ('salome.lance-richardot@afneus.org', 'Salomé', 'Lance-Richardot', 'BN', 'MEMBER', 'Membre Bureau National'),
  ('thomas.dujak@afneus.org', 'Thomas', 'Dujak', 'BN', 'MEMBER', 'Membre Bureau National'),
  ('yannis.loumouamou@afneus.org', 'Yannis', 'Loumouamou', 'BN', 'MEMBER', 'Membre Bureau National')
ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  status_code = EXCLUDED.status_code,
  role = EXCLUDED.role,
  notes = EXCLUDED.notes;

-- ============================================
-- 2. Fonction pour synchroniser automatiquement les nouveaux utilisateurs
-- ============================================

-- Cette fonction sera appelée automatiquement quand un nouvel utilisateur se connecte
-- Elle copie les infos de bn_members_reference vers users si l'email correspond

CREATE OR REPLACE FUNCTION public.auto_assign_bn_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bn_ref RECORD;
BEGIN
  -- Vérifier si l'email existe dans la référence BN
  SELECT * INTO bn_ref 
  FROM public.bn_members_reference 
  WHERE email = NEW.email;
  
  IF FOUND THEN
    -- Mettre à jour le nouveau user avec les infos BN
    NEW.first_name := bn_ref.first_name;
    NEW.last_name := bn_ref.last_name;
    NEW.status_code := bn_ref.status_code;
    NEW.role := bn_ref.role;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger sur la table users
DROP TRIGGER IF EXISTS trigger_auto_assign_bn_status ON public.users;
CREATE TRIGGER trigger_auto_assign_bn_status
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_bn_status();

-- ============================================
-- 3. Permissions RLS pour bn_members_reference
-- ============================================

ALTER TABLE public.bn_members_reference ENABLE ROW LEVEL SECURITY;

-- Les admins peuvent voir tous les membres BN
CREATE POLICY "Admins can view all BN members"
  ON public.bn_members_reference
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('ADMIN', 'TREASURER', 'VALIDATOR')
    )
  );

-- Seuls les admins peuvent modifier
CREATE POLICY "Only admins can modify BN members"
  ON public.bn_members_reference
  FOR ALL
  TO authenticated
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

-- ============================================
-- 4. Vue pour afficher les membres BN avec leur statut de connexion
-- ============================================

CREATE OR REPLACE VIEW public.bn_members_status AS
SELECT 
  ref.email,
  ref.first_name,
  ref.last_name,
  ref.status_code,
  ref.role,
  ref.notes,
  u.id as user_id,
  u.is_active,
  u.created_at as first_login,
  CASE 
    WHEN u.id IS NOT NULL THEN 'Connecté'
    ELSE 'Pas encore connecté'
  END as connection_status
FROM public.bn_members_reference ref
LEFT JOIN public.users u ON ref.email = u.email
ORDER BY ref.last_name, ref.first_name;

-- ============================================
-- 5. Commentaires pour documentation
-- ============================================

COMMENT ON TABLE public.bn_members_reference IS 'Table de référence des membres du Bureau National AFNEUS';
COMMENT ON FUNCTION public.auto_assign_bn_status IS 'Assigne automatiquement le statut BN lors de la première connexion';
COMMENT ON VIEW public.bn_members_status IS 'Vue consolidée des membres BN avec leur statut de connexion';

-- ============================================
-- 6. Statistiques initiales
-- ============================================

SELECT 
  COUNT(*) as total_membres_bn,
  COUNT(CASE WHEN role = 'ADMIN' THEN 1 END) as admins,
  COUNT(CASE WHEN role = 'TREASURER' THEN 1 END) as treasurers,
  COUNT(CASE WHEN role = 'VALIDATOR' THEN 1 END) as validators,
  COUNT(CASE WHEN role = 'MEMBER' THEN 1 END) as members
FROM public.bn_members_reference;

-- Afficher la liste
SELECT * FROM public.bn_members_reference ORDER BY last_name, first_name;
