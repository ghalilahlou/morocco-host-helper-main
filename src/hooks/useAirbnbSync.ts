import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AirbnbEdgeFunctionService } from '@/services/airbnbEdgeFunctionService';

export interface SyncStatus {
  id: string;
  property_id: string;
  sync_status: string;
  last_sync_at?: string;
  last_error?: string;
  reservations_count?: number;
  created_at: string;
  updated_at: string;
}

export const useAirbnbSync = (propertyId: string) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load sync status from database
  const loadSyncStatus = useCallback(async () => {
    if (!propertyId) {

      setIsLoading(false);
      return;
    }

    try {

      setIsLoading(true);

      const status = await AirbnbEdgeFunctionService.getSyncStatus(propertyId);


      setSyncStatus(status);
    } catch (error) {
      console.error('❌ useAirbnbSync: Exception loading sync status:', error);
      setSyncStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  // Perform sync operation using Edge Function
  const performSync = useCallback(async (icsUrl: string) => {
    if (!propertyId || !icsUrl || isSyncing) {

      return { success: false, error: 'Invalid parameters or sync in progress' };
    }


    setIsSyncing(true);

    try {
      const result = await AirbnbEdgeFunctionService.syncReservations(propertyId, icsUrl);


      // Reload status after sync to get updated data
      await loadSyncStatus();

      return result;
    } catch (error) {
      console.error('❌ performSync: Caught error:', error);

      // Reload status to get error details
      await loadSyncStatus();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsSyncing(false);
    }
  }, [propertyId, isSyncing, loadSyncStatus]);

  // Load status on mount and when propertyId changes
  useEffect(() => {
    loadSyncStatus();
  }, [loadSyncStatus]);

  // Set up real-time subscription for sync status changes
  useEffect(() => {
    if (!propertyId) return;

    const channel = supabase
      .channel(`sync-status-${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'airbnb_sync_status',
          filter: `property_id=eq.${propertyId}`
        },
        () => loadSyncStatus()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'airbnb_reservations',
          filter: `property_id=eq.${propertyId}`
        },
        () => loadSyncStatus()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [propertyId, loadSyncStatus]);

  return {
    syncStatus,
    isLoading,
    isSyncing,
    loadSyncStatus,
    performSync
  };
};
