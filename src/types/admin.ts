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
  user_name?: string;
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
  status: 'pending' | 'completed' | 'confirmed' | 'cancelled' | 'archived' | 'draft';
  guest_name?: string;
  /** Jointure Supabase: bookings -> properties */
  properties?: {
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

// ---- Réconciliation fiches / contrats ----

export type DiscrepancyFlag =
  | 'date_checkin_mismatch'
  | 'date_checkout_mismatch'
  | 'dob_suspicious'
  | 'document_number_suspect'
  | 'missing_required_fields'
  | 'missing_document_number'
  | 'missing_dob';

export interface GuestRecord {
  id: string;
  full_name: string | null;
  date_of_birth: string | null;
  document_number: string | null;
  document_type: string | null;
  nationality: string | null;
  place_of_birth: string | null;
  profession: string | null;
  motif_sejour: string | null;
  adresse_personnelle: string | null;
  document_issue_date: string | null;
  email: string | null;
}

export interface DiscrepantBooking {
  booking_id: string;
  booking_reference: string | null;
  property_name: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  created_at: string;
  submission_id: string | null;
  submission_booking_data: {
    checkInDate?: string;
    checkOutDate?: string;
    guestName?: string;
    [key: string]: unknown;
  } | null;
  submission_guest_data: Record<string, unknown>[] | null;
  guests: GuestRecord[];
  flags: DiscrepancyFlag[];
  severity: 'critical' | 'warning';
}

// Corrections en attente avant sauvegarde
export type PendingGuestCorrections = Record<string, Record<string, string>>;
export interface PendingCorrections {
  booking?: { check_in_date?: string; check_out_date?: string };
  guests: PendingGuestCorrections;
}

// Type pour les utilisateurs enrichis dans AdminUsers
// role est string (pas uniquement 'admin'|'super_admin') car les users normaux ont 'user' ou 'propriétaire'
export interface EnhancedUser {
  id: string;
  email: string;
  full_name: string;
  user_name?: string;
  role: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
  properties_count: number;
  last_booking_date?: string;
  total_bookings: number;
  is_property_owner: boolean;
}