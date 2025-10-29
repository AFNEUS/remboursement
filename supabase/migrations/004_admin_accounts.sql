-- ============================================
-- INSERTION DES COMPTES ADMIN INITIAUX
-- ============================================

-- NOTE: Ces comptes seront créés après que les utilisateurs se connectent avec Google OAuth
-- Pour l'instant, on prépare juste la structure

-- Une fois qu'ils se connectent, tu devras exécuter quelque chose comme :
/*
-- Exemple après première connexion Google du trésorier
UPDATE users 
SET role = 'treasurer', 
    status_code = 'BN',
    full_name = 'Prénom Nom Trésorier'
WHERE email = 'tresorier@afneus.fr';

-- Exemple pour vice-trésorier
UPDATE users 
SET role = 'treasurer', 
    status_code = 'BN',
    full_name = 'Prénom Nom Vice-Trésorier'
WHERE email = 'vice-tresorier@afneus.fr';

-- Exemple pour admin système
UPDATE users 
SET role = 'admin', 
    status_code = 'BN',
    full_name = 'Prénom Nom Admin'
WHERE email = 'admin@afneus.fr';
*/

-- ============================================
-- FONCTION pour promouvoir un utilisateur en admin
-- ============================================
CREATE OR REPLACE FUNCTION promote_to_admin(
  p_email TEXT,
  p_role TEXT DEFAULT 'treasurer',
  p_status TEXT DEFAULT 'BN'
) RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET role = p_role,
      status_code = p_status,
      updated_at = NOW()
  WHERE email = p_email;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur avec email % non trouvé', p_email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Exemple d'utilisation (à exécuter après connexion)
-- ============================================
/*
-- Promouvoir le trésorier
SELECT promote_to_admin('tresorier@afneus.fr', 'treasurer', 'BN');

-- Promouvoir le vice-trésorier  
SELECT promote_to_admin('vice-tresorier@afneus.fr', 'treasurer', 'BN');

-- Promouvoir l'admin
SELECT promote_to_admin('admin@afneus.fr', 'admin', 'BN');
*/
