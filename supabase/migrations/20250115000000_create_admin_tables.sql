-- Migration pour créer les tables administrateur
-- Date: 2025-01-15

-- 1. Table des utilisateurs administrateurs
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true
);

-- 2. Table des allocations de tokens
CREATE TABLE IF NOT EXISTS public.token_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_allocated INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  tokens_remaining INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  allocated_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- 3. Table des logs d'activité administrateur
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Table des statistiques administrateur
CREATE TABLE IF NOT EXISTS public.admin_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_users INTEGER DEFAULT 0,
  total_properties INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  active_tokens INTEGER DEFAULT 0,
  pending_bookings INTEGER DEFAULT 0,
  completed_bookings INTEGER DEFAULT 0,
  cancelled_bookings INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);
CREATE INDEX IF NOT EXISTS idx_token_allocations_user_id ON public.token_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_token_allocations_active ON public.token_allocations(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_user_id ON public.admin_activity_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at ON public.admin_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_statistics_date ON public.admin_statistics(date);

-- Fonction pour mettre à jour les tokens restants
CREATE OR REPLACE FUNCTION update_tokens_remaining()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tokens_remaining = NEW.tokens_allocated - NEW.tokens_used;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement les tokens restants
CREATE TRIGGER trigger_update_tokens_remaining
  BEFORE INSERT OR UPDATE ON public.token_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_tokens_remaining();

-- Fonction pour mettre à jour les timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour mettre à jour automatiquement les timestamps
CREATE TRIGGER trigger_update_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_token_allocations_updated_at
  BEFORE UPDATE ON public.token_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Politiques RLS pour les tables administrateur
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_statistics ENABLE ROW LEVEL SECURITY;

-- Politiques pour admin_users
CREATE POLICY "Admins can view all admin users" ON public.admin_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() 
      AND au.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins can manage admin users" ON public.admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() 
      AND au.role = 'super_admin'
    )
  );

-- Politiques pour token_allocations
CREATE POLICY "Admins can view all token allocations" ON public.token_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() 
      AND au.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage token allocations" ON public.token_allocations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() 
      AND au.role IN ('admin', 'super_admin')
    )
  );

-- Politiques pour admin_activity_logs
CREATE POLICY "Admins can view activity logs" ON public.admin_activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() 
      AND au.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert activity logs" ON public.admin_activity_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() 
      AND au.role IN ('admin', 'super_admin')
    )
  );

-- Politiques pour admin_statistics
CREATE POLICY "Admins can view statistics" ON public.admin_statistics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() 
      AND au.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage statistics" ON public.admin_statistics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() 
      AND au.role IN ('admin', 'super_admin')
    )
  );

-- Insérer un super admin par défaut (à modifier avec l'ID de l'utilisateur souhaité)
-- INSERT INTO public.admin_users (user_id, role, created_by) 
-- VALUES ('USER_ID_HERE', 'super_admin', 'USER_ID_HERE');

-- Commentaire pour documenter la migration
COMMENT ON TABLE public.admin_users IS 'Table des utilisateurs administrateurs avec leurs rôles et permissions';
COMMENT ON TABLE public.token_allocations IS 'Table des allocations de tokens pour la génération de liens de réservation';
COMMENT ON TABLE public.admin_activity_logs IS 'Table des logs d''activité des administrateurs';
COMMENT ON TABLE public.admin_statistics IS 'Table des statistiques quotidiennes pour le dashboard administrateur';
