-- =====================================
-- MIGRATION : ALIGNER BASE DE DONNÉES AVEC APPLICATION
-- Morocco Host Helper Platform
-- =====================================

-- PROBLÈME 1 : Application attend 'profiles' mais utilise 'auth.users'
-- PROBLÈME 2 : AdminContext charge depuis 'profiles' inexistante  
-- PROBLÈME 3 : Types application vs colonnes DB incohérents
-- PROBLÈME 4 : Colonnes manquantes pour analytics

-- ===========================================
-- 1. CRÉER TABLE PROFILES (pour cohérence app)
-- ===========================================
-- L'application AdminContext charge depuis 'profiles'
-- Créons cette table et la synchronisons avec auth.users

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Politique RLS : utilisateurs peuvent voir/modifier leur profil
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- ===========================================
-- 2. SYNCHRONISER PROFILES AVEC AUTH.USERS
-- ===========================================
-- Fonction pour synchroniser automatiquement
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour créer profil automatiquement
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Migrer utilisateurs existants vers profiles
INSERT INTO public.profiles (id, email, full_name, created_at)
SELECT 
  id, 
  email,
  COALESCE(raw_user_meta_data->>'full_name', email) as full_name,
  created_at
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id);

-- ===========================================
-- 3. AJOUTER COLONNES MANQUANTES AUX TABLES
-- ===========================================

-- BOOKINGS : Ajouter total_amount pour revenue calculation
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0;

-- BOOKINGS : Ajouter source pour différencier origine
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'host' CHECK (source IN ('host', 'guest', 'airbnb'));

-- PROPERTIES : Ajouter colonnes analytics manquantes
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS total_bookings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_booking_date TIMESTAMP WITH TIME ZONE;

-- ===========================================
-- 4. TABLE ANALYTICS POUR DASHBOARD
-- ===========================================
CREATE TABLE IF NOT EXISTS public.analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  new_users INTEGER DEFAULT 0,
  new_bookings INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  cancelled_bookings INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_analytics_date ON public.analytics_daily(date);

-- ===========================================
-- 5. FONCTION CALCUL STATISTIQUES TEMPS RÉEL
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalUsers', (SELECT count(*) FROM auth.users),
    'totalProperties', (SELECT count(*) FROM properties),
    'totalBookings', (SELECT count(*) FROM bookings),
    'totalRevenue', (SELECT COALESCE(sum(total_amount), 0) FROM bookings),
    'activeProperties', (SELECT count(*) FROM properties WHERE user_id IS NOT NULL),
    'pendingBookings', (SELECT count(*) FROM bookings WHERE status = 'pending'),
    'completedBookings', (SELECT count(*) FROM bookings WHERE status = 'completed')
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 6. TRIGGERS POUR MAINTENIR COHÉRENCE
-- ===========================================

-- Trigger pour mettre à jour les statistiques des propriétés
CREATE OR REPLACE FUNCTION public.update_property_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour les stats de la propriété
  UPDATE properties 
  SET 
    total_bookings = (
      SELECT count(*) FROM bookings 
      WHERE property_id = COALESCE(NEW.property_id, OLD.property_id)
    ),
    total_revenue = (
      SELECT COALESCE(sum(total_amount), 0) FROM bookings 
      WHERE property_id = COALESCE(NEW.property_id, OLD.property_id)
    ),
    last_booking_date = (
      SELECT max(created_at) FROM bookings 
      WHERE property_id = COALESCE(NEW.property_id, OLD.property_id)
    )
  WHERE id = COALESCE(NEW.property_id, OLD.property_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger
DROP TRIGGER IF EXISTS update_property_stats_trigger ON bookings;
CREATE TRIGGER update_property_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_property_stats();

-- ===========================================
-- 7. VUES POUR SIMPLIFIER LES REQUÊTES APP
-- ===========================================

-- Vue : Utilisateurs enrichis pour AdminUsers component
CREATE OR REPLACE VIEW public.users_enriched AS
SELECT 
  au.id,
  au.email,
  p.full_name,
  au.created_at,
  au.last_sign_in_at as last_login,
  au.email_confirmed_at IS NOT NULL as is_active,
  COALESCE(adm.role, 'user') as role,
  COALESCE(prop_stats.properties_count, 0) as properties_count,
  COALESCE(prop_stats.properties_count, 0) > 0 as is_property_owner,
  prop_stats.last_booking_date,
  COALESCE(prop_stats.total_bookings, 0) as total_bookings
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
LEFT JOIN public.admin_users adm ON adm.user_id = au.id
LEFT JOIN (
  SELECT 
    pr.user_id,
    count(pr.id) as properties_count,
    sum(pr.total_bookings) as total_bookings,
    max(pr.last_booking_date) as last_booking_date
  FROM properties pr
  GROUP BY pr.user_id
) prop_stats ON prop_stats.user_id = au.id;

-- Vue : Réservations avec détails propriété
CREATE OR REPLACE VIEW public.bookings_detailed AS
SELECT 
  b.*,
  p.name as property_name,
  p.user_id as property_owner_id,
  au.email as property_owner_email
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
LEFT JOIN auth.users au ON au.id = p.user_id;

-- ===========================================
-- 8. POLITIQUES RLS POUR NOUVELLES TABLES
-- ===========================================

-- Analytics : seulement admins
ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can access analytics" 
ON public.analytics_daily 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
);

-- ===========================================
-- 9. FONCTION DE VÉRIFICATION FINALE
-- ===========================================
CREATE OR REPLACE FUNCTION public.verify_app_db_alignment()
RETURNS TABLE(
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'profiles_table'::TEXT,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') 
         THEN '✅ OK' ELSE '❌ MANQUANT' END,
    'Table profiles pour cohérence AdminContext'::TEXT
  UNION ALL
  SELECT 
    'profiles_data'::TEXT,
    CASE WHEN (SELECT count(*) FROM profiles) > 0 
         THEN '✅ OK (' || (SELECT count(*) FROM profiles) || ' profils)'
         ELSE '⚠️ VIDE' END,
    'Données synchronisées avec auth.users'::TEXT
  UNION ALL
  SELECT 
    'bookings_total_amount'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'total_amount'
    ) THEN '✅ OK' ELSE '❌ MANQUANT' END,
    'Colonne pour calcul revenue'::TEXT
  UNION ALL
  SELECT 
    'dashboard_function'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'get_dashboard_stats'
    ) THEN '✅ OK' ELSE '❌ MANQUANT' END,
    'Fonction stats temps réel'::TEXT
  UNION ALL
  SELECT 
    'users_enriched_view'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.views 
      WHERE table_name = 'users_enriched'
    ) THEN '✅ OK' ELSE '❌ MANQUANT' END,
    'Vue pour AdminUsers component'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 10. NETTOYER LES DONNÉES INCOHÉRENTES
-- ===========================================

-- Supprimer propriétés orphelines
DELETE FROM properties 
WHERE user_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id);

-- Supprimer bookings orphelins
DELETE FROM bookings 
WHERE property_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM properties WHERE id = property_id);

-- Mettre à jour les stats initiales
SELECT public.update_property_stats() FROM bookings LIMIT 1;

-- ===========================================
-- RÉSUMÉ : EXÉCUTER LA VÉRIFICATION
-- ===========================================
SELECT * FROM public.verify_app_db_alignment();
