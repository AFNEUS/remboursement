-- Insertion des barèmes kilométriques 2024 (barème fiscal officiel)
-- Ces barèmes couvrent TOUS les frais liés au véhicule : carburant, assurance, entretien, amortissement

INSERT INTO public.baremes (fiscal_power, rate_0_5000, rate_5001_20000, rate_20001_plus, effective_from, active)
VALUES 
  (3, 0.529, 0.316, 0.370, '2024-01-01', true),
  (4, 0.606, 0.340, 0.407, '2024-01-01', true),
  (5, 0.636, 0.357, 0.427, '2024-01-01', true),
  (6, 0.665, 0.374, 0.447, '2024-01-01', true),
  (7, 0.697, 0.394, 0.470, '2024-01-01', true)
ON CONFLICT (fiscal_power, effective_from) DO NOTHING;
