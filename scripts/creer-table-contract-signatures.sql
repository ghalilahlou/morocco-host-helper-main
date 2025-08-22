-- Créer la table contract_signatures si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signer_phone TEXT,
  signature_data TEXT NOT NULL,
  contract_content TEXT NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer RLS
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS
CREATE POLICY "Users can view signatures for their bookings" 
ON public.contract_signatures 
FOR SELECT 
USING (
  booking_id IN (
    SELECT id FROM public.bookings 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create signatures for their bookings" 
ON public.contract_signatures 
FOR INSERT 
WITH CHECK (
  booking_id IN (
    SELECT id FROM public.bookings 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update signatures for their bookings" 
ON public.contract_signatures 
FOR UPDATE 
USING (
  booking_id IN (
    SELECT id FROM public.bookings 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

-- Créer un index sur booking_id pour les performances
CREATE INDEX IF NOT EXISTS idx_contract_signatures_booking_id 
ON public.contract_signatures(booking_id);

-- Créer un index sur signed_at pour les requêtes temporelles
CREATE INDEX IF NOT EXISTS idx_contract_signatures_signed_at 
ON public.contract_signatures(signed_at);

-- Vérifier que la table a été créée correctement
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contract_signatures'
ORDER BY ordinal_position;
