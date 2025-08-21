-- Step 5: Create and harden host_profiles table with RLS
-- Create host_profiles table for user profile data
CREATE TABLE public.host_profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.host_profiles ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for host owners
CREATE POLICY "Host can view own profile" ON public.host_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Host can insert own profile" ON public.host_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Host can update own profile" ON public.host_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_host_profiles_updated_at
  BEFORE UPDATE ON public.host_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Note: Service role key automatically bypasses RLS by default
-- Edge functions using SUPABASE_SERVICE_ROLE_KEY will have full access