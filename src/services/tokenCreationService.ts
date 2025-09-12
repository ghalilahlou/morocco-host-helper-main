// Service pour la création de tokens de vérification
import { supabase } from '@/integrations/supabase/client';

export interface TokenCreationResult {
  success: boolean;
  token?: string;
  error?: string;
}

export class TokenCreationService {
  /**
   * Crée un token de vérification pour une propriété
   */
  static async createVerificationToken(propertyId: string): Promise<TokenCreationResult> {
    try {
      console.log('🔍 Création d\'un token de vérification pour la propriété:', propertyId);
      
      // Générer un token unique
      const token = `${propertyId}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      
      // Vérifier si un token existe déjà pour cette propriété
      const { data: existingToken, error: checkError } = await supabase
        .from('property_verification_tokens')
        .select('id, token')
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('❌ Erreur lors de la vérification du token existant:', checkError);
        return {
          success: false,
          error: 'Erreur lors de la vérification du token existant'
        };
      }
      
      if (existingToken) {
        console.log('✅ Token existant trouvé:', existingToken.token);
        return {
          success: true,
          token: existingToken.token
        };
      }
      
      // Créer un nouveau token
      const { data: newToken, error: createError } = await supabase
        .from('property_verification_tokens')
        .insert({
          property_id: propertyId,
          token: token,
          is_active: true
        })
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Erreur lors de la création du token:', createError);
        return {
          success: false,
          error: 'Erreur lors de la création du token'
        };
      }
      
      console.log('✅ Token créé avec succès:', newToken.token);
      return {
        success: true,
        token: newToken.token
      };
      
    } catch (error) {
      console.error('❌ Erreur lors de la création du token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }
  
  /**
   * Crée un token pour la propriété spécifique qui pose problème
   */
  static async createTokenForProblemProperty(): Promise<TokenCreationResult> {
    const propertyId = 'e3134554-7233-42b4-90b4-424d5aa74f40';
    const existingToken = '2ca50aa4-0754-409a-93d5-6e1dc7287b13-0b711e3e-c976-44f4-89eb-6fb23075b3b9';
    
    try {
      console.log('🔍 Création du token pour la propriété problématique...');
      
      // Créer le token spécifique
      const { data: newToken, error: createError } = await supabase
        .from('property_verification_tokens')
        .insert({
          property_id: propertyId,
          token: existingToken,
          is_active: true
        })
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Erreur lors de la création du token:', createError);
        return {
          success: false,
          error: 'Erreur lors de la création du token'
        };
      }
      
      console.log('✅ Token créé avec succès pour la propriété problématique');
      return {
        success: true,
        token: newToken.token
      };
      
    } catch (error) {
      console.error('❌ Erreur lors de la création du token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }
}
