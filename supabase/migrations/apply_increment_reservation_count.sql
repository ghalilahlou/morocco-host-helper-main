-- ✅ Script pour créer la fonction increment_reservation_count si elle n'existe pas
-- À exécuter dans Supabase SQL Editor si la fonction n'est pas disponible

-- Créer la table token_control_settings si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.token_control_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  control_type TEXT DEFAULT 'unlimited' CHECK (control_type IN ('blocked', 'limited', 'unlimited')),
  max_reservations INTEGER NULL,
  current_reservations INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_token_control_settings_property_id 
ON public.token_control_settings(property_id);

-- Créer la fonction increment_reservation_count
CREATE OR REPLACE FUNCTION public.increment_reservation_count(property_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  settings_record token_control_settings%ROWTYPE;
BEGIN
  -- Récupérer les paramètres de contrôle
  SELECT * INTO settings_record
  FROM token_control_settings
  WHERE property_id = property_uuid
  AND is_enabled = true;
  
  -- Si pas de paramètres, pas besoin d'incrémenter
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  
  -- Incrémenter le compteur seulement si c'est limité
  IF settings_record.control_type = 'limited' THEN
    UPDATE token_control_settings
    SET current_reservations = current_reservations + 1,
        updated_at = NOW()
    WHERE property_id = property_uuid
    AND is_enabled = true;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accorder les permissions
GRANT EXECUTE ON FUNCTION public.increment_reservation_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_reservation_count(UUID) TO anon;

-- Commentaire
COMMENT ON FUNCTION public.increment_reservation_count(UUID) IS 'Incrémente le compteur de réservations pour une propriété (optionnel)';

