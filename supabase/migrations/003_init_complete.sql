-- Script d'initialisation complète de la base de données AFNEUS
-- À exécuter dans Supabase SQL Editor

-- 1. Insertion des barèmes kilométriques 2024
INSERT INTO public.baremes (fiscal_power, rate_0_5000, rate_5001_20000, rate_20001_plus, effective_from, active)
VALUES 
  (3, 0.529, 0.316, 0.370, '2024-01-01', true),
  (4, 0.606, 0.340, 0.407, '2024-01-01', true),
  (5, 0.636, 0.357, 0.427, '2024-01-01', true),
  (6, 0.665, 0.374, 0.447, '2024-01-01', true),
  (7, 0.697, 0.394, 0.470, '2024-01-01', true)
ON CONFLICT (fiscal_power, effective_from) DO UPDATE SET
  rate_0_5000 = EXCLUDED.rate_0_5000,
  rate_5001_20000 = EXCLUDED.rate_5001_20000,
  rate_20001_plus = EXCLUDED.rate_20001_plus,
  active = EXCLUDED.active;

-- 2. Configuration par défaut de l'association
INSERT INTO public.config (key, value, description)
VALUES 
  ('association_name', '"AFNEUS"', 'Nom de l''association'),
  ('association_full_name', '"Association de la Fédération Nationale des Étudiants Universitaires de Sousse"', 'Nom complet'),
  ('iban', '"FR76XXXXXXXXXXXXXXXXXXXXXXXXX"', 'IBAN de l''association'),
  ('bic', '"XXXXXXXX"', 'BIC/SWIFT'),
  ('sepa_creditor_id', '"FR00ZZZ000000"', 'Identifiant créancier SEPA'),
  ('validation_delay_hours', '48', 'Délai de validation en heures'),
  ('payment_delay_days', '7', 'Délai de paiement en jours'),
  ('max_claim_amount', '2000', 'Montant maximum par demande'),
  ('fiscal_year', '2024', 'Année fiscale en cours')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- 3. Taux de remboursement par catégorie
INSERT INTO public.taux_remboursement (code, label, description, rate, max_per_day, max_per_month)
VALUES 
  ('MEAL', 'Repas', 'Forfait repas', 15.00, 25.00, 500.00),
  ('HOTEL', 'Hébergement', 'Nuit d''hôtel', 0, 120.00, 1000.00),
  ('TRAIN_2ND', 'Train 2nde classe', 'Billet de train 2nde classe', 1.00, 150.00, 1500.00),
  ('TRAIN_1ST', 'Train 1ère classe', 'Billet de train 1ère classe', 1.00, 250.00, 2500.00),
  ('BUS', 'Bus/Car', 'Billet de bus ou car', 1.00, 50.00, 500.00),
  ('TOLL', 'Péage', 'Frais de péage autoroutier', 1.00, 100.00, 500.00),
  ('PARKING', 'Parking', 'Frais de stationnement', 1.00, 30.00, 200.00),
  ('TAXI', 'Taxi', 'Course de taxi', 1.00, 50.00, 300.00)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  rate = EXCLUDED.rate,
  max_per_day = EXCLUDED.max_per_day,
  max_per_month = EXCLUDED.max_per_month;

-- 4. Plafonds par catégorie
INSERT INTO public.plafonds (category_code, max_amount, period, description)
VALUES 
  ('MEAL', 25.00, 'day', 'Maximum par repas'),
  ('HOTEL', 120.00, 'day', 'Maximum par nuit'),
  ('TRAIN_2ND', 150.00, 'transaction', 'Maximum par trajet'),
  ('TRAIN_1ST', 250.00, 'transaction', 'Maximum par trajet'),
  ('BUS', 50.00, 'transaction', 'Maximum par trajet'),
  ('TOLL', 100.00, 'day', 'Maximum journalier'),
  ('PARKING', 30.00, 'day', 'Maximum journalier'),
  ('TAXI', 50.00, 'transaction', 'Maximum par course'),
  ('CAR', 500.00, 'day', 'Maximum kilométrique journalier')
