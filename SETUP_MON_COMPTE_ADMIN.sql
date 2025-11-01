-- ============================================
-- CONFIGURATION TON COMPTE ADMIN
-- ============================================
-- À exécuter dans Supabase SQL Editor
-- Pour te donner les droits ADMIN + TREASURER
-- ============================================

-- 1. Trouver ton user_id (remplace par ton email Google)
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'ton.email@afneus.org'; -- ⚠️ REMPLACE PAR TON EMAIL GOOGLE !
BEGIN
  -- Récupérer l'ID depuis auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ User non trouvé avec cet email: %', v_email;
  ELSE
    -- Mettre à jour le profil
    UPDATE public.users
    SET 
      status = 'BN',           -- Statut BN (80% remboursement)
      role = 'ADMIN',          -- Rôle ADMIN (accès total)
      iban = 'FR7630001007941234567890185', -- IBAN de test
      iban_holder_name = 'Mohamed AFNEUS',
      iban_verified = true
    WHERE id = v_user_id;
    
    RAISE NOTICE '✅ Profil mis à jour pour: % (ID: %)', v_email, v_user_id;
    RAISE NOTICE '   Status: BN';
    RAISE NOTICE '   Role: ADMIN';
    RAISE NOTICE '   IBAN configuré';
  END IF;
END $$;

-- 2. Vérifier le résultat
SELECT 
  id,
  email,
  first_name,
  last_name,
  status,
  role,
  iban,
  created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 5;
