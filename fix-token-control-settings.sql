-- Script pour corriger la structure de la table token_control_settings
-- et établir la relation avec la table properties

-- 1. Vérifier si la table token_control_settings existe
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'token_control_settings' 
ORDER BY ordinal_position;

-- 2. Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.token_control_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID NOT NULL,
    control_type TEXT NOT NULL DEFAULT 'unlimited' CHECK (control_type IN ('unlimited', 'limited', 'blocked')),
    max_reservations INTEGER,
    current_reservations INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contrainte de clé étrangère vers properties
    CONSTRAINT fk_token_control_settings_property_id 
        FOREIGN KEY (property_id) 
        REFERENCES public.properties(id) 
        ON DELETE CASCADE
);

-- 3. Créer un index unique sur property_id pour éviter les doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_control_settings_property_id 
ON public.token_control_settings(property_id);

-- 4. Créer un index sur control_type pour les requêtes
CREATE INDEX IF NOT EXISTS idx_token_control_settings_control_type 
ON public.token_control_settings(control_type);

-- 5. Activer RLS (Row Level Security)
ALTER TABLE public.token_control_settings ENABLE ROW LEVEL SECURITY;

-- 6. Créer les politiques RLS
-- Politique pour les utilisateurs authentifiés (lecture)
CREATE POLICY "Users can view token control settings"
ON public.token_control_settings
FOR SELECT
TO authenticated
USING (true);

-- Politique pour les utilisateurs authentifiés (insertion)
CREATE POLICY "Users can insert token control settings"
ON public.token_control_settings
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Politique pour les utilisateurs authentifiés (mise à jour)
CREATE POLICY "Users can update token control settings"
ON public.token_control_settings
FOR UPDATE
TO authenticated
USING (true);

-- Politique pour les utilisateurs authentifiés (suppression)
CREATE POLICY "Users can delete token control settings"
ON public.token_control_settings
FOR DELETE
TO authenticated
USING (true);

-- 7. Créer une fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_token_control_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Créer le trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_update_token_control_settings_updated_at ON public.token_control_settings;
CREATE TRIGGER trigger_update_token_control_settings_updated_at
    BEFORE UPDATE ON public.token_control_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_token_control_settings_updated_at();

-- 9. Vérifier la structure finale
SELECT 
    tc.table_name,
    tc.column_name,
    tc.data_type,
    tc.is_nullable,
    tc.column_default,
    kcu.constraint_name,
    tc.ordinal_position
FROM information_schema.columns tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.table_name = kcu.table_name 
    AND tc.column_name = kcu.column_name
WHERE tc.table_name = 'token_control_settings'
ORDER BY tc.ordinal_position;

-- 10. Vérifier les contraintes de clé étrangère
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'token_control_settings';

-- 11. Insérer des données de test si la table est vide
INSERT INTO public.token_control_settings (property_id, control_type, max_reservations, is_enabled)
SELECT 
    p.id,
    'unlimited',
    NULL,
    true
FROM public.properties p
WHERE NOT EXISTS (
    SELECT 1 FROM public.token_control_settings tcs 
    WHERE tcs.property_id = p.id
)
LIMIT 5;

-- 12. Afficher les données finales
SELECT 
    tcs.*,
    p.name as property_name,
    p.address as property_address
FROM public.token_control_settings tcs
LEFT JOIN public.properties p ON tcs.property_id = p.id
ORDER BY tcs.created_at DESC;