ON CONFLICT (category_code, period) DO UPDATE SET
  max_amount = EXCLUDED.max_amount,
  description = EXCLUDED.description;

-- 5. Exemple d'association (à adapter)
INSERT INTO public.associations (name, code, address, city, postal_code, country, email, phone)
VALUES 
  ('AFNEUS', 'AFNEUS', 'Adresse de l''association', 'Sousse', '4000', 'Tunisie', 'contact@afneus.org', '+216XXXXXXXX')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  postal_code = EXCLUDED.postal_code,
  country = EXCLUDED.country,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

-- 6. Fonction pour vérifier les plafonds
CREATE OR REPLACE FUNCTION check_expense_ceiling(
  p_category_code VARCHAR,
  p_amount DECIMAL,
  p_user_id UUID,
  p_date DATE
) RETURNS TABLE(
  is_valid BOOLEAN,
  exceeded_by DECIMAL,
  ceiling DECIMAL,
  message TEXT
) AS $$
DECLARE
  v_ceiling DECIMAL;
  v_period VARCHAR;
  v_total DECIMAL;
BEGIN
  -- Récupérer le plafond
  SELECT max_amount, period INTO v_ceiling, v_period
  FROM plafonds
  WHERE category_code = p_category_code
  LIMIT 1;

  IF v_ceiling IS NULL THEN
    RETURN QUERY SELECT TRUE, 0::DECIMAL, 0::DECIMAL, 'Aucun plafond défini'::TEXT;
    RETURN;
  END IF;

  -- Calculer le total selon la période
  IF v_period = 'day' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM expense_claims
    WHERE user_id = p_user_id
      AND DATE(created_at) = p_date
      AND status IN ('draft', 'submitted', 'validated');
  ELSIF v_period = 'month' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM expense_claims
    WHERE user_id = p_user_id
      AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', p_date)
      AND status IN ('draft', 'submitted', 'validated');
  ELSE
    v_total := 0;
  END IF;

  -- Vérifier le dépassement
  IF (v_total + p_amount) > v_ceiling THEN
    RETURN QUERY SELECT 
      FALSE,
      (v_total + p_amount - v_ceiling),
      v_ceiling,
      format('Plafond dépassé de %.2f€ (plafond: %.2f€)', 
        (v_total + p_amount - v_ceiling), v_ceiling)::TEXT;
  ELSE
    RETURN QUERY SELECT 
      TRUE,
      0::DECIMAL,
      v_ceiling,
      'Montant dans le plafond'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Vue pour les statistiques
CREATE OR REPLACE VIEW claim_statistics AS
SELECT 
  DATE_TRUNC('month', created_at) AS month,
  status,
  COUNT(*) AS count,
  SUM(total_amount) AS total_amount,
  AVG(total_amount) AS avg_amount,
  MIN(total_amount) AS min_amount,
  MAX(total_amount) AS max_amount
FROM expense_claims
GROUP BY DATE_TRUNC('month', created_at), status
ORDER BY month DESC, status;

-- 8. Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_claims_user_date ON expense_claims(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_claims_status_date ON expense_claims(status, created_at);
CREATE INDEX IF NOT EXISTS idx_justificatifs_claim ON justificatifs(claim_id);

-- Afficher un résumé
SELECT 
  'Barèmes kilométriques' AS table_name, COUNT(*) AS count FROM baremes
UNION ALL
SELECT 'Configuration', COUNT(*) FROM config
UNION ALL
SELECT 'Taux de remboursement', COUNT(*) FROM taux_remboursement
UNION ALL
SELECT 'Plafonds', COUNT(*) FROM plafonds
UNION ALL
SELECT 'Associations', COUNT(*) FROM associations;
