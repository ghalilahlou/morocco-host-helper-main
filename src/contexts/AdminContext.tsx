// ✅ CONTEXTE GLOBAL POUR L'ÉTAT ADMIN
// Solution pour maintenir l'état admin à travers les navigations

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AdminDashboardData } from '@/types/admin';

interface AdminContextType {
  isAdmin: boolean;
  isLoading: boolean;
  checkAdminStatus: () => Promise<void>;
  dashboardData: AdminDashboardData | null;
  loadDashboardData: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
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
      console.log('🔍 [Context] Vérification admin pour:', user.email);
      
      const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select('role, is_active')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('ℹ️ [Context] Non-admin:', user.email);
          setIsAdmin(false);
        } else {
          console.error('❌ [Context] Erreur:', error);
          setIsAdmin(false);
        }
      } else {
        console.log('✅ [Context] Admin confirmé:', user.email, adminUser.role);
        setIsAdmin(!!adminUser && adminUser.is_active);
      }
      
      setCheckedUserId(user.id);
    } catch (error) {
      console.error('❌ [Context] Erreur critique:', error);
      setIsAdmin(false);
      setCheckedUserId(user.id);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboardData = async () => {
    if (!isAdmin) return;
    
    try {
      console.log('🔄 [Context] Chargement des données dashboard...');
      
      // 🚀 OPTIMISATION: Requêtes parallèles optimisées avec sélections limitées
      const [usersRes, propertiesRes, bookingsRes, recentBookingsRes] = await Promise.all([
        supabase.rpc('get_users_for_admin'),
        supabase.from('properties').select('id, name, user_id, created_at'),
        supabase.from('bookings').select('id, status, total_amount, created_at'),
        supabase.from('bookings')
          .select('id, booking_reference, check_in_date, check_out_date, status, created_at, properties(name)')
          .order('created_at', { ascending: false })
          .limit(10)
      ]);
      
      // Calculer les statistiques - usersRes.data est maintenant un JSON
      const usersArray = Array.isArray(usersRes.data) ? usersRes.data : [];
      const totalUsers = usersArray.length || 0;
      const totalProperties = propertiesRes.data?.length || 0;
      const totalBookings = bookingsRes.data?.length || 0;
      
      // Calculer le revenu total (simulation)
      const totalRevenue = bookingsRes.data?.reduce((sum, booking) => {
        return sum + (booking.total_amount || 0);
      }, 0) || 0;
      
      // 🚀 OPTIMISATION: Données déjà triées et limitées par la requête
      const recentBookings = recentBookingsRes.data || [];
      
      // Utilisateurs récents (top 10 les plus récents)
      const recentUsers = usersArray
        ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10) || [];
      
      const data: AdminDashboardData = {
        stats: {
          totalUsers,
          totalProperties,
          totalBookings,
          totalRevenue,
          activeTokens: 0, // À calculer si nécessaire
          pendingBookings: bookingsRes.data?.filter(b => b.status === 'pending').length || 0,
          completedBookings: bookingsRes.data?.filter(b => b.status === 'completed').length || 0,
          cancelledBookings: bookingsRes.data?.filter(b => b.status === 'archived').length || 0
        },
        bookingAnalytics: [], // À implémenter si nécessaire
        userAnalytics: [], // À implémenter si nécessaire
        propertyAnalytics: [], // À implémenter si nécessaire
        recentBookings,
        recentUsers,
        tokenAllocations: [] // À implémenter si nécessaire
      };
      
      setDashboardData(data);
      console.log('✅ [Context] Données dashboard chargées:', data);
      
    } catch (error) {
      console.error('❌ [Context] Erreur chargement dashboard:', error);
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
    <AdminContext.Provider value={{ isAdmin, isLoading, checkAdminStatus, dashboardData, loadDashboardData }}>
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
