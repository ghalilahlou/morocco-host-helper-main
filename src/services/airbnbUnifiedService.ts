import { supabase } from '@/integrations/supabase/client';

export interface AirbnbReservation {
  id: string;
  airbnb_booking_id: string;
  summary: string;
  start_date: string;
  end_date: string;
  guest_name?: string;
  number_of_guests?: number;
  description?: string;
  created_at: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  reservationsCount: number;
  reservations?: AirbnbReservation[];
  propertyName?: string;
}

export interface SyncStatus {
  property_id: string;
  sync_status: 'idle' | 'syncing' | 'success' | 'error';
  last_sync_at?: string;
  last_error?: string;
  reservations_count?: number;
}

/**
 * Service unifié pour la synchronisation Airbnb
 * Remplace les services fragmentés par une logique cohérente
 */
export class AirbnbUnifiedService {
  
  /**
   * Synchroniser les réservations Airbnb pour une propriété
   */
  static async syncReservations(propertyId: string, force: boolean = false): Promise<SyncResult> {
    try {
      console.log(`🔄 Syncing Airbnb reservations for property ${propertyId} (force: ${force})`);
      
      const { data, error } = await supabase.functions.invoke('sync-airbnb-unified', {
        body: { propertyId, force }
      });

      if (error) {
        console.error('❌ Error syncing Airbnb:', error);
        return {
          success: false,
          message: `Sync failed: ${error.message}`,
          reservationsCount: 0
        };
      }

      if (data.success) {
        console.log(`✅ Synced ${data.reservations_count} reservations`);
        return {
          success: true,
          message: data.message,
          reservationsCount: data.reservations_count,
          reservations: data.reservations,
          propertyName: data.propertyName
        };
      } else {
        return {
          success: false,
          message: data.message || 'Sync failed',
          reservationsCount: 0
        };
      }
    } catch (error) {
      console.error('❌ Error in syncReservations:', error);
      return {
        success: false,
        message: 'Sync failed due to error',
        reservationsCount: 0
      };
    }
  }

  /**
   * Récupérer le statut de synchronisation d'une propriété
   */
  static async getSyncStatus(propertyId: string): Promise<SyncStatus | null> {
    try {
      const { data, error } = await supabase
        .from('airbnb_sync_status')
        .select('*')
        .eq('property_id', propertyId)
        .single();

      if (error) {
        console.error('❌ Error fetching sync status:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Error in getSyncStatus:', error);
      return null;
    }
  }

  /**
   * Récupérer les réservations Airbnb pour une propriété
   */
  static async getReservations(propertyId: string): Promise<AirbnbReservation[]> {
    try {
      const { data, error } = await supabase
        .from('airbnb_reservations')
        .select('*')
        .eq('property_id', propertyId)
        .order('start_date', { ascending: false });

      if (error) {
        console.error('❌ Error fetching reservations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error in getReservations:', error);
      return [];
    }
  }

  /**
   * Rechercher une réservation Airbnb par code de réservation
   */
  static async findReservationByCode(propertyId: string, bookingCode: string): Promise<AirbnbReservation | null> {
    try {
      console.log(`🔍 Searching for reservation with code: ${bookingCode} in property: ${propertyId}`);
      
      const { data, error } = await supabase
        .from('airbnb_reservations')
        .select('*')
        .eq('property_id', propertyId)
        .or(`airbnb_booking_id.eq.${bookingCode},description.ilike.%${bookingCode}%`)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('ℹ️ No reservation found with that code');
          return null;
        }
        console.error('❌ Error searching for reservation:', error);
        return null;
      }

      console.log('✅ Found reservation:', data.airbnb_booking_id);
      return data;
    } catch (error) {
      console.error('❌ Error in findReservationByCode:', error);
      return null;
    }
  }

  /**
   * Vérifier si une synchronisation est nécessaire
   */
  static async isSyncNeeded(propertyId: string): Promise<{
    needed: boolean;
    reason: string;
    lastSync?: string;
  }> {
    try {
      const syncStatus = await this.getSyncStatus(propertyId);
      
      if (!syncStatus) {
        return {
          needed: true,
          reason: 'No sync status found - first sync needed'
        };
      }

      if (syncStatus.sync_status === 'error') {
        return {
          needed: true,
          reason: 'Last sync failed - retry needed',
          lastSync: syncStatus.last_sync_at
        };
      }

      if (syncStatus.sync_status === 'syncing') {
        return {
          needed: false,
          reason: 'Sync already in progress',
          lastSync: syncStatus.last_sync_at
        };
      }

      if (syncStatus.last_sync_at) {
        const lastSync = new Date(syncStatus.last_sync_at);
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
        
        if (lastSync > fourHoursAgo) {
          return {
            needed: false,
            reason: 'Last sync was recent',
            lastSync: syncStatus.last_sync_at
          };
        }
      }

      return {
        needed: true,
        reason: 'Last sync was too long ago',
        lastSync: syncStatus.last_sync_at
      };
    } catch (error) {
      console.error('❌ Error checking sync status:', error);
      return {
        needed: true,
        reason: 'Error checking sync status'
      };
    }
  }

  /**
   * Synchroniser automatiquement si nécessaire
   */
  static async autoSyncIfNeeded(propertyId: string): Promise<SyncResult> {
    try {
      const syncCheck = await this.isSyncNeeded(propertyId);
      
      if (!syncCheck.needed) {
        return {
          success: true,
          message: `Sync not needed: ${syncCheck.reason}`,
          reservationsCount: 0
        };
      }

      console.log(`🔄 Auto-syncing property ${propertyId}: ${syncCheck.reason}`);
      return await this.syncReservations(propertyId, false);
    } catch (error) {
      console.error('❌ Error in autoSyncIfNeeded:', error);
      return {
        success: false,
        message: 'Auto-sync failed',
        reservationsCount: 0
      };
    }
  }

  /**
   * Obtenir les statistiques de synchronisation
   */
  static async getSyncStats(propertyId: string): Promise<{
    totalReservations: number;
    lastSyncAt?: string;
    syncStatus: string;
    hasError: boolean;
    errorMessage?: string;
  }> {
    try {
      const [reservations, syncStatus] = await Promise.all([
        this.getReservations(propertyId),
        this.getSyncStatus(propertyId)
      ]);

      return {
        totalReservations: reservations.length,
        lastSyncAt: syncStatus?.last_sync_at,
        syncStatus: syncStatus?.sync_status || 'unknown',
        hasError: syncStatus?.sync_status === 'error',
        errorMessage: syncStatus?.last_error
      };
    } catch (error) {
      console.error('❌ Error getting sync stats:', error);
      return {
        totalReservations: 0,
        syncStatus: 'error',
        hasError: true,
        errorMessage: 'Failed to get stats'
      };
    }
  }
}
