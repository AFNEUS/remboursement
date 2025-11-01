-- Migration: Amélioration stockage trajets TRAIN
-- Date: 2024-11-01
-- Description: Ajoute des champs pour stocker les segments de trajet train

-- Ajouter colonne pour stocker les segments de trajet (JSON)
ALTER TABLE public.expense_items 
ADD COLUMN IF NOT EXISTS train_segments JSONB DEFAULT '[]'::jsonb;

-- Ajouter colonne pour le type de trajet
ALTER TABLE public.expense_items 
ADD COLUMN IF NOT EXISTS journey_type TEXT CHECK (journey_type IN ('ONE_WAY', 'ROUND_TRIP', 'MULTI_DESTINATION'));

-- Ajouter index pour recherche sur les gares
CREATE INDEX IF NOT EXISTS idx_expense_items_departure ON public.expense_items(departure);
CREATE INDEX IF NOT EXISTS idx_expense_items_arrival ON public.expense_items(arrival);
CREATE INDEX IF NOT EXISTS idx_expense_items_train_segments ON public.expense_items USING gin(train_segments);

-- Commentaires pour documentation
COMMENT ON COLUMN public.expense_items.train_segments IS 'Segments de trajet train au format JSON: [{id, from, to, fromStation, toStation, date, price}]';
COMMENT ON COLUMN public.expense_items.journey_type IS 'Type de trajet: ONE_WAY (aller simple), ROUND_TRIP (aller-retour), MULTI_DESTINATION (multi-destinations)';

-- Exemple de structure JSON pour train_segments:
/*
[
  {
    "id": "1",
    "from": "Paris Gare de Lyon",
    "to": "Lyon Part-Dieu",
    "fromStation": {
      "id": "stop_area:SNCF:87686006",
      "name": "Paris Gare de Lyon",
      "quality": 9
    },
    "toStation": {
      "id": "stop_area:SNCF:87723197",
      "name": "Lyon Part-Dieu",
      "quality": 9
    },
    "date": "2024-11-15",
    "price": 45.00
  }
]
*/
