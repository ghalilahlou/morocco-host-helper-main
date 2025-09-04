-- Migration: Création de la table de contrôle des tokens
-- Date: 2025-01-30
-- Description: Permet aux administrateurs de contrôler l'utilisation des tokens de réservation

-- Créer la table token_control_settings
CREATE TABLE IF NOT EXISTS token_control_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    max_reservations INTEGER NULL, -- NULL = illimité
    current_reservations INTEGER DEFAULT 0,
    control_type VARCHAR(20) DEFAULT 'unlimited' CHECK (control_type IN ('blocked', 'limited', 'unlimited')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Contraintes
    CONSTRAINT valid_max_reservations CHECK (
        (control_type = 'limited' AND max_reservations IS NOT NULL AND max_reservations > 0) OR
        (control_type != 'limited' AND max_reservations IS NULL)
    ),
    CONSTRAINT valid_current_reservations CHECK (current_reservations >= 0)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_token_control_property ON token_control_settings(property_id);
CREATE INDEX IF NOT EXISTS idx_token_control_enabled ON token_control_settings(is_enabled);
CREATE INDEX IF NOT EXISTS idx_token_control_type ON token_control_settings(control_type);

-- RLS (Row Level Security)
ALTER TABLE token_control_settings ENABLE ROW LEVEL SECURITY;

-- Politique pour les admins (lecture et écriture)
CREATE POLICY "Admins can manage token control settings" ON token_control_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Politique pour les Edge Functions (lecture seule)
CREATE POLICY "Edge functions can read token control settings" ON token_control_settings
    FOR SELECT USING (true);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_token_control_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
CREATE TRIGGER trigger_update_token_control_updated_at
    BEFORE UPDATE ON token_control_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_token_control_updated_at();

-- Fonction pour créer des paramètres par défaut pour une propriété
CREATE OR REPLACE FUNCTION create_default_token_control_settings(property_uuid UUID)
RETURNS UUID AS $$
DECLARE
    settings_id UUID;
BEGIN
    -- Vérifier si des paramètres existent déjà
    IF EXISTS (SELECT 1 FROM token_control_settings WHERE property_id = property_uuid) THEN
        RAISE EXCEPTION 'Token control settings already exist for this property';
    END IF;
    
    -- Créer les paramètres par défaut
    INSERT INTO token_control_settings (
        property_id,
        is_enabled,
        control_type,
        created_by
    ) VALUES (
        property_uuid,
        true,
        'unlimited',
        auth.uid()
    ) RETURNING id INTO settings_id;
    
    RETURN settings_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si une réservation est autorisée
CREATE OR REPLACE FUNCTION check_reservation_allowed(property_uuid UUID)
RETURNS JSON AS $$
DECLARE
    settings_record token_control_settings%ROWTYPE;
    result JSON;
BEGIN
    -- Récupérer les paramètres de contrôle
    SELECT * INTO settings_record
    FROM token_control_settings
    WHERE property_id = property_uuid
    AND is_enabled = true;
    
    -- Si pas de paramètres, autoriser par défaut
    IF NOT FOUND THEN
        result := json_build_object(
            'allowed', true,
            'reason', 'No control settings found',
            'settings_id', null
        );
        RETURN result;
    END IF;
    
    -- Vérifier selon le type de contrôle
    CASE settings_record.control_type
        WHEN 'blocked' THEN
            result := json_build_object(
                'allowed', false,
                'reason', 'Reservations blocked by administrator',
                'settings_id', settings_record.id,
                'control_type', settings_record.control_type
            );
        WHEN 'limited' THEN
            IF settings_record.current_reservations >= settings_record.max_reservations THEN
                result := json_build_object(
                    'allowed', false,
                    'reason', format('Maximum reservations reached (%s/%s)', 
                        settings_record.current_reservations, 
                        settings_record.max_reservations),
                    'settings_id', settings_record.id,
                    'control_type', settings_record.control_type,
                    'current_reservations', settings_record.current_reservations,
                    'max_reservations', settings_record.max_reservations
                );
            ELSE
                result := json_build_object(
                    'allowed', true,
                    'reason', format('Within limit (%s/%s)', 
                        settings_record.current_reservations, 
                        settings_record.max_reservations),
                    'settings_id', settings_record.id,
                    'control_type', settings_record.control_type,
                    'current_reservations', settings_record.current_reservations,
                    'max_reservations', settings_record.max_reservations
                );
            END IF;
        WHEN 'unlimited' THEN
            result := json_build_object(
                'allowed', true,
                'reason', 'Unlimited reservations allowed',
                'settings_id', settings_record.id,
                'control_type', settings_record.control_type,
                'current_reservations', settings_record.current_reservations
            );
        ELSE
            result := json_build_object(
                'allowed', true,
                'reason', 'Unknown control type, defaulting to allowed',
                'settings_id', settings_record.id,
                'control_type', settings_record.control_type
            );
    END CASE;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour incrémenter le compteur de réservations
CREATE OR REPLACE FUNCTION increment_reservation_count(property_uuid UUID)
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
    
    -- Incrémenter le compteur
    UPDATE token_control_settings
    SET current_reservations = current_reservations + 1,
        updated_at = NOW()
    WHERE property_id = property_uuid
    AND is_enabled = true;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires sur la table
COMMENT ON TABLE token_control_settings IS 'Paramètres de contrôle des tokens de réservation par propriété';
COMMENT ON COLUMN token_control_settings.property_id IS 'ID de la propriété concernée';
COMMENT ON COLUMN token_control_settings.is_enabled IS 'Si le contrôle est activé';
COMMENT ON COLUMN token_control_settings.max_reservations IS 'Nombre maximum de réservations (NULL = illimité)';
COMMENT ON COLUMN token_control_settings.current_reservations IS 'Nombre actuel de réservations';
COMMENT ON COLUMN token_control_settings.control_type IS 'Type de contrôle: blocked, limited, unlimited';
COMMENT ON COLUMN token_control_settings.created_by IS 'Utilisateur qui a créé ces paramètres';

-- Données de test (optionnel)
-- INSERT INTO token_control_settings (property_id, control_type, max_reservations, created_by)
-- SELECT id, 'unlimited', NULL, (SELECT id FROM auth.users LIMIT 1)
-- FROM properties
-- WHERE NOT EXISTS (
--     SELECT 1 FROM token_control_settings WHERE property_id = properties.id
-- );
