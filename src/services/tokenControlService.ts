// Service pour la gestion du contrôle des tokens
import { supabase } from '@/integrations/supabase/client';
import { 
  TokenControlSettings, 
  TokenControlResponse, 
  TokenControlFormData,
  TokenControlType 
} from '@/types/tokenControl';

export class TokenControlService {
  
  /**
   * Vérifier si la génération de tokens est autorisée pour une propriété
   */
  static async checkTokenGenerationAllowed(propertyId: string): Promise<TokenControlResponse> {
    try {
      console.log('🔍 Vérification des permissions de génération de tokens pour:', propertyId);
      
      const { data, error } = await supabase.rpc('check_reservation_allowed', {
        property_uuid: propertyId
      });

      if (error) {
        console.error('❌ Erreur lors de la vérification des permissions:', error);
        return {
          allowed: false,
          reason: 'Erreur lors de la vérification des permissions',
          control_type: 'blocked'
        };
      }

      console.log('✅ Résultat de la vérification:', data);
      return data as TokenControlResponse;
      
    } catch (error) {
      console.error('❌ Erreur dans checkTokenGenerationAllowed:', error);
      return {
        allowed: false,
        reason: 'Erreur système',
        control_type: 'blocked'
      };
    }
  }

  /**
   * Obtenir les paramètres de contrôle des tokens pour une propriété
   */
  static async getTokenControlSettings(propertyId: string): Promise<TokenControlSettings | null> {
    try {
      const { data, error } = await supabase
        .from('token_control_settings')
        .select('*')
        .eq('property_id', propertyId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Aucun paramètre trouvé, retourner null
          return null;
        }
        console.error('❌ Erreur lors de la récupération des paramètres:', error);
        return null;
      }

      return data as TokenControlSettings;
    } catch (error) {
      console.error('❌ Erreur dans getTokenControlSettings:', error);
      return null;
    }
  }

  /**
   * Créer ou mettre à jour les paramètres de contrôle des tokens
   */
  static async updateTokenControlSettings(formData: TokenControlFormData): Promise<boolean> {
    try {
      console.log('💾 Mise à jour des paramètres de contrôle:', formData);

      // Vérifier si des paramètres existent déjà
      const existingSettings = await this.getTokenControlSettings(formData.property_id);

      if (existingSettings) {
        // Mettre à jour les paramètres existants
        const { error } = await supabase
          .from('token_control_settings')
          .update({
            control_type: formData.control_type,
            max_reservations: formData.control_type === 'limited' ? formData.max_reservations : null,
            is_enabled: formData.is_enabled,
            updated_at: new Date().toISOString()
          })
          .eq('property_id', formData.property_id);

        if (error) {
          console.error('❌ Erreur lors de la mise à jour:', error);
          return false;
        }
      } else {
        // Créer de nouveaux paramètres
        const { error } = await supabase
          .from('token_control_settings')
          .insert({
            property_id: formData.property_id,
            control_type: formData.control_type,
            max_reservations: formData.control_type === 'limited' ? formData.max_reservations : null,
            is_enabled: formData.is_enabled,
            current_reservations: 0
          });

        if (error) {
          console.error('❌ Erreur lors de la création:', error);
          return false;
        }
      }

      console.log('✅ Paramètres de contrôle mis à jour avec succès');
      return true;
    } catch (error) {
      console.error('❌ Erreur dans updateTokenControlSettings:', error);
      return false;
    }
  }

  /**
   * Obtenir tous les paramètres de contrôle des tokens (pour l'admin)
   */
  static async getAllTokenControlSettings(): Promise<TokenControlSettings[]> {
    try {
      const { data, error } = await supabase
        .from('token_control_settings')
        .select(`
          *,
          properties (
            id,
            name,
            address
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur lors de la récupération des paramètres:', error);
        return [];
      }

      return data as TokenControlSettings[];
    } catch (error) {
      console.error('❌ Erreur dans getAllTokenControlSettings:', error);
      return [];
    }
  }

  /**
   * Réinitialiser le compteur de réservations pour une propriété
   */
  static async resetReservationCount(propertyId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('token_control_settings')
        .update({ 
          current_reservations: 0,
          updated_at: new Date().toISOString()
        })
        .eq('property_id', propertyId);

      if (error) {
        console.error('❌ Erreur lors de la réinitialisation:', error);
        return false;
      }

      console.log('✅ Compteur de réservations réinitialisé');
      return true;
    } catch (error) {
      console.error('❌ Erreur dans resetReservationCount:', error);
      return false;
    }
  }

  /**
   * Supprimer les paramètres de contrôle pour une propriété
   */
  static async deleteTokenControlSettings(propertyId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('token_control_settings')
        .delete()
        .eq('property_id', propertyId);

      if (error) {
        console.error('❌ Erreur lors de la suppression:', error);
        return false;
      }

      console.log('✅ Paramètres de contrôle supprimés');
      return true;
    } catch (error) {
      console.error('❌ Erreur dans deleteTokenControlSettings:', error);
      return false;
    }
  }

  /**
   * Vérifier si l'utilisateur actuel est administrateur
   */
  static async isCurrentUserAdmin(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'super_admin'])
        .single();

      if (error) return false;
      return !!data;
    } catch (error) {
      console.error('❌ Erreur dans isCurrentUserAdmin:', error);
      return false;
    }
  }
}
