-- =====================================================
-- CRÉATION DES TABLES ADMIN MANQUANTES
-- =====================================================

-- 1. CRÉATION DE LA TABLE admin_users
-- =====================================================
SELECT '1. CRÉATION DE LA TABLE admin_users' as section;

CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'super_admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id)
);

-- 2. CRÉATION DE LA TABLE token_allocations
-- =====================================================
SELECT '2. CRÉATION DE LA TABLE token_allocations' as section;

CREATE TABLE IF NOT EXISTS public.token_allocations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tokens_allocated INTEGER NOT NULL DEFAULT 0,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    tokens_remaining INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_by UUID REFERENCES auth.users(id),
    notes TEXT,
    UNIQUE(user_id)
);

-- 3. CRÉATION DE LA TABLE admin_activity_logs
-- =====================================================
SELECT '3. CRÉATION DE LA TABLE admin_activity_logs' as section;

CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    action_details JSONB,
    target_user_id UUID REFERENCES auth.users(id),
    target_property_id UUID,
    target_booking_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CRÉATION DE LA TABLE admin_statistics
-- =====================================================
SELECT '4. CRÉATION DE LA TABLE admin_statistics' as section;

CREATE TABLE IF NOT EXISTS public.admin_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stat_date DATE NOT NULL,
    stat_type TEXT NOT NULL,
    stat_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stat_date, stat_type)
);

-- 5. CRÉATION DES INDEX
-- =====================================================
SELECT '5. CRÉATION DES INDEX' as section;

-- Index pour admin_users
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON public.admin_users(is_active);

-- Index pour token_allocations
CREATE INDEX IF NOT EXISTS idx_token_allocations_user_id ON public.token_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_token_allocations_is_active ON public.token_allocations(is_active);

-- Index pour admin_activity_logs
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_user_id ON public.admin_activity_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action_type ON public.admin_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at ON public.admin_activity_logs(created_at);

-- Index pour admin_statistics
CREATE INDEX IF NOT EXISTS idx_admin_statistics_stat_date ON public.admin_statistics(stat_date);
CREATE INDEX IF NOT EXISTS idx_admin_statistics_stat_type ON public.admin_statistics(stat_type);

-- 6. CRÉATION DES TRIGGERS POUR updated_at
-- =====================================================
SELECT '6. CRÉATION DES TRIGGERS' as section;

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour admin_users
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour token_allocations
DROP TRIGGER IF EXISTS update_token_allocations_updated_at ON public.token_allocations;
CREATE TRIGGER update_token_allocations_updated_at
    BEFORE UPDATE ON public.token_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour admin_statistics
DROP TRIGGER IF EXISTS update_admin_statistics_updated_at ON public.admin_statistics;
CREATE TRIGGER update_admin_statistics_updated_at
    BEFORE UPDATE ON public.admin_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. TRIGGER POUR CALCULER tokens_remaining
-- =====================================================
SELECT '7. TRIGGER POUR TOKENS' as section;

-- Fonction pour calculer tokens_remaining
CREATE OR REPLACE FUNCTION calculate_tokens_remaining()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tokens_remaining = NEW.tokens_allocated - NEW.tokens_used;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour token_allocations
DROP TRIGGER IF EXISTS calculate_tokens_remaining_trigger ON public.token_allocations;
CREATE TRIGGER calculate_tokens_remaining_trigger
    BEFORE INSERT OR UPDATE ON public.token_allocations
    FOR EACH ROW
    EXECUTE FUNCTION calculate_tokens_remaining();

-- 8. VÉRIFICATION FINALE
-- =====================================================
SELECT '8. VÉRIFICATION FINALE' as section;

-- Vérifier que les tables ont été créées
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE tablename IN ('admin_users', 'token_allocations', 'admin_activity_logs', 'admin_statistics')
ORDER BY tablename;

-- Vérifier les contraintes
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name IN ('admin_users', 'token_allocations', 'admin_activity_logs', 'admin_statistics')
ORDER BY tc.table_name, tc.constraint_type;

