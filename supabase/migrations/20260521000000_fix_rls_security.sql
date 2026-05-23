-- ============================================================
-- MIGRATION CORRECTIVE : Sécurité multi-hôte
-- Problèmes détectés par l'audit du 2026-05-21
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. NETTOYAGE DES DONNÉES AVANT ACTIVATION RLS
--    (doit tourner en premier pour éviter les blocages)
-- ─────────────────────────────────────────────────────────────

-- Supprimer les propriétés "test" sans owner (user_id = null)
-- CASCADE supprime leurs bookings, tokens et submissions associés
DELETE FROM properties WHERE user_id IS NULL;

-- Normaliser booking.user_id pour qu'il corresponde au propriétaire
-- de la propriété (corrige les 10 incohérences détectées)
UPDATE bookings b
SET user_id = p.user_id
FROM properties p
WHERE b.property_id = p.id
  AND b.user_id IS NOT NULL
  AND b.user_id != p.user_id;

-- Mettre user_id sur les bookings qui n'en ont pas (cohérence)
UPDATE bookings b
SET user_id = p.user_id
FROM properties p
WHERE b.property_id = p.id
  AND b.user_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 1. SUPPRIMER LES TABLES BACKUP NON PROTÉGÉES
--    Données brutes accessibles sans RLS — inutiles hors dev.
-- ─────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS bookings_backup_20250127;
DROP TABLE IF EXISTS guest_submissions_backup_20250127;

-- ─────────────────────────────────────────────────────────────
-- 2. ACTIVER RLS SUR LES TABLES CRITIQUES
--    Les policies existent déjà — il suffit d'activer RLS
--    pour qu'elles soient appliquées.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE bookings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties        ENABLE ROW LEVEL SECURITY;

-- generated_documents : RLS OFF + 0 policy, table active (91 rows)
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generated_documents_owner"
  ON generated_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE b.id = generated_documents.booking_id
        AND p.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. TABLES AVEC RLS ON MAIS ZÉRO POLICY
--    (actuellement inaccessibles aux utilisateurs)
-- ─────────────────────────────────────────────────────────────

-- airbnb_sync_status : visible uniquement par le propriétaire de la propriété
CREATE POLICY "airbnb_sync_status_owner"
  ON airbnb_sync_status
  FOR ALL
  TO authenticated
  USING (
    property_id IN (
      SELECT id FROM properties WHERE user_id = auth.uid()
    )
  );

-- generated_documents_archive : accès hôte propriétaire
CREATE POLICY "gen_docs_archive_owner"
  ON generated_documents_archive
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE b.id = generated_documents_archive.booking_id
        AND p.user_id = auth.uid()
    )
  );

-- guest_verification_tokens : table legacy — accès hôte propriétaire
CREATE POLICY "guest_verification_tokens_owner"
  ON guest_verification_tokens
  FOR ALL
  TO authenticated
  USING (
    property_id IN (
      SELECT id FROM properties WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. NETTOYAGE DES TOKENS INACTIFS ANCIENS
--    130 297 tokens sans expiry dont ~129 614 inactifs.
--    Suppression des tokens inactifs de plus de 90 jours.
-- ─────────────────────────────────────────────────────────────

DELETE FROM property_verification_tokens
WHERE is_active = FALSE
  AND created_at < NOW() - INTERVAL '90 days';

-- ─────────────────────────────────────────────────────────────
-- 5. INDEX MANQUANTS (performances RLS)
--    guests : 8 481 seq_scans vs 12 idx_scans → critique
--    admin_users : 848 seq_scans → is_admin_user() lent
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_guests_booking_property
  ON guests (booking_id)
  INCLUDE (full_name, nationality, document_number);

CREATE INDEX IF NOT EXISTS idx_admin_users_uid_active
  ON admin_users (user_id)
  WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────
-- 6. CONTRAINTE : empêcher les tokens de dépasser max_uses
-- ─────────────────────────────────────────────────────────────

ALTER TABLE property_verification_tokens
  ADD CONSTRAINT pvt_used_count_lte_max_uses
  CHECK (max_uses IS NULL OR used_count <= max_uses);

-- ─────────────────────────────────────────────────────────────
-- 7. ARCHIVER LES CONFLITS DE RÉSERVATIONS (5 détectés)
--    On archive le doublon le plus récent dans chaque paire.
-- ─────────────────────────────────────────────────────────────

UPDATE bookings
SET status = 'archived'
WHERE id IN (
  'baf16a50-e157-4656-b7b6-ec263ece1f28',  -- property 6e43448b 25/08/2025 (doublon)
  'ed427c2e-d2e7-4018-bc7e-4d1d7ef506d9',  -- property a0ae5d83 12/08/2026 (doublon)
  '5fd9b5f2-14b4-4f31-a5ae-cda4ced2e63e',  -- property aa21a090 20/08/2025 (doublon)
  'bd172f94-54ba-483b-9e26-3ff618c16e31',  -- property b0e13eb1 09/08/2025 (doublon)
  '46aabcbc-a7a6-4555-bb61-7b1813bfb983'   -- property e0fb38d6 19/11/2025 (identique)
);
