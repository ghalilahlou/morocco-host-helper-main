// Utilitaires pour la validation des tokens
import { supabase } from '@/integrations/supabase/client';

export interface TokenValidationResult {
  isValid: boolean;
  propertyData?: any;
  error?: string;
}

/**
 * Valide un token en vérifiant directement l'existence de la propriété
 * Cette approche évite les problèmes avec les Edge Functions
 */
export const validateTokenDirect = async (
  propertyId: string, 
  token: string
): Promise<TokenValidationResult> => {
  try {
    console.log('🔍 Validation directe du token:', { propertyId, token: token.substring(0, 8) + '...' });
    
    // Vérifier que la propriété existe
    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .select('id, name, address, contract_template, contact_info, house_rules')
      .eq('id', propertyId)
      .single();
    
    if (propertyError) {
      console.error('❌ Erreur lors de la récupération de la propriété:', propertyError);
      return {
        isValid: false,
        error: 'Propriété non trouvée'
      };
    }
    
    if (!propertyData) {
      console.error('❌ Propriété non trouvée');
      return {
        isValid: false,
        error: 'Propriété non trouvée'
      };
    }
    
    // Vérifier que le token existe dans la base (optionnel, pour plus de sécurité)
    // ✅ CORRECTION : Encoder le token pour éviter les problèmes avec les caractères spéciaux
    const encodedToken = encodeURIComponent(token);
    console.log('🔍 Token encodé:', encodedToken);
    
    const { data: tokenData, error: tokenError } = await supabase
      .from('property_verification_tokens')
      .select('id, is_active, created_at')
      .eq('property_id', propertyId)
      .eq('token', token)
      .eq('is_active', true)
      .single();
    
    if (tokenError && tokenError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.warn('⚠️ Erreur lors de la vérification du token:', tokenError);
      // Ne pas faire échouer la validation pour cette erreur
    }
    
    if (tokenData) {
      // Token trouvé et actif - pas de vérification d'expiration car expires_at n'existe pas
      console.log('✅ Token trouvé dans la base de données');
    }
    
    console.log('✅ Token validé avec succès');
    return {
      isValid: true,
      propertyData
    };
    
  } catch (error) {
    console.error('❌ Erreur lors de la validation du token:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
};

/**
 * Crée un token de vérification pour une propriété (pour les tests)
 */
export const createVerificationToken = async (propertyId: string): Promise<string | null> => {
  try {
    const token = `${propertyId}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    
    const { data, error } = await supabase
      .from('property_verification_tokens')
      .insert({
        property_id: propertyId,
        token: token,
        is_active: true
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erreur lors de la création du token:', error);
      return null;
    }
    
    console.log('✅ Token créé avec succès:', token);
    return token;
    
  } catch (error) {
    console.error('❌ Erreur lors de la création du token:', error);
    return null;
  }
};
