-- =====================================================
-- SCHÉMA SQL COMPLET - SYSTÈME DE REMBOURSEMENT AFNEUS
-- =====================================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABLE: users (profils utilisateurs étendus)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('treasurer', 'validator', 'user', 'viewer', 'admin_asso', 'bn_member')),
  pole TEXT, -- Pôle/département (logistics, communication, etc.)
  association_id UUID, -- Référence à l'association (si applicable)
  iban TEXT,
  bic TEXT,
  iban_verified BOOLEAN DEFAULT FALSE,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_association ON public.users(association_id);

-- =====================================================
-- TABLE: associations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL, -- Code unique (ex: ASSO_PARIS_01)
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
  cv_fiscaux INTEGER NOT NULL, -- Chevaux fiscaux
  rate_per_km DECIMAL(6, 4) NOT NULL, -- Tarif au km (ex: 0.5230)
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_bareme_cv_date UNIQUE (cv_fiscaux, valid_from)
);

-- Seed barèmes 2024/2025 (source: impots.gouv.fr)
INSERT INTO public.baremes (cv_fiscaux, rate_per_km, valid_from, valid_to) VALUES
  (3, 0.529, '2024-01-01', NULL),
  (4, 0.606, '2024-01-01', NULL),
  (5, 0.636, '2024-01-01', NULL),
  (6, 0.665, '2024-01-01', NULL),
  (7, 0.697, '2024-01-01', NULL)
ON CONFLICT (cv_fiscaux, valid_from) DO NOTHING;

-- =====================================================
-- TABLE: taux_remboursement (taux selon rôle)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.taux_remboursement (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL UNIQUE CHECK (role IN ('bn_member', 'admin_asso', 'user')),
  taux DECIMAL(3, 2) NOT NULL CHECK (taux >= 0 AND taux <= 1), -- 0.80 = 80%
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
-- TABLE: plafonds (plafonds par type de dépense)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.plafonds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_type TEXT NOT NULL CHECK (expense_type IN ('transport', 'train', 'car', 'hotel', 'meal', 'registration', 'other')),
  plafond_unitaire DECIMAL(10, 2), -- Plafond par dépense (ex: 150€ max pour un hôtel)
  plafond_journalier DECIMAL(10, 2), -- Plafond par jour (ex: 200€/jour)
  plafond_mensuel DECIMAL(10, 2), -- Plafond par mois
  requires_validation BOOLEAN DEFAULT FALSE, -- Si dépasse, validation obligatoire
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
-- TABLE: expense_claims (demandes de remboursement)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.expense_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
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
  calculated_amount DECIMAL(10, 2), -- Montant calculé automatiquement
  reimbursable_amount DECIMAL(10, 2), -- Montant final remboursable
  taux_applied DECIMAL(3, 2), -- Taux appliqué (0.80, 0.65, etc.)
  
  -- Description et justification
  description TEXT,
  merchant_name TEXT, -- Nom du commerçant/fournisseur
  
  -- Workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'incomplete', 'to_validate', 'validated', 'refused', 'exported_for_payment', 'paid', 'closed', 'disputed')),
  submitted_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES public.users(id),
  paid_at TIMESTAMPTZ,
  
  -- Validation
  validation_comment TEXT,
  refusal_reason TEXT,
  requires_second_validation BOOLEAN DEFAULT FALSE,
  second_validator_id UUID REFERENCES public.users(id),
  
  -- Paiement
  payment_batch_id UUID, -- Référence au lot de paiement
  payment_reference TEXT, -- Référence banque
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Flags
  has_justificatifs BOOLEAN DEFAULT FALSE,
  is_duplicate_suspect BOOLEAN DEFAULT FALSE,
  reminder_sent_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ
);

CREATE INDEX idx_claims_user ON public.expense_claims(user_id);
CREATE INDEX idx_claims_status ON public.expense_claims(status);
CREATE INDEX idx_claims_date ON public.expense_claims(expense_date);
CREATE INDEX idx_claims_validator ON public.expense_claims(validated_by);
CREATE INDEX idx_claims_payment_batch ON public.expense_claims(payment_batch_id);
CREATE INDEX idx_claims_duplicate ON public.expense_claims(user_id, expense_date, amount_ttc) WHERE is_duplicate_suspect = FALSE;

-- =====================================================
-- TABLE: justificatifs (pièces jointes)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.justificatifs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_claim_id UUID NOT NULL REFERENCES public.expense_claims(id) ON DELETE CASCADE,
  
  -- Fichier
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Chemin dans Supabase Storage
  file_type TEXT NOT NULL, -- image/jpeg, application/pdf
  file_size INTEGER NOT NULL, -- En bytes
  
  -- OCR (optionnel)
  ocr_extracted_data JSONB, -- {amount, date, merchant, ...}
  ocr_processed BOOLEAN DEFAULT FALSE,
  ocr_confidence DECIMAL(3, 2),
  
  -- Archivage
  drive_file_id TEXT, -- ID fichier Google Drive (si archivé)
  
  -- Métadonnées
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES public.users(id),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_justificatifs_claim ON public.justificatifs(expense_claim_id);

