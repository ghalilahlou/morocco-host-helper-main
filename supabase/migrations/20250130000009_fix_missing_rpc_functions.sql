-- ✅ CORRECTION: Créer les fonctions RPC manquantes qui causent les erreurs dans les logs

-- 1. Fonction pour vérifier si la génération de réservations est autorisée
CREATE OR REPLACE FUNCTION public.check_reservation_allowed(property_uuid UUID)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  control_type TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_record token_control_settings%ROWTYPE;
BEGIN
  -- Récupérer les paramètres de contrôle pour cette propriété
  SELECT * INTO settings_record
  FROM token_control_settings
  WHERE property_id = property_uuid
  AND is_enabled = true;
  
  -- Si pas de paramètres, autoriser par défaut
  IF NOT FOUND THEN
    RETURN QUERY SELECT true, 'No restrictions configured', 'unlimited';
    RETURN;
  END IF;
  
  -- Vérifier selon le type de contrôle
  CASE settings_record.control_type
    WHEN 'blocked' THEN
      RETURN QUERY SELECT false, 'Reservations blocked for this property', 'blocked';
    WHEN 'limited' THEN
      IF settings_record.max_reservations IS NULL OR 
         settings_record.current_reservations < settings_record.max_reservations THEN
        RETURN QUERY SELECT true, 'Reservations allowed within limit', 'limited';
      ELSE
        RETURN QUERY SELECT false, 'Maximum reservations reached', 'limited';
      END IF;
    WHEN 'unlimited' THEN
      RETURN QUERY SELECT true, 'Unlimited reservations allowed', 'unlimited';
    ELSE
      RETURN QUERY SELECT true, 'Unknown control type, defaulting to allowed', 'unlimited';
  END CASE;
END;
$$;

-- 2. Fonction pour incrémenter le compteur de réservations (version simplifiée)
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

-- 3. Créer la table token_control_settings si elle n'existe pas
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

-- 4. Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_token_control_settings_property_id 
ON public.token_control_settings(property_id);

-- 5. Accorder les permissions appropriées
GRANT EXECUTE ON FUNCTION public.check_reservation_allowed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_reservation_count(UUID) TO authenticated;

-- 6. Commentaires sur les fonctions
COMMENT ON FUNCTION public.check_reservation_allowed(UUID) IS 'Vérifie si la génération de réservations est autorisée pour une propriété';
COMMENT ON FUNCTION public.increment_reservation_count(UUID) IS 'Incrémente le compteur de réservations pour une propriété';
COMMENT ON TABLE public.token_control_settings IS 'Paramètres de contrôle des tokens de réservation par propriété';
