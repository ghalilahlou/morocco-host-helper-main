-- 🔧 Correction des Problèmes de Base de Données - Signature Électronique
-- Exécutez ces requêtes dans l'éditeur SQL de Supabase pour corriger les problèmes

-- 1. Vérifier et corriger la structure de la table contract_signatures
-- Si la table n'existe pas ou a une structure incorrecte, la recréer

-- Supprimer la table si elle existe (ATTENTION: cela supprime toutes les données)
-- DROP TABLE IF EXISTS contract_signatures CASCADE;

-- Recréer la table avec la bonne structure
CREATE TABLE IF NOT EXISTS contract_signatures (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL,
    signature_data text NOT NULL,
    contract_content text NOT NULL,
    signed_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT contract_signatures_pkey PRIMARY KEY (id)
);

-- 2. Ajouter la contrainte de clé étrangère si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'contract_signatures_booking_id_fkey' 
        AND table_name = 'contract_signatures'
    ) THEN
        ALTER TABLE contract_signatures 
        ADD CONSTRAINT contract_signatures_booking_id_fkey 
        FOREIGN KEY (booking_id) REFERENCES bookings(id);
    END IF;
END $$;

-- 3. Créer un index sur booking_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_contract_signatures_booking_id 
ON contract_signatures(booking_id);

-- 4. Créer un index sur signed_at pour les requêtes temporelles
CREATE INDEX IF NOT EXISTS idx_contract_signatures_signed_at 
ON contract_signatures(signed_at);

-- 5. Configurer RLS (Row Level Security) si nécessaire
ALTER TABLE contract_signatures ENABLE ROW LEVEL SECURITY;

-- 6. Créer une politique RLS pour permettre l'insertion depuis les Edge Functions
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON contract_signatures;
CREATE POLICY "Enable insert for authenticated users" ON contract_signatures
    FOR INSERT WITH CHECK (true);

-- 7. Créer une politique RLS pour permettre la lecture
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON contract_signatures;
CREATE POLICY "Enable read access for authenticated users" ON contract_signatures
    FOR SELECT USING (true);

-- 8. Créer une politique RLS pour permettre la mise à jour
DROP POLICY IF EXISTS "Enable update for authenticated users" ON contract_signatures;
CREATE POLICY "Enable update for authenticated users" ON contract_signatures
    FOR UPDATE USING (true);

-- 9. Vérifier et corriger les permissions
GRANT ALL ON contract_signatures TO authenticated;
GRANT ALL ON contract_signatures TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- 10. Créer une fonction pour nettoyer les signatures orphelines
CREATE OR REPLACE FUNCTION cleanup_orphaned_signatures()
RETURNS void AS $$
BEGIN
    DELETE FROM contract_signatures 
    WHERE booking_id NOT IN (SELECT id FROM bookings);
END;
$$ LANGUAGE plpgsql;

-- 11. Créer un trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_contract_signatures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_contract_signatures_updated_at ON contract_signatures;
CREATE TRIGGER trigger_update_contract_signatures_updated_at
    BEFORE UPDATE ON contract_signatures
    FOR EACH ROW
    EXECUTE FUNCTION update_contract_signatures_updated_at();

-- 12. Vérifier la séquence pour l'ID (si nécessaire)
-- Cette requête vérifie si la séquence existe et fonctionne correctement
SELECT 
    sequence_name,
    last_value,
    start_value,
    increment_by
FROM information_schema.sequences 
WHERE sequence_name LIKE '%contract_signatures%';

-- 13. Nettoyer les données corrompues (optionnel)
-- Supprimer les signatures avec des données vides ou corrompues
DELETE FROM contract_signatures 
WHERE signature_data IS NULL 
   OR signature_data = '' 
   OR contract_content IS NULL 
   OR contract_content = '';

-- 14. Vérifier l'intégrité des données
SELECT 
    COUNT(*) as total_signatures,
    COUNT(CASE WHEN signature_data IS NOT NULL AND signature_data != '' THEN 1 END) as valid_signatures,
    COUNT(CASE WHEN contract_content IS NOT NULL AND contract_content != '' THEN 1 END) as valid_contracts,
    COUNT(CASE WHEN booking_id IN (SELECT id FROM bookings) THEN 1 END) as valid_bookings
FROM contract_signatures;

-- 15. Créer une vue pour faciliter les requêtes
CREATE OR REPLACE VIEW contract_signatures_with_booking_info AS
SELECT 
    cs.id,
    cs.booking_id,
    cs.signature_data,
    cs.contract_content,
    cs.signed_at,
    cs.created_at,
    cs.updated_at,
    b.check_in_date,
    b.check_out_date,
    b.number_of_guests,
    b.status as booking_status,
    p.name as property_name
FROM contract_signatures cs
LEFT JOIN bookings b ON cs.booking_id = b.id
LEFT JOIN properties p ON b.property_id = p.id;

-- 16. Vérifier que tout fonctionne avec un test d'insertion
-- Cette requête va échouer si il n'y a pas de booking valide, mais c'est normal
-- INSERT INTO contract_signatures (booking_id, signature_data, contract_content)
-- SELECT 
--     b.id,
--     'test_signature_data',
--     'test_contract_content'
-- FROM bookings b
-- LIMIT 1;

-- 17. Afficher un résumé des corrections
SELECT 
    'Database fixes applied successfully' as status,
    now() as applied_at;
