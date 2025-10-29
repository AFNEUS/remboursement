-- =====================================================
-- SCHÉMA SQL COMPLET - SYSTÈME DE REMBOURSEMENT AFNEUS
-- VERSION CORRIGÉE (compatible Supabase Dashboard)
-- =====================================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABLE: users (profils utilisateurs étendus)
-- =====================================================
-- NOTE: Cette table étend auth.users de Supabase
-- La contrainte FK sera créée APRÈS vérification
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('treasurer', 'validator', 'user', 'viewer', 'admin_asso', 'bn_member')),
  pole TEXT,
  association_id UUID,
  iban TEXT,
  bic TEXT,
  iban_holder_name TEXT,
  iban_verified BOOLEAN DEFAULT FALSE,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Ajouter FK vers auth.users SEULEMENT si la table existe ET que la contrainte n'existe pas
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') 
     AND NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'users_id_fkey') THEN
    ALTER TABLE public.users 
      ADD CONSTRAINT users_id_fkey 
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_association ON public.users(association_id);

-- =====================================================
-- TABLE: associations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  budget_annual DECIMAL(10, 2),
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- TABLE: baremes (barèmes kilométriques)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.baremes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cv_fiscaux INTEGER NOT NULL,
  rate_per_km DECIMAL(6, 4) NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_bareme_cv_date UNIQUE (cv_fiscaux, valid_from)
);

-- Seed barèmes 2024/2025
INSERT INTO public.baremes (cv_fiscaux, rate_per_km, valid_from, valid_to) VALUES
  (3, 0.529, '2024-01-01', NULL),
  (4, 0.606, '2024-01-01', NULL),
  (5, 0.636, '2024-01-01', NULL),
  (6, 0.665, '2024-01-01', NULL),
  (7, 0.697, '2024-01-01', NULL)
ON CONFLICT (cv_fiscaux, valid_from) DO NOTHING;

-- =====================================================
-- TABLE: taux_remboursement
-- =====================================================
CREATE TABLE IF NOT EXISTS public.taux_remboursement (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL UNIQUE CHECK (role IN ('bn_member', 'admin_asso', 'user')),
  taux DECIMAL(3, 2) NOT NULL CHECK (taux >= 0 AND taux <= 1),
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.taux_remboursement (role, taux, valid_from) VALUES
  ('bn_member', 0.80, '2024-01-01'),
  ('admin_asso', 0.65, '2024-01-01'),
  ('user', 0.50, '2024-01-01')
ON CONFLICT (role) DO NOTHING;

-- =====================================================
-- TABLE: plafonds
-- =====================================================
CREATE TABLE IF NOT EXISTS public.plafonds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_type TEXT NOT NULL CHECK (expense_type IN ('transport', 'train', 'car', 'hotel', 'meal', 'registration', 'other')),
  plafond_unitaire DECIMAL(10, 2),
  plafond_journalier DECIMAL(10, 2),
  plafond_mensuel DECIMAL(10, 2),
  requires_validation BOOLEAN DEFAULT FALSE,
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.plafonds (expense_type, plafond_unitaire, plafond_journalier, requires_validation, valid_from) VALUES
  ('hotel', 150.00, 200.00, TRUE, '2024-01-01'),
  ('meal', 25.00, 50.00, FALSE, '2024-01-01'),
  ('train', NULL, NULL, FALSE, '2024-01-01'),
  ('car', NULL, 500.00, TRUE, '2024-01-01'),
  ('registration', 500.00, NULL, TRUE, '2024-01-01')
ON CONFLICT DO NOTHING;

-- =====================================================
-- TABLE: expense_claims
-- =====================================================
CREATE TABLE IF NOT EXISTS public.expense_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  
  -- Informations de la dépense
  expense_type TEXT NOT NULL CHECK (expense_type IN ('transport', 'train', 'car', 'hotel', 'meal', 'registration', 'other')),
  expense_date DATE NOT NULL,
  amount_ttc DECIMAL(10, 2) NOT NULL CHECK (amount_ttc >= 0),
  currency TEXT DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD', 'GBP', 'CHF')),
  
  -- Transport spécifique
  departure_location TEXT,
  arrival_location TEXT,
  distance_km DECIMAL(8, 2),
  cv_fiscaux INTEGER,
  
  -- Calcul remboursement
  calculated_amount DECIMAL(10, 2),
  reimbursable_amount DECIMAL(10, 2),
  taux_applied DECIMAL(3, 2),
  
  -- Description
  description TEXT,
  merchant_name TEXT,
  
  -- Workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'incomplete', 'to_validate', 'validated', 'refused', 'in_payment_batch', 'paid', 'closed')),
  submitted_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  validated_by UUID,
  validator_comment TEXT,
  paid_at TIMESTAMPTZ,
  refusal_reason TEXT,
  requires_second_validation BOOLEAN DEFAULT FALSE,
  second_validator_id UUID,
  
  -- Paiement
  payment_batch_id UUID,
  payment_reference TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Flags
  has_justificatifs BOOLEAN DEFAULT FALSE,
  is_duplicate_suspect BOOLEAN DEFAULT FALSE,
  reminder_sent_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  
  -- Foreign keys
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  FOREIGN KEY (validated_by) REFERENCES public.users(id),
  FOREIGN KEY (second_validator_id) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_claims_user ON public.expense_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.expense_claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_date ON public.expense_claims(expense_date);
