import { supabase } from '@/integrations/supabase/client';

export interface SyncResult {
  success: boolean;
  count?: number;
  error?: string;
  message?: string;
}

export class AirbnbEdgeFunctionService {
  static async syncReservations(propertyId: string, icsUrl: string): Promise<SyncResult> {
    try {
      console.log('🚀 AirbnbEdgeFunctionService: Starting sync', { propertyId, icsUrl });
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('❌ No active session');
        return { success: false, error: 'No active session' };
      }

      console.log('👤 Session found, user ID:', session.user.id);
      console.log('📡 Calling Edge Function...');
      
      const { data, error } = await supabase.functions.invoke('sync-airbnb-unified', {
        body: {
          propertyId,
          force: false
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });

      console.log('📊 Edge Function response:', { data, error });

      if (error) {
        console.error('❌ Edge Function error:', error);
        return { 
          success: false, 
          error: `Edge Function error: ${error.message}` 
        };
      }

      if (!data.success) {
        return { 
          success: false, 
          error: data.error || 'Unknown error from Edge Function' 
        };
      }

      console.log('✅ Sync completed via Edge Function');
      return {
        success: true,
        count: data.count,
        message: data.message
      };

    } catch (error) {
      console.error('❌ AirbnbEdgeFunctionService error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async getReservations(propertyId: string) {
    console.log('📋 Getting reservations for property:', propertyId);
    
    const { data, error } = await supabase
      .from('airbnb_reservations')
      .select('*')
      .eq('property_id', propertyId)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('❌ Error fetching reservations:', error);
      return [];
    }

    console.log('📋 Found reservations:', data?.length || 0);
    return data || [];
  }

  static async getSyncStatus(propertyId: string) {
    console.log('📊 Getting sync status for property:', propertyId);
    
    const { data, error } = await supabase
      .from('airbnb_sync_status')
      .select('*')
      .eq('property_id', propertyId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching sync status:', error);
      return null;
    }

    console.log('📊 Sync status:', data);
    return data;
  }
}