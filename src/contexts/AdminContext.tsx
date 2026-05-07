import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AdminDashboardData } from '@/types/admin';

const isDev = import.meta.env.DEV;
const log = {
  error: (...args: unknown[]) => { if (isDev) console.error(...args); },
};

interface AdminContextType {
  isAdmin: boolean;
  /** Rôle depuis `admin_users` (null si non admin) */
  adminRole: 'admin' | 'super_admin' | null;
  isLoading: boolean;
  checkAdminStatus: () => Promise<void>;
  dashboardData: AdminDashboardData | null;
  loadDashboardData: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<'admin' | 'super_admin' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
      setAdminRole(null);
      setIsLoading(false);
      setCheckedUserId(null);
      return;
    }

    // ✅ Ne re-vérifier que si l'utilisateur a changé
    if (checkedUserId === user.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: adminData, error } = await supabase.rpc('get_admin_user_by_id', {
        user_id_param: user.id
      });

      if (error) {
        log.error('❌ [Context] Erreur RPC:', error);
        setIsAdmin(false);
        setAdminRole(null);
      } else if (adminData && adminData.length > 0) {
        const adminUser = adminData[0];
        const active = !!adminUser && adminUser.is_active;
        setIsAdmin(active);
        setAdminRole(
          active && (adminUser.role === 'super_admin' || adminUser.role === 'admin')
            ? adminUser.role
            : null
        );
      } else {
        setIsAdmin(false);
        setAdminRole(null);
      }
      
      setCheckedUserId(user.id);
    } catch (error) {
      log.error('❌ [Context] Erreur critique:', error);
      setIsAdmin(false);
      setAdminRole(null);
      setCheckedUserId(user.id);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboardData = async () => {
    if (!isAdmin) return;

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [usersRes, propertiesRes, allBookingsRes, recentBookingsRes] = await Promise.all([
        supabase.rpc('get_users_for_admin'),
        supabase.from('properties').select('id, name, user_id, created_at'),
        supabase
          .from('bookings')
          .select('id, status, total_amount, created_at, property_id, check_in_date, check_out_date')
          .order('created_at', { ascending: true }),
        supabase
          .from('bookings')
          .select('id, booking_reference, check_in_date, check_out_date, status, created_at, property_id, properties(name)')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      const usersArray = Array.isArray(usersRes.data) ? usersRes.data : [];
      const allBookings = allBookingsRes.data || [];

      // ── Stats globales ──────────────────────────────────────────────
      const totalRevenue = allBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

      // ── bookingAnalytics : 30 jours glissants ───────────────────────
      const dayMap = new Map<string, { bookings: number; revenue: number; cancellations: number }>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dayMap.set(d.toISOString().split('T')[0], { bookings: 0, revenue: 0, cancellations: 0 });
      }
      allBookings
        .filter(b => b.created_at >= thirtyDaysAgo.toISOString())
        .forEach(b => {
          const day = b.created_at.split('T')[0];
          const curr = dayMap.get(day);
          if (curr) {
            curr.bookings++;
            curr.revenue += Number(b.total_amount) || 0;
            if (b.status === 'cancelled') curr.cancellations++;
          }
        });
      const bookingAnalytics = Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v }));

      // ── userAnalytics : 30 jours glissants ─────────────────────────
      const userDayMap = new Map<string, { newUsers: number; activeUsers: number }>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        userDayMap.set(d.toISOString().split('T')[0], { newUsers: 0, activeUsers: 0 });
      }
      usersArray.forEach((u: any) => {
        const day = u.created_at?.split('T')[0];
        const curr = userDayMap.get(day);
        if (curr) curr.newUsers++;
      });
      const userAnalytics = Array.from(userDayMap.entries()).map(([date, v]) => ({ date, ...v }));

      // ── propertyAnalytics : aggrégat par propriété ──────────────────
      const propMap = new Map<string, {
        propertyId: string; propertyName: string;
        totalBookings: number; totalRevenue: number;
        occupancyRate: number; averageRating: number;
      }>();
      (propertiesRes.data || []).forEach(p => {
        propMap.set(p.id, {
          propertyId: p.id, propertyName: p.name,
          totalBookings: 0, totalRevenue: 0,
          occupancyRate: 0, averageRating: 0,
        });
      });
      allBookings.forEach(b => {
        if (!b.property_id) return;
        const prop = propMap.get(b.property_id);
        if (!prop) return;
        prop.totalBookings++;
        if (b.status !== 'cancelled') prop.totalRevenue += Number(b.total_amount) || 0;
      });
      const propertyAnalytics = Array.from(propMap.values())
        .sort((a, b) => b.totalBookings - a.totalBookings);

      const recentUsers = usersArray
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      const data: AdminDashboardData = {
        stats: {
          totalUsers: usersArray.length,
          totalProperties: propertiesRes.data?.length || 0,
          totalBookings: allBookings.length,
          totalRevenue,
          activeTokens: 0,
          pendingBookings: allBookings.filter(b => b.status === 'pending').length,
          completedBookings: allBookings.filter(b => b.status === 'completed').length,
          cancelledBookings: allBookings.filter(b => b.status === 'cancelled').length,
        },
        bookingAnalytics,
        userAnalytics,
        propertyAnalytics,
        recentBookings: recentBookingsRes.data || [],
        recentUsers,
        tokenAllocations: [],
      };

      setDashboardData(data);
    } catch (error) {
      log.error('❌ [Context] Erreur chargement dashboard:', error);
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, [user?.id]);
  
  useEffect(() => {
    if (isAdmin) {
      loadDashboardData();
    }
  }, [isAdmin]);

  return (
    <AdminContext.Provider value={{ isAdmin, adminRole, isLoading, checkAdminStatus, dashboardData, loadDashboardData }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdminContext = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdminContext must be used within an AdminProvider');
  }
  return context;
};
