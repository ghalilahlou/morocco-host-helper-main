-- Corriger les politiques RLS pour permettre l'accès aux réservations Airbnb

-- 1. Désactiver temporairement RLS sur airbnb_reservations
ALTER TABLE airbnb_reservations DISABLE ROW LEVEL SECURITY;

-- 2. Créer une politique permissive pour les réservations
ALTER TABLE airbnb_reservations ENABLE ROW LEVEL SECURITY;

-- 3. Politique pour permettre la lecture des réservations à tous les utilisateurs authentifiés
CREATE POLICY "Allow read access to airbnb_reservations" ON airbnb_reservations
    FOR SELECT USING (true);

-- 4. Politique pour permettre l'insertion par les fonctions
CREATE POLICY "Allow insert access to airbnb_reservations" ON airbnb_reservations
    FOR INSERT WITH CHECK (true);

-- 5. Politique pour permettre la mise à jour par les fonctions
CREATE POLICY "Allow update access to airbnb_reservations" ON airbnb_reservations
    FOR UPDATE USING (true);

-- 6. Politique pour permettre la suppression par les fonctions
CREATE POLICY "Allow delete access to airbnb_reservations" ON airbnb_reservations
    FOR DELETE USING (true);

-- 7. Vérifier que les données sont maintenant visibles
SELECT COUNT(*) as total_reservations FROM airbnb_reservations;
