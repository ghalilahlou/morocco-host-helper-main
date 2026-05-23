-- S4 : Déduplication des contrats par hash de contenu (PDF bytes SHA-256)
-- Empêche la création de 3-15 versions identiques par réservation.
-- À appliquer avec : supabase db push

-- 1. Ajouter la colonne content_hash
ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 2. Index pour la recherche rapide (éviter les doublons sans full-scan)
CREATE INDEX IF NOT EXISTS idx_generated_documents_content_hash
  ON public.generated_documents(booking_id, content_hash)
  WHERE content_hash IS NOT NULL;

-- 3. Commentaire documentant l'invariant
COMMENT ON COLUMN public.generated_documents.content_hash IS
  'SHA-256 (hex) des bytes PDF avant upload. NULL pour les documents antérieurs à cette migration.
   Utilisé par saveDocumentToDatabase() pour détecter les doublons de contenu (même PDF, URL différente).';