CREATE INDEX IF NOT EXISTS idx_claims_validator ON public.expense_claims(validated_by);
CREATE INDEX IF NOT EXISTS idx_claims_payment_batch ON public.expense_claims(payment_batch_id);
CREATE INDEX IF NOT EXISTS idx_claims_duplicate ON public.expense_claims(user_id, expense_date, amount_ttc) WHERE is_duplicate_suspect = FALSE;

-- =====================================================
-- TABLE: justificatifs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.justificatifs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_claim_id UUID NOT NULL,
  
  -- Fichier
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  
  -- OCR (optionnel)
  ocr_extracted_data JSONB,
  ocr_processed BOOLEAN DEFAULT FALSE,
  ocr_confidence DECIMAL(3, 2),
  
  -- Archivage
  drive_file_id TEXT,
  
  -- Métadonnées
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Foreign keys
  FOREIGN KEY (expense_claim_id) REFERENCES public.expense_claims(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_justificatifs_claim ON public.justificatifs(expense_claim_id);

-- =====================================================
-- TABLE: payment_batches
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payment_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_name TEXT NOT NULL,
  batch_date DATE NOT NULL,
  
  -- Montants
  total_amount DECIMAL(12, 2) NOT NULL,
  total_claims INTEGER NOT NULL,
  
  -- Export
  sepa_xml_path TEXT,
  csv_export_path TEXT,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'exported', 'sent_to_bank', 'processed', 'closed')),
  exported_at TIMESTAMPTZ,
  exported_by UUID,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Foreign keys
  FOREIGN KEY (exported_by) REFERENCES public.users(id),
  FOREIGN KEY (created_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_batches_status ON public.payment_batches(status);
CREATE INDEX IF NOT EXISTS idx_payment_batches_date ON public.payment_batches(batch_date);

-- =====================================================
-- TABLE: audit_logs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Acteur
  actor_id UUID,
  actor_email TEXT,
  actor_role TEXT,
  
  -- Action
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  
  -- Changements
  before_data JSONB,
  after_data JSONB,
  diff JSONB,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- Métadonnées
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Foreign key
  FOREIGN KEY (actor_id) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_logs(timestamp DESC);

-- =====================================================
-- TABLE: notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  
  -- Notification
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Lien
  related_entity_type TEXT,
  related_entity_id UUID,
  
  -- Statut
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Email
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Foreign key
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- =====================================================
-- TABLE: config
-- =====================================================
CREATE TABLE IF NOT EXISTS public.config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  
  -- Foreign key
  FOREIGN KEY (updated_by) REFERENCES public.users(id)
);

