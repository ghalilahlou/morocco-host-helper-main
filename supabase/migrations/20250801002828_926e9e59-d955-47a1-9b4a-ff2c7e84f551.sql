-- Add user ownership to properties table
ALTER TABLE public.properties 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add additional fields for property management
ALTER TABLE public.properties 
ADD COLUMN property_type TEXT DEFAULT 'apartment',
ADD COLUMN max_occupancy INTEGER DEFAULT 4,
ADD COLUMN description TEXT,
ADD COLUMN house_rules JSONB DEFAULT '[]'::jsonb,
ADD COLUMN contract_template JSONB DEFAULT '{}'::jsonb;

-- Update RLS policies for properties to be user-specific
DROP POLICY IF EXISTS "Allow all operations on properties" ON public.properties;

-- Create user-specific RLS policies for properties
CREATE POLICY "Users can view their own properties" 
ON public.properties 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own properties" 
ON public.properties 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own properties" 
ON public.properties 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own properties" 
ON public.properties 
FOR DELETE 
USING (auth.uid() = user_id);