export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'super_admin';
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

export interface AdminStats {
  totalUsers: number;
  totalProperties: number;
  totalBookings: number;
  totalRevenue: number;
  activeTokens: number;
  pendingBookings: number;
  completedBookings: number;
  cancelledBookings: number;
}

export interface TokenAllocation {
  id: string;
  user_id: string;
  user_email: string;
  tokens_allocated: number;
  tokens_used: number;
  tokens_remaining: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface BookingAnalytics {
  date: string;
  bookings: number;
  revenue: number;
  cancellations: number;
}

export interface UserAnalytics {
  date: string;
  newUsers: number;
  activeUsers: number;
}

export interface PropertyAnalytics {
  propertyId: string;
  propertyName: string;
  totalBookings: number;
  totalRevenue: number;
  occupancyRate: number;
  averageRating: number;
}

// 🔥 TYPE FIXE POUR DASHBOARD DATA
export interface AdminDashboardData {
  stats: AdminStats;
  bookingAnalytics: BookingAnalytics[];
  userAnalytics: UserAnalytics[];
  propertyAnalytics: PropertyAnalytics[];
  recentBookings: RecentBooking[];
  recentUsers: RecentUser[];
  tokenAllocations: TokenAllocation[];
}

// Types pour les données récentes
export interface RecentBooking {
  id: string;
  booking_reference?: string;
  check_in_date: string;
  check_out_date: string;
  status: 'pending' | 'completed' | 'confirmed' | 'archived' | 'draft';
  guest_name?: string;
  property?: {
    name: string;
  };
  created_at: string;
}

export interface RecentUser {
  id: string;
  email: string;
  full_name?: string;
  created_at: string;
  is_property_owner: boolean;
  properties_count: number;
  total_bookings: number;
}

// Type pour les utilisateurs enrichis dans AdminUsers
export interface EnhancedUser extends AdminUser {
  properties_count: number;
  last_booking_date?: string;
  total_bookings: number;
  is_property_owner: boolean;
}