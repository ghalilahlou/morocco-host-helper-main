import { supabase } from '@/integrations/supabase/client';

export interface SyncResult {
  success: boolean;
  count?: number;
  error?: string;
  message?: string;
  details?: string; // ✅ NOUVEAU : Détails supplémentaires pour les erreurs
}

export class AirbnbEdgeFunctionService {
  // ✅ PROTECTION : Garder une trace des synchronisations en cours pour éviter les appels multiples
  private static syncInProgress = new Map<string, Promise<SyncResult>>();
  
  static async syncReservations(propertyId: string, icsUrl: string): Promise<SyncResult> {
    // ✅ PROTECTION : Vérifier si une synchronisation est déjà en cours pour cette propriété
    const existingSync = this.syncInProgress.get(propertyId);
    if (existingSync) {
      return existingSync;
    }
    
    // Créer une nouvelle promesse de synchronisation
    const syncPromise = (async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return { success: false, error: 'No active session' };
      }
      
      const { data, error } = await supabase.functions.invoke('sync-airbnb-unified', {
        body: {
          propertyId,
          force: false
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });

      // ✅ CORRIGÉ : Gérer les erreurs HTTP (non-2xx status codes)
      if (error) {
        
        // Try to extract error message from various possible locations
        let errorMessage = error.message || 'Edge Function error';
        let errorDetails: string | undefined;
        
        // Check error.context.body (most common location)
        if (error.context?.body) {
          try {
            const errorBody = typeof error.context.body === 'string' 
              ? JSON.parse(error.context.body) 
              : error.context.body;
            
            errorMessage = errorBody.error || errorBody.message || errorMessage;
            errorDetails = errorBody.details || errorBody.stack;
          } catch (parseError) {
            // If parsing fails, try to use the body as string
            if (typeof error.context.body === 'string') {
              errorMessage = error.context.body;
            }
          }
        }
        
        // Check data field (sometimes errors are returned in data)
        if (data && typeof data === 'object' && !data.success) {
          errorMessage = data.error || data.message || errorMessage;
          errorDetails = data.details || errorDetails;
        }
        
        return { 
          success: false, 
          error: errorMessage,
          details: errorDetails
        };
      }

      // ✅ CORRIGÉ : Vérifier si data existe et si success est défini
      if (!data) {
        console.error('❌ No data returned from Edge Function');
        return { 
          success: false, 
          error: 'No data returned from Edge Function' 
        };
      }

      // Si success est false ou non défini, traiter comme une erreur
      if (data.success === false || (data.error && !data.success)) {
        return { 
          success: false, 
          error: data.error || data.message || 'Unknown error from Edge Function',
          details: data.details
        };
      }
      
      // ✅ CORRIGÉ : Invalider le cache des réservations après une synchronisation
      this.invalidateReservationsCache(propertyId);
      
      return {
        success: true,
        count: data?.count ?? data?.reservations_count ?? 0,
        message: data.message
      };

      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      } finally {
        // ✅ IMPORTANT : Retirer la promesse du Map après la fin de la synchronisation
        this.syncInProgress.delete(propertyId);
      }
    })();
    
    // Stocker la promesse dans le Map
    this.syncInProgress.set(propertyId, syncPromise);
    
    return syncPromise;
  }

  // ✅ PROTECTION : Cache pour les réservations pour éviter les appels multiples
  private static reservationsCache = new Map<string, { data: any[], timestamp: number }>();
  private static readonly CACHE_TTL = 5000; // 5 secondes de cache
  
  static async getReservations(propertyId: string) {
    // ✅ PROTECTION : Vérifier le cache d'abord
    const cached = this.reservationsCache.get(propertyId);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    
    const { data, error } = await supabase
      .from('airbnb_reservations')
      .select('*')
      .eq('property_id', propertyId)
      .order('start_date', { ascending: true });

    if (error) {
      return [];
    }

    const reservations = data || [];
    
    // ✅ Mettre en cache
    this.reservationsCache.set(propertyId, { data: reservations, timestamp: now });
    
    return reservations;
  }
  
  // ✅ NOUVEAU : Méthode pour invalider le cache (appelée après une synchronisation)
  static invalidateReservationsCache(propertyId?: string) {
    if (propertyId) {
      this.reservationsCache.delete(propertyId);
    } else {
      this.reservationsCache.clear();
    }
  }

  // ✅ OPTIMISATION : Cache pour le statut de synchronisation
  private static syncStatusCache = new Map<string, { data: any, timestamp: number }>();
  private static readonly SYNC_STATUS_CACHE_TTL = 3000; // 3 secondes de cache
  
  static async getSyncStatus(propertyId: string) {
    // ✅ Vérifier le cache d'abord
    const cached = this.syncStatusCache.get(propertyId);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.SYNC_STATUS_CACHE_TTL) {
      return cached.data;
    }
    
    const { data, error } = await supabase
      .from('airbnb_sync_status')
      .select('*')
      .eq('property_id', propertyId)
      .maybeSingle();

    if (error) {
      return null;
    }

    // ✅ Mettre en cache
    this.syncStatusCache.set(propertyId, { data, timestamp: now });
    
    return data;
  }
  
  // ✅ NOUVEAU : Invalider le cache de statut après synchronisation
  static invalidateSyncStatusCache(propertyId?: string) {
    if (propertyId) {
      this.syncStatusCache.delete(propertyId);
    } else {
      this.syncStatusCache.clear();
    }
  }
}