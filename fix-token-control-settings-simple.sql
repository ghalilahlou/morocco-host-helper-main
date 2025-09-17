-- ========================================
-- SCRIPT SIMPLIFIÉ POUR CRÉER token_control_settings
-- ========================================

-- 1. Créer la table token_control_settings
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

-- 2. Créer les index
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_control_settings_property_id 
ON public.token_control_settings(property_id);

CREATE INDEX IF NOT EXISTS idx_token_control_settings_control_type 
ON public.token_control_settings(control_type);

-- 3. Activer RLS
ALTER TABLE public.token_control_settings ENABLE ROW LEVEL SECURITY;

-- 4. Créer les politiques RLS (supprimer d'abord si elles existent)
DROP POLICY IF EXISTS "Users can view token control settings" ON public.token_control_settings;
CREATE POLICY "Users can view token control settings" 
ON public.token_control_settings 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Users can insert token control settings" ON public.token_control_settings;
CREATE POLICY "Users can insert token control settings" 
ON public.token_control_settings 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update token control settings" ON public.token_control_settings;
CREATE POLICY "Users can update token control settings" 
ON public.token_control_settings 
FOR UPDATE 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Users can delete token control settings" ON public.token_control_settings;
CREATE POLICY "Users can delete token control settings" 
ON public.token_control_settings 
FOR DELETE 
TO authenticated 
USING (true);

-- 5. Créer la fonction pour updated_at
CREATE OR REPLACE FUNCTION public.update_token_control_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Créer le trigger
DROP TRIGGER IF EXISTS trigger_update_token_control_settings_updated_at ON public.token_control_settings;
CREATE TRIGGER trigger_update_token_control_settings_updated_at
    BEFORE UPDATE ON public.token_control_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_token_control_settings_updated_at();

-- 7. Insérer des données de test pour les propriétés existantes
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

-- 8. Vérifier la création
SELECT 'Table créée avec succès' as status;
SELECT COUNT(*) as nombre_parametres FROM public.token_control_settings;