-- =====================================================
-- TABLE: payment_batches (lots de paiement SEPA)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payment_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_name TEXT NOT NULL,
  batch_date DATE NOT NULL,
  
  -- Montants
  total_amount DECIMAL(12, 2) NOT NULL,
  total_claims INTEGER NOT NULL,
  
  -- Export
  sepa_xml_path TEXT, -- Chemin fichier SEPA XML généré
  csv_export_path TEXT,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'exported', 'sent_to_bank', 'processed', 'closed')),
  exported_at TIMESTAMPTZ,
  exported_by UUID REFERENCES public.users(id),
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_payment_batches_status ON public.payment_batches(status);
CREATE INDEX idx_payment_batches_date ON public.payment_batches(batch_date);

-- =====================================================
-- TABLE: audit_logs (journal d'audit complet)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Acteur
  actor_id UUID REFERENCES public.users(id),
  actor_email TEXT,
  actor_role TEXT,
  
  -- Action
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'validate', 'refuse', 'export', 'pay'
  entity_type TEXT NOT NULL, -- 'expense_claim', 'user', 'payment_batch'
  entity_id UUID NOT NULL,
  
  -- Changements
  before_data JSONB,
  after_data JSONB,
  diff JSONB, -- Différence calculée
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- Métadonnées
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_audit_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON public.audit_logs(timestamp DESC);

-- =====================================================
-- TABLE: notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Notification
  type TEXT NOT NULL, -- 'claim_submitted', 'claim_validated', 'claim_refused', 'missing_justificatif', 'payment_processed'
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
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

-- =====================================================
-- TABLE: config (configuration système)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id)
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
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_claims_updated_at BEFORE UPDATE ON public.expense_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
    AND id != NEW.id
    AND status NOT IN ('refused', 'closed');
  
  IF duplicate_count > 0 THEN
    NEW.is_duplicate_suspect = TRUE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_duplicate_before_insert BEFORE INSERT ON public.expense_claims
  FOR EACH ROW EXECUTE FUNCTION check_duplicate_claims();

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
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Treasurers can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('treasurer', 'validator')
    )
  );

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- POLICIES: expense_claims
CREATE POLICY "Users can view their own claims" ON public.expense_claims
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Validators can view claims to validate" ON public.expense_claims
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('treasurer', 'validator')
    )
  );

CREATE POLICY "Users can create their own claims" ON public.expense_claims
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their draft claims" ON public.expense_claims
  FOR UPDATE USING (
    user_id = auth.uid() AND status = 'draft'
  );

CREATE POLICY "Validators can update claims for validation" ON public.expense_claims
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('treasurer', 'validator')
    ) AND status IN ('submitted', 'to_validate', 'incomplete')
  );

-- POLICIES: justificatifs
CREATE POLICY "Users can view their own justificatifs" ON public.justificatifs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.expense_claims 
      WHERE id = expense_claim_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Validators can view all justificatifs" ON public.justificatifs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('treasurer', 'validator')
    )
  );

CREATE POLICY "Users can upload their own justificatifs" ON public.justificatifs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expense_claims 
      WHERE id = expense_claim_id AND user_id = auth.uid()
    )
  );

-- POLICIES: payment_batches (treasurer only)
CREATE POLICY "Treasurers can manage payment batches" ON public.payment_batches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'treasurer'
    )
  );

-- POLICIES: audit_logs (read-only for treasurers)
CREATE POLICY "Treasurers can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('treasurer')
    )
  );

-- POLICIES: notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- POLICIES: config (read for all, write for treasurer)
CREATE POLICY "All authenticated users can read config" ON public.config
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Treasurers can update config" ON public.config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'treasurer'
    )
  );

-- POLICIES: baremes, taux, plafonds (read for all)
CREATE POLICY "All authenticated users can read baremes" ON public.baremes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can read taux" ON public.taux_remboursement
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can read plafonds" ON public.plafonds
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================================================
-- VUES UTILES
-- =====================================================

-- Vue: Claims avec informations utilisateur enrichies
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

-- Vue: Statistiques par utilisateur
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
  (SELECT SUM(reimbursable_amount) FROM public.expense_claims WHERE status = 'validated') AS total_to_pay,
  (SELECT COUNT(*) FROM public.expense_claims WHERE status = 'validated') AS claims_to_pay,
  (SELECT AVG(EXTRACT(EPOCH FROM (validated_at - submitted_at))/86400) FROM public.expense_claims WHERE validated_at IS NOT NULL AND submitted_at > NOW() - INTERVAL '30 days') AS avg_validation_days_30d;

-- =====================================================
-- FIN DU SCHÉMA
-- =====================================================