INSERT INTO public.config (key, value, description) VALUES
  ('reminder_delay_days', '7', 'Délai en jours avant envoi de rappel pour justificatifs manquants'),
  ('second_validation_threshold', '500', 'Montant en EUR nécessitant une seconde validation'),
  ('data_retention_years', '10', 'Durée de conservation des données (années)'),
  ('iban_validation_enabled', 'true', 'Activer la validation IBAN externe'),
  ('ocr_enabled', 'false', 'Activer l''extraction OCR des justificatifs'),
  ('distance_matrix_enabled', 'false', 'Activer le calcul automatique des distances'),
  ('google_drive_sync_enabled', 'true', 'Synchroniser avec Google Drive')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- FONCTIONS UTILITAIRES
-- =====================================================

-- Fonction: mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expense_claims_updated_at ON public.expense_claims;
CREATE TRIGGER update_expense_claims_updated_at BEFORE UPDATE ON public.expense_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_associations_updated_at ON public.associations;
CREATE TRIGGER update_associations_updated_at BEFORE UPDATE ON public.associations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction: détecter les doublons suspects
CREATE OR REPLACE FUNCTION check_duplicate_claims()
RETURNS TRIGGER AS $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM public.expense_claims
  WHERE user_id = NEW.user_id
    AND expense_date = NEW.expense_date
    AND ABS(amount_ttc - NEW.amount_ttc) < 0.01
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND status NOT IN ('refused', 'closed');
  
  IF duplicate_count > 0 THEN
    NEW.is_duplicate_suspect = TRUE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_duplicate_before_insert ON public.expense_claims;
CREATE TRIGGER check_duplicate_before_insert BEFORE INSERT ON public.expense_claims
  FOR EACH ROW EXECUTE FUNCTION check_duplicate_claims();

-- Fonction: générer référence automatique (désactivée car colonne reference retirée)
-- La référence sera gérée côté application avec l'ID

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justificatifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baremes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taux_remboursement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plafonds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

-- POLICIES: users
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Treasurers can view all users" ON public.users;
CREATE POLICY "Treasurers can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('treasurer', 'validator')
    )
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- POLICIES: expense_claims
DROP POLICY IF EXISTS "Users can view their own claims" ON public.expense_claims;
CREATE POLICY "Users can view their own claims" ON public.expense_claims
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Validators can view claims to validate" ON public.expense_claims;
CREATE POLICY "Validators can view claims to validate" ON public.expense_claims
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('treasurer', 'validator')
    )
  );

DROP POLICY IF EXISTS "Users can create their own claims" ON public.expense_claims;
CREATE POLICY "Users can create their own claims" ON public.expense_claims
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their draft claims" ON public.expense_claims;
CREATE POLICY "Users can update their draft claims" ON public.expense_claims
  FOR UPDATE USING (
    user_id = auth.uid() AND status = 'draft'
  );

DROP POLICY IF EXISTS "Validators can update claims for validation" ON public.expense_claims;
CREATE POLICY "Validators can update claims for validation" ON public.expense_claims
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('treasurer', 'validator')
    ) AND status IN ('submitted', 'to_validate', 'incomplete')
  );

-- POLICIES: justificatifs
DROP POLICY IF EXISTS "Users can view their own justificatifs" ON public.justificatifs;
CREATE POLICY "Users can view their own justificatifs" ON public.justificatifs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.expense_claims 
      WHERE id = expense_claim_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Validators can view all justificatifs" ON public.justificatifs;
CREATE POLICY "Validators can view all justificatifs" ON public.justificatifs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('treasurer', 'validator')
    )
  );

DROP POLICY IF EXISTS "Users can upload their own justificatifs" ON public.justificatifs;
CREATE POLICY "Users can upload their own justificatifs" ON public.justificatifs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expense_claims 
      WHERE id = expense_claim_id AND user_id = auth.uid()
    )
  );

-- POLICIES: payment_batches
DROP POLICY IF EXISTS "Treasurers can manage payment batches" ON public.payment_batches;
CREATE POLICY "Treasurers can manage payment batches" ON public.payment_batches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'treasurer'
    )
  );

