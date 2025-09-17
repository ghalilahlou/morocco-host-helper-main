-- Création des tables manquantes pour la fonction submit-guest-info

-- Table submissions pour enregistrer les soumissions
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table guest_documents pour enregistrer les documents des invités
CREATE TABLE IF NOT EXISTS public.guest_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  document_url TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'identity',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ajouter les contraintes de clé étrangère
ALTER TABLE public.submissions 
ADD CONSTRAINT IF NOT EXISTS fk_submissions_booking_id 
FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

ALTER TABLE public.guest_documents 
ADD CONSTRAINT IF NOT EXISTS fk_guest_documents_booking_id 
FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

-- Activer RLS sur les nouvelles tables
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_documents ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour submissions
CREATE POLICY IF NOT EXISTS "Users can view submissions for their properties" 
ON public.submissions 
FOR SELECT 
USING (booking_id IN (
  SELECT b.id FROM public.bookings b
  JOIN public.properties p ON p.id = b.property_id
  WHERE p.user_id = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Anyone can create submissions" 
ON public.submissions 
FOR INSERT 
WITH CHECK (true);

-- Politiques RLS pour guest_documents
CREATE POLICY IF NOT EXISTS "Users can view documents for their properties" 
ON public.guest_documents 
FOR SELECT 
USING (booking_id IN (
  SELECT b.id FROM public.bookings b
  JOIN public.properties p ON p.id = b.property_id
  WHERE p.user_id = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Anyone can create documents" 
ON public.guest_documents 
FOR INSERT 
WITH CHECK (true);

-- Ajouter les triggers pour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_submissions_updated_at
BEFORE UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_guest_documents_updated_at
BEFORE UPDATE ON public.guest_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ajouter des index pour les performances
CREATE INDEX IF NOT EXISTS idx_submissions_booking_id ON public.submissions(booking_id);
CREATE INDEX IF NOT EXISTS idx_guest_documents_booking_id ON public.guest_documents(booking_id);

-- Vérification finale
SELECT 
  'Tables créées avec succès' as status,
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'submissions') as submissions_exists,
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'guest_documents') as guest_documents_exists;
