-- ============================================
-- Migration 007: Système d'authentification complet
-- ============================================

-- ============================================
-- 1. Fonction de synchronisation automatique des nouveaux users
-- ============================================

-- Cette fonction est appelée automatiquement quand un user se connecte
-- Elle crée l'entrée dans public.users si elle n'existe pas

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bn_member RECORD;
BEGIN
  -- Insérer dans public.users si pas déjà présent
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    status_code,
    role,
    is_active
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'AUTRE', -- Par défaut
    'MEMBER', -- Par défaut
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- Vérifier si c'est un membre BN
  SELECT * INTO bn_member 
  FROM public.bn_members_reference 
  WHERE email = NEW.email;
  
  IF FOUND THEN
    -- Mettre à jour avec les infos BN
    UPDATE public.users
    SET 
      first_name = bn_member.first_name,
      last_name = bn_member.last_name,
      status_code = bn_member.status_code,
      role = bn_member.role,
      updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. Fonction pour mettre à jour le profil utilisateur
-- ============================================

CREATE OR REPLACE FUNCTION public.update_user_profile(
  user_id UUID,
  new_first_name TEXT DEFAULT NULL,
  new_last_name TEXT DEFAULT NULL,
  new_iban TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Vérifier que l'utilisateur modifie bien son propre profil
  IF user_id != auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez modifier que votre propre profil';
  END IF;

  -- Mise à jour
  UPDATE public.users
  SET
    first_name = COALESCE(new_first_name, first_name),
    last_name = COALESCE(new_last_name, last_name),
    iban = COALESCE(new_iban, iban),
    updated_at = NOW()
  WHERE id = user_id;

  -- Retourner le profil mis à jour
  SELECT json_build_object(
    'success', true,
    'message', 'Profil mis à jour avec succès'
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 3. Vue pour le profil utilisateur complet
-- ============================================

CREATE OR REPLACE VIEW public.user_profile AS
SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.status_code,
  u.role,
  u.iban,
  u.iban_verified,
  u.is_active,
  ms.label as status_label,
  ms.coefficient,
  u.created_at,
  u.updated_at,
  
  -- Statistiques personnelles
  COUNT(DISTINCT ec.id) FILTER (WHERE ec.status = 'draft') as draft_claims,
  COUNT(DISTINCT ec.id) FILTER (WHERE ec.status = 'submitted') as pending_claims,
  COUNT(DISTINCT ec.id) FILTER (WHERE ec.status = 'validated') as validated_claims,
  COUNT(DISTINCT ec.id) FILTER (WHERE ec.status = 'paid') as paid_claims,
  COALESCE(SUM(ec.total_amount) FILTER (WHERE ec.status IN ('validated', 'paid')), 0) as total_reimbursed

FROM public.users u
LEFT JOIN public.member_statuses ms ON u.status_code = ms.code
LEFT JOIN public.expense_claims ec ON u.id = ec.user_id
GROUP BY u.id, u.email, u.first_name, u.last_name, u.status_code, u.role, 
         u.iban, u.iban_verified, u.is_active, ms.label, ms.coefficient, 
         u.created_at, u.updated_at;

-- RLS pour user_profile
ALTER VIEW public.user_profile SET (security_invoker = true);

-- ============================================
-- 4. Politique RLS pour permettre aux users de voir leur profil
-- ============================================

-- Les users peuvent voir leur propre profil
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Les users peuvent mettre à jour leur propre profil
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Les admins peuvent voir tous les profils
CREATE POLICY "Admins can view all profiles"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- ============================================
-- 5. Fonction pour vérifier le rôle d'un utilisateur
-- ============================================

CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();

  RETURN user_role = required_role OR user_role = 'ADMIN';
END;
$$;

-- ============================================
-- 6. Table pour gérer les invitations (optionnel)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES public.users(id),
  status_code TEXT DEFAULT 'AUTRE' REFERENCES member_statuses(code),
  role TEXT DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'TREASURER', 'VALIDATOR', 'MEMBER')),
  invitation_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.user_invitations(invitation_token);

-- RLS pour invitations
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invitations"
  ON public.user_invitations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- ============================================
-- 7. Fonction pour inviter un utilisateur
-- ============================================

CREATE OR REPLACE FUNCTION public.invite_user(
  user_email TEXT,
  user_status_code TEXT DEFAULT 'AUTRE',
  user_role TEXT DEFAULT 'MEMBER'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_id UUID;
  invitation_token TEXT;
  result JSON;
BEGIN
  -- Vérifier que l'appelant est admin
  IF NOT has_role('ADMIN') THEN
    RAISE EXCEPTION 'Seuls les administrateurs peuvent inviter des utilisateurs';
  END IF;

  -- Créer l'invitation
  INSERT INTO public.user_invitations (email, invited_by, status_code, role)
  VALUES (user_email, auth.uid(), user_status_code, user_role)
  RETURNING id, invitation_token INTO invitation_id, invitation_token;

  SELECT json_build_object(
    'success', true,
    'invitation_id', invitation_id,
    'invitation_token', invitation_token,
    'invitation_link', 'https://votre-domaine.com/register?token=' || invitation_token
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 8. Commentaires pour documentation
-- ============================================

COMMENT ON FUNCTION public.handle_new_user IS 'Synchronise automatiquement les nouveaux utilisateurs auth.users avec public.users';
COMMENT ON FUNCTION public.update_user_profile IS 'Permet à un utilisateur de mettre à jour son profil';
COMMENT ON FUNCTION public.has_role IS 'Vérifie si l''utilisateur actuel a le rôle spécifié';
COMMENT ON FUNCTION public.invite_user IS 'Permet aux admins d''inviter de nouveaux utilisateurs';
COMMENT ON VIEW public.user_profile IS 'Vue complète du profil utilisateur avec statistiques';
COMMENT ON TABLE public.user_invitations IS 'Gère les invitations de nouveaux utilisateurs';

-- ============================================
-- 9. Statistiques initiales
-- ============================================

SELECT 
  'Configuration authentification complète' as status,
  COUNT(*) as total_users
FROM public.users;
