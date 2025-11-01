-- ============================================
-- CRÉER UN USER DE TEST
-- ============================================
-- À exécuter dans Supabase SQL Editor
-- pour tester le site SANS Google OAuth
-- ============================================

-- 1. Créer un user dans auth.users (Supabase Auth)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  role,
  aud
) VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'test@afneus.org',
  crypt('password123', gen_salt('bf')), -- Mot de passe: password123
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Test","last_name":"BN","birth_date":"2000-01-01"}'::jsonb,
  NOW(),
  NOW(),
  '',
  '',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- 2. Créer identité email
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"test@afneus.org"}'::jsonb,
  'email',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (provider, id) DO NOTHING;

-- 3. Le trigger handle_new_user() créera automatiquement le profil dans public.users
-- avec status='BN' car email contient '@afneus.org'

-- 4. Mettre à jour le profil avec IBAN pour tester le SEPA
UPDATE public.users 
SET 
  iban = 'FR7630001007941234567890185',
  iban_holder_name = 'Test BN',
  iban_verified = true,
  role = 'ADMIN' -- Pour tester toutes les fonctionnalités
WHERE id = '11111111-1111-1111-1111-111111111111';

-- ============================================
-- USER VALIDATOR DE TEST
-- ============================================

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  role,
  aud
) VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'validator@afneus.org',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Validator","last_name":"Test","birth_date":"1995-01-01"}'::jsonb,
  NOW(),
  NOW(),
  '',
  '',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"validator@afneus.org"}'::jsonb,
  'email',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (provider, id) DO NOTHING;

UPDATE public.users 
SET role = 'VALIDATOR'
WHERE id = '22222222-2222-2222-2222-222222222222';

-- ============================================
-- ÉVÉNEMENT DE TEST
-- ============================================

INSERT INTO public.events (
  id,
  name,
  description,
  location,
  departure_city,
  start_date,
  end_date,
  type,
  status,
  created_by
) VALUES (
  '33333333-3333-3333-3333-333333333333'::uuid,
  'AG Annuelle 2025',
  'Assemblée Générale annuelle de l''AFNEUS',
  'Paris',
  'Lyon', -- Ville de départ pour calcul SNCF
  '2025-12-15 10:00:00+00',
  '2025-12-15 18:00:00+00',
  'AG',
  'PUBLISHED',
  '11111111-1111-1111-1111-111111111111'::uuid
) ON CONFLICT (id) DO NOTHING;

-- Les barèmes seront créés automatiquement par le trigger auto_create_baremes_on_event

-- ✅ USERS CRÉÉS:
-- test@afneus.org / password123 (ADMIN + BN)
-- validator@afneus.org / password123 (VALIDATOR)

-- ✅ ÉVÉNEMENT CRÉÉ:
-- AG Annuelle 2025 (Lyon → Paris)

SELECT '✅ Users et événement de test créés !' as message;