-- POLICIES: audit_logs
DROP POLICY IF EXISTS "Treasurers can view audit logs" ON public.audit_logs;
CREATE POLICY "Treasurers can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('treasurer')
    )
  );

-- POLICIES: notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- POLICIES: config
DROP POLICY IF EXISTS "All authenticated users can read config" ON public.config;
CREATE POLICY "All authenticated users can read config" ON public.config
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Treasurers can update config" ON public.config;
CREATE POLICY "Treasurers can update config" ON public.config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'treasurer'
    )
  );

-- POLICIES: baremes, taux, plafonds
DROP POLICY IF EXISTS "All authenticated users can read baremes" ON public.baremes;
CREATE POLICY "All authenticated users can read baremes" ON public.baremes
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "All authenticated users can read taux" ON public.taux_remboursement;
CREATE POLICY "All authenticated users can read taux" ON public.taux_remboursement
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "All authenticated users can read plafonds" ON public.plafonds;
CREATE POLICY "All authenticated users can read plafonds" ON public.plafonds
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================================================
-- VUES UTILES
-- =====================================================

-- Vue: Claims enrichis
CREATE OR REPLACE VIEW public.claims_enriched AS
SELECT 
  c.*,
  u.full_name,
  u.email,
  u.role,
  u.pole,
  u.iban,
  u.iban_verified,
  v.full_name AS validator_name,
  pb.batch_name AS payment_batch_name,
  (SELECT COUNT(*) FROM public.justificatifs WHERE expense_claim_id = c.id) AS justificatifs_count
FROM public.expense_claims c
LEFT JOIN public.users u ON c.user_id = u.id
LEFT JOIN public.users v ON c.validated_by = v.id
LEFT JOIN public.payment_batches pb ON c.payment_batch_id = pb.id;

-- Vue: Statistiques utilisateur
CREATE OR REPLACE VIEW public.user_stats AS
SELECT 
  user_id,
  COUNT(*) AS total_claims,
  SUM(CASE WHEN status = 'validated' THEN 1 ELSE 0 END) AS validated_claims,
  SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_claims,
  SUM(reimbursable_amount) FILTER (WHERE status IN ('validated', 'paid')) AS total_reimbursed,
  AVG(EXTRACT(EPOCH FROM (validated_at - submitted_at))/86400) FILTER (WHERE validated_at IS NOT NULL) AS avg_validation_days
FROM public.expense_claims
GROUP BY user_id;

-- Vue: Dashboard trésorier
CREATE OR REPLACE VIEW public.treasurer_dashboard AS
SELECT 
  (SELECT COUNT(*) FROM public.expense_claims WHERE status = 'to_validate') AS pending_validation,
  (SELECT COUNT(*) FROM public.expense_claims WHERE status = 'incomplete') AS incomplete_claims,
  (SELECT COALESCE(SUM(reimbursable_amount), 0) FROM public.expense_claims WHERE status = 'validated') AS total_to_pay,
  (SELECT COUNT(*) FROM public.expense_claims WHERE status = 'validated') AS claims_to_pay,
  (SELECT AVG(EXTRACT(EPOCH FROM (validated_at - submitted_at))/86400) FROM public.expense_claims WHERE validated_at IS NOT NULL AND submitted_at > NOW() - INTERVAL '30 days') AS avg_validation_days_30d;

-- =====================================================
-- MESSAGE DE SUCCÈS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SCHÉMA CRÉÉ AVEC SUCCÈS !';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables créées : 11';
  RAISE NOTICE 'Vues créées : 3';
  RAISE NOTICE 'Fonctions : 3';
  RAISE NOTICE 'Triggers : 5';
  RAISE NOTICE 'Policies RLS : 20+';
  RAISE NOTICE '';
  RAISE NOTICE 'Prochaines étapes :';
  RAISE NOTICE '1. Créer bucket Storage "justificatifs"';
  RAISE NOTICE '2. Activer Google Auth provider';
  RAISE NOTICE '3. Se connecter et créer premier user admin';
  RAISE NOTICE '========================================';
END $$;
