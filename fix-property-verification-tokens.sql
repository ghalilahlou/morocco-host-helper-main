-- ========================================
-- CORRECTION DE LA TABLE property_verification_tokens
-- ========================================

-- 1. Vérifier la structure actuelle
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'property_verification_tokens' 
ORDER BY ordinal_position;

-- 2. Ajouter la colonne expires_at si elle n'existe pas
ALTER TABLE public.property_verification_tokens 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 3. Ajouter la colonne updated_at si elle n'existe pas
ALTER TABLE public.property_verification_tokens 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Vérifier la structure après modification
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'property_verification_tokens' 
ORDER BY ordinal_position;

-- 5. Mettre à jour les tokens existants sans expires_at
UPDATE public.property_verification_tokens 
SET expires_at = created_at + INTERVAL '7 days'
WHERE expires_at IS NULL;

-- 6. Créer un trigger pour updated_at si nécessaire
CREATE OR REPLACE FUNCTION public.update_property_verification_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger existant s'il existe
DROP TRIGGER IF EXISTS trigger_update_property_verification_tokens_updated_at ON public.property_verification_tokens;

-- Créer le trigger
CREATE TRIGGER trigger_update_property_verification_tokens_updated_at
    BEFORE UPDATE ON public.property_verification_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_property_verification_tokens_updated_at();

-- 7. Vérifier les données
SELECT 
    id,
    property_id,
    token,
    is_active,
    expires_at,
    created_at,
    updated_at
FROM public.property_verification_tokens
ORDER BY created_at DESC
LIMIT 5;
