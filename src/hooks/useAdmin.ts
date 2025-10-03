import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminDashboardData, TokenAllocation, AdminUser } from '@/types/admin';
import { useAuth } from './useAuth';

// 🔧 Logger conditionnel pour éviter les console.logs en production
const logger = {
  log: (...args: any[]) => {
    if (import.meta.env.DEV) console.log(...args);
  },
  error: (...args: any[]) => {
    if (import.meta.env.DEV) console.error(...args);
  },
  warn: (...args: any[]) => {
    if (import.meta.env.DEV) console.warn(...args);
  }
};

export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminChecked, setAdminChecked] = useState(false);
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [tokenAllocations, setTokenAllocations] = useState<TokenAllocation[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  // Vérifier si l'utilisateur est admin avec retry et cache
  useEffect(() => {
    const checkAdminStatus = async (retryCount = 0) => {
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        setAdminChecked(false);
        return;
      }
      
      // ✅ Si déjà vérifié pour cet utilisateur, pas besoin de re-vérifier
      if (adminChecked && user.id) {
        setIsLoading(false);
        return;
      }

      try {
        logger.log('🔍 Vérification statut admin pour:', user.email, 'ID:', user.id);
        
        // Vérifier dans la table admin_users
        const { data: adminUser, error } = await supabase
          .from('admin_users')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // Pas d'admin trouvé - normal
            logger.log('ℹ️ Utilisateur non-admin:', user.email);
            setIsAdmin(false);
          } else {
            logger.error('❌ Erreur vérification admin:', error);
            
            // ✅ RETRY en cas d'erreur réseau
            if (retryCount < 2 && (error.message?.includes('network') || error.message?.includes('timeout'))) {
              logger.log(`🔄 Retry ${retryCount + 1}/2 pour vérification admin...`);
              setTimeout(() => checkAdminStatus(retryCount + 1), 1000 * (retryCount + 1));
              return;
            }
            
            setIsAdmin(false);
          }
        } else {
          logger.log('✅ Admin confirmé:', user.email, 'Role:', adminUser.role);
          setIsAdmin(!!adminUser);
          setAdminChecked(true); // ✅ Marquer comme vérifié
        }
      } catch (error) {
        logger.error('❌ Erreur critique vérification admin:', error);
        
        // ✅ RETRY en cas d'erreur critique
        if (retryCount < 2) {
          logger.log(`🔄 Retry ${retryCount + 1}/2 après erreur critique...`);
          setTimeout(() => checkAdminStatus(retryCount + 1), 2000 * (retryCount + 1));
          return;
        }
        
        setIsAdmin(false);
        setAdminChecked(true); // ✅ Marquer comme vérifié même en cas d'erreur
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, adminChecked]);

  // Charger les données du dashboard
  const loadDashboardData = async () => {
    if (!isAdmin) return;

    try {
      setIsLoading(true);

      // Charger les statistiques
      const stats = await loadStats();
      
      // Charger les analytics
      const bookingAnalytics = await loadBookingAnalytics();
      const userAnalytics = await loadUserAnalytics();
      const propertyAnalytics = await loadPropertyAnalytics();
      
      // Charger les données récentes
      const recentBookings = await loadRecentBookings();
      const recentUsers = await loadRecentUsers();
      const tokenAllocations = await loadTokenAllocations();

      setDashboardData({
        stats,
        bookingAnalytics,
        userAnalytics,
        propertyAnalytics,
        recentBookings,
        recentUsers,
        tokenAllocations
      });
    } catch (error) {
      logger.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les statistiques
  const loadStats = async () => {
    try {
      // Utiliser des requêtes séparées pour éviter les erreurs
      const [
        { count: totalUsers },
        { count: totalProperties },
        { count: totalBookings },
        { count: pendingBookings },
        { count: completedBookings },
        { count: cancelledBookings },
        { data: tokenData }
      ] = await Promise.all([
        supabase.from('auth.users').select('*', { count: 'exact', head: true }),
        supabase.from('properties').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
        supabase.from('token_allocations').select('tokens_remaining').eq('is_active', true)
      ]);

      // Calculer les tokens actifs
      const activeTokens = tokenData?.reduce((sum, token) => sum + (token.tokens_remaining || 0), 0) || 0;

      // Calculer les revenus (simulation pour l'instant)
      const totalRevenue = (totalBookings || 0) * 150; // Prix moyen estimé

      return {
        totalUsers: totalUsers || 0,
        totalProperties: totalProperties || 0,
        totalBookings: totalBookings || 0,
        totalRevenue: totalRevenue,
        activeTokens: activeTokens,
        pendingBookings: pendingBookings || 0,
        completedBookings: completedBookings || 0,
        cancelledBookings: cancelledBookings || 0
      };
    } catch (error) {
      console.error('Error loading stats:', error);
      return {
        totalUsers: 0,
        totalProperties: 0,
        totalBookings: 0,
        totalRevenue: 0,
        activeTokens: 0,
        pendingBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0
      };
    }
  };

  // Charger les analytics de réservations
  const loadBookingAnalytics = async () => {
    // Simuler des données pour l'exemple
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        date: date.toISOString().split('T')[0],
        bookings: Math.floor(Math.random() * 10) + 1,
        revenue: Math.floor(Math.random() * 1000) + 100,
        cancellations: Math.floor(Math.random() * 3)
      };
    }).reverse();

    return last30Days;
  };

  // Charger les analytics d'utilisateurs
  const loadUserAnalytics = async () => {
    // Simuler des données pour l'exemple
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        date: date.toISOString().split('T')[0],
        newUsers: Math.floor(Math.random() * 5) + 1,
        activeUsers: Math.floor(Math.random() * 20) + 10
      };
    }).reverse();

    return last30Days;
  };

  // Charger les analytics de propriétés
  const loadPropertyAnalytics = async () => {
    const { data: properties } = await supabase
      .from('properties')
      .select('id, name');

    return (properties || []).map(property => ({
      propertyId: property.id,
      propertyName: property.name,
      totalBookings: Math.floor(Math.random() * 50) + 1,
      totalRevenue: Math.floor(Math.random() * 5000) + 500,
      occupancyRate: Math.random() * 100,
      averageRating: Math.random() * 5
    }));
  };

  // Charger les réservations récentes
  const loadRecentBookings = async () => {
    const { data } = await supabase
      .from('bookings')
      .select(`
        *,
        properties(name),
        guests(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    return data || [];
  };

  // Charger les utilisateurs récents
  const loadRecentUsers = async () => {
    try {
      const { data } = await supabase
        .from('auth.users')
        .select('id, email, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      return data || [];
    } catch (error) {
      console.error('Error loading recent users:', error);
      return [];
    }
  };

  // Charger les allocations de tokens
  const loadTokenAllocations = async () => {
    const { data } = await supabase
      .from('token_allocations')
      .select('*')
      .order('created_at', { ascending: false });

    return data || [];
  };

  // Allouer des tokens à un utilisateur
  const allocateTokens = async (userId: string, tokens: number) => {
    try {
      const { data, error } = await supabase
        .from('token_allocations')
        .upsert({
          user_id: userId,
          tokens_allocated: tokens,
          tokens_used: 0,
          tokens_remaining: tokens,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Recharger les allocations
      await loadTokenAllocations();
      
      return data;
    } catch (error) {
      console.error('Error allocating tokens:', error);
      throw error;
    }
  };

  // Charger tous les utilisateurs via fonction SQL
  const loadUsers = async () => {
    try {
      console.log('🔍 Chargement des utilisateurs via fonction SQL...');
      
      // ✅ CORRECTION : Utiliser la fonction SQL qui fonctionne
      const { data, error } = await supabase.rpc('get_users_for_admin');

      if (error) {
        console.error('❌ Erreur fonction SQL:', error);
        // Fallback : Charger depuis admin_users existants
        return await loadAdminUsersOnly();
      }

      if (!data || !Array.isArray(data)) {
        console.warn('⚠️ Aucun utilisateur retourné');
        return await loadAdminUsersOnly();
      }

      // Les données sont déjà enrichies par get_users_for_admin
      const adminUsers = data.map((user: any) => ({
        id: user.user_id || user.id,
        email: user.email || 'unknown@example.com',
        full_name: user.full_name || user.email?.split('@')[0] || 'Unknown',
        role: user.role || 'user' as const,
        created_at: user.created_at,
        last_login: user.last_login,
        is_active: user.is_active !== false
      }));

      setUsers(adminUsers);
      console.log('✅ Utilisateurs chargés:', adminUsers.length);
      return adminUsers;
    } catch (error) {
      console.error('❌ Erreur chargement utilisateurs:', error);
      // Fallback en cas d'erreur
      return await loadAdminUsersOnly();
    }
  };

  // Fallback : Charger uniquement les admins connus
  const loadAdminUsersOnly = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select(`
          user_id,
          role,
          created_at,
          is_active
        `);

      if (error) throw error;

      const adminUsers = (data || []).map(admin => ({
        id: admin.user_id,
        email: 'admin@app.com', // Placeholder
        full_name: `Admin ${admin.role}`,
        role: admin.role as 'admin' | 'super_admin',
        created_at: admin.created_at,
        last_login: null,
        is_active: admin.is_active
      }));

      setUsers(adminUsers);
      return adminUsers;
    } catch (error) {
      console.error('❌ Erreur fallback admin users:', error);
      setUsers([]);
      return [];
    }
  };

  return {
    isAdmin,
    isLoading,
    dashboardData,
    tokenAllocations,
    users,
    loadDashboardData,
    allocateTokens,
    loadUsers
  };
};
