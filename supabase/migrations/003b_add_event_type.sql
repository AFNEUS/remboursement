-- ============================================
-- Migration 003B: Ajout colonne event_type si elle n'existe pas
-- ============================================

-- Vérifier et ajouter la colonne event_type si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'events' 
        AND column_name = 'event_type'
    ) THEN
        ALTER TABLE public.events 
        ADD COLUMN event_type TEXT DEFAULT 'AUTRE' CHECK (event_type IN (
            'CONGRES_ANNUEL',
            'WEEKEND_PASSATION',
            'FORMATION',
            'REUNION_BN',
            'REUNION_REGION',
            'EVENEMENT_EXTERNE',
            'AUTRE'
        ));
        
        -- Créer l'index
        CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(event_type);
    END IF;
END $$;

-- Mettre à jour les événements existants si nécessaire
UPDATE public.events 
SET event_type = 'AUTRE' 
WHERE event_type IS NULL;
