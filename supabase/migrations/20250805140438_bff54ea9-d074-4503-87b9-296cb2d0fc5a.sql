-- Ajouter la colonne document_type manquante à la table uploaded_documents
ALTER TABLE public.uploaded_documents 
ADD COLUMN IF NOT EXISTS document_type text;

-- Ajouter un index pour améliorer les performances sur cette colonne
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_document_type 
ON public.uploaded_documents(document_type);