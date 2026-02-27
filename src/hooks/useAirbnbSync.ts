import { useState, useEffect, useCallback, useRef } from 'react';
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

  // ✅ OPTIMISATION : Éviter les appels multiples simultanés
  const loadingStatusRef = useRef(false);
  
  // Load sync status from database
  const loadSyncStatus = useCallback(async () => {
    if (!propertyId || loadingStatusRef.current) {
      return;
    }

    try {
      loadingStatusRef.current = true;
      setIsLoading(true);
      
      const status = await AirbnbEdgeFunctionService.getSyncStatus(propertyId);
      setSyncStatus(status);
    } catch {
      setSyncStatus(null);
    } finally {
      loadingStatusRef.current = false;
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
      // ✅ Invalider le cache de statut avant la synchronisation
      AirbnbEdgeFunctionService.invalidateSyncStatusCache(propertyId);
      
      const result = await AirbnbEdgeFunctionService.syncReservations(propertyId, icsUrl);
      
      // Reload status after sync to get updated data
      await loadSyncStatus();
      
      return result;
    } catch (error) {
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