import { useIsMobile } from '@/hooks/useIsMobile';
import { Dashboard } from './Dashboard';
import { MobileDashboard } from './MobileDashboard';
import { Booking } from '@/types/booking';
import { EnrichedBooking } from '@/services/guestSubmissionService';

interface ResponsiveDashboardProps {
  onNewBooking: () => void;
  onEditBooking: (booking: Booking) => void;
  bookings?: EnrichedBooking[];
  onDeleteBooking?: (id: string) => Promise<void>;
  onRefreshBookings?: () => void;
  propertyId?: string;
}

export const ResponsiveDashboard = (props: ResponsiveDashboardProps) => {
  const isMobile = useIsMobile();

  return isMobile ? <MobileDashboard {...props} /> : <Dashboard {...props} />;
};
