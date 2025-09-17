-- Correction du schéma de la table property_verification_tokens
-- Supprime la colonne expires_at qui n'existe pas et cause des erreurs

-- Vérifier d'abord si la colonne existe
DO $$ 
BEGIN
    -- Supprimer la colonne expires_at si elle existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'property_verification_tokens' 
        AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE public.property_verification_tokens DROP COLUMN expires_at;
        RAISE NOTICE 'Colonne expires_at supprimée';
    ELSE
        RAISE NOTICE 'Colonne expires_at n''existe pas, aucune action nécessaire';
    END IF;
END $$;

-- Nettoyer les tokens en double - garder seulement le plus récent pour chaque propriété
WITH ranked_tokens AS (
  SELECT 
    id,
    property_id,
    token,
    is_active,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY created_at DESC) as rn
  FROM public.property_verification_tokens
)
DELETE FROM public.property_verification_tokens 
WHERE id IN (
  SELECT id 
  FROM ranked_tokens 
  WHERE rn > 1
);

-- Afficher le résumé des tokens restants
SELECT 
  'Tokens après nettoyage' as description,
  COUNT(*) as total_tokens,
  COUNT(DISTINCT property_id) as unique_properties
FROM public.property_verification_tokens
WHERE is_active = true;
