import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/booking';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// ✅ OPTIMISATION : Cache pour éviter les requêtes répétées
interface CacheEntry {
  data: Property[];
  timestamp: number;
}

const propertiesCache = new Map<string, CacheEntry>();
const PROPERTIES_CACHE_DURATION = 30000; // 30 secondes
const loadingRef = { current: false };

export const useProperties = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const loadProperties = async (retryCount = 0) => {
    if (!user) {
      setProperties([]);
      setIsLoading(false);
      return;
    }

    // ✅ OPTIMISATION : Vérifier le cache d'abord
    const cacheKey = `properties-${user.id}`;
    const cached = propertiesCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < PROPERTIES_CACHE_DURATION) {
      console.log('✅ [PROPERTIES] Utilisation du cache', { count: cached.data.length });
      setProperties(cached.data);
      setIsLoading(false);
      return;
    }

    // ✅ PROTECTION : Empêcher les appels multiples simultanés
    if (loadingRef.current) {
      console.log('⏳ loadProperties déjà en cours, appel ignoré');
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);

    try {
      // ✅ OPTIMISATION : Timeout augmenté à 30 secondes pour les connexions lentes
      const TIMEOUT_MS = 30000;
      const timeoutId = setTimeout(() => {
        // Le timeout sera géré par Promise.race
      }, TIMEOUT_MS);

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Properties query timeout after 30s')), TIMEOUT_MS)
      );

      const queryPromise = supabase
        .from('properties')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      let result: any;
      try {
        result = await Promise.race([queryPromise, timeoutPromise]);
      } catch (raceError: any) {
        // Si c'est le timeout, nettoyer et relancer
        clearTimeout(timeoutId);
        throw raceError;
      }
      
      clearTimeout(timeoutId);
      const { data, error } = result;

      // ✅ OPTIMISATION : Détecter les erreurs réseau et de connexion
      if (error) {
        const errorMessage = error.message || String(error) || '';
        const errorStatus = (error as any).status || (error as any).statusCode || (error as any).code;
        
        // Détecter les erreurs de connexion réseau
        const isNetworkError = 
          errorMessage.includes('ERR_CONNECTION_CLOSED') ||
          errorMessage.includes('ERR_QUIC_PROTOCOL_ERROR') ||
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('NetworkError') ||
          errorMessage.includes('Network request failed') ||
          (error.name === 'TypeError' && errorMessage.includes('fetch'));
        
        const is500Error = errorStatus === 500 || errorStatus === '500' || 
                          errorMessage.includes('Internal Server Error') ||
                          errorMessage.includes('500');
        
        const isTimeoutError = 
          errorMessage.includes('timeout') ||
          errorMessage.includes('Timeout') ||
          errorStatus === 408 ||
          errorStatus === '408';
        
        // ✅ RETRY : Réessayer pour les erreurs réseau, 500, ou timeout (jusqu'à 3 fois)
        const maxRetries = 3;
        const shouldRetry = (isNetworkError || is500Error || isTimeoutError) && retryCount < maxRetries;
        
        if (shouldRetry) {
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Backoff exponentiel, max 5s
          console.warn(`⚠️ [PROPERTIES] Erreur détectée (${isNetworkError ? 'réseau' : is500Error ? '500' : 'timeout'}), retry ${retryCount + 1}/${maxRetries} dans ${retryDelay}ms`);
          loadingRef.current = false;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return loadProperties(retryCount + 1);
        }
        
        throw error;
      }

      const transformedProperties: Property[] = (data || []).map(property => ({
        ...property,
        house_rules: Array.isArray(property.house_rules) 
          ? property.house_rules.filter(rule => typeof rule === 'string') as string[]
          : [],
        contract_template: typeof property.contract_template === 'object' && property.contract_template !== null 
          ? property.contract_template 
          : {},
      }));

      // ✅ OPTIMISATION : Mettre en cache
      propertiesCache.set(cacheKey, { data: transformedProperties, timestamp: now });
      console.log('✅ [PROPERTIES] Propriétés chargées et mises en cache', { count: transformedProperties.length });

      setProperties(transformedProperties);
    } catch (error: any) {
      console.error('❌ [PROPERTIES] Erreur lors du chargement:', error);
      
      const errorMessage = error?.message || String(error) || '';
      const isNetworkError = 
        errorMessage.includes('ERR_CONNECTION_CLOSED') ||
        errorMessage.includes('ERR_QUIC_PROTOCOL_ERROR') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('timeout');
      
      // ✅ OPTIMISATION : Utiliser le cache même s'il est expiré en cas d'erreur
      if (cached) {
        console.warn('⚠️ [PROPERTIES] Utilisation du cache expiré en raison d\'une erreur');
        setProperties(cached.data);
        toast.error(
          isNetworkError 
            ? 'Problème de connexion, affichage des données en cache' 
            : 'Erreur de chargement, affichage des données en cache'
        );
      } else {
        toast.error(
          isNetworkError 
            ? 'Échec de connexion au serveur. Veuillez vérifier votre connexion internet.' 
            : 'Échec du chargement des propriétés'
        );
      }
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

  const addProperty = async (property: Omit<Property, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) {
      toast.error('User not authenticated');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('properties')
        .insert([
          {
            ...property,
            user_id: user.id,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      const newProperty: Property = {
        ...data,
        house_rules: Array.isArray(data.house_rules) 
          ? data.house_rules.filter(rule => typeof rule === 'string') as string[]
          : [],
        contract_template: typeof data.contract_template === 'object' && data.contract_template !== null 
          ? data.contract_template 
          : {},
      };

      // Update local state immediately
      setProperties(prev => [newProperty, ...prev]);
      
      // Also refresh from database to ensure consistency
      await loadProperties();
      
      toast.success('Property added successfully');
      return newProperty;
    } catch (error) {
      console.error('Error adding property:', error);
      toast.error('Failed to add property');
      return null;
    }
  };

  const updateProperty = async (id: string, updates: Partial<Property>) => {
    try {
      const { error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Reload properties from database to get fresh data
      await loadProperties();
      
      toast.success('Property updated successfully');
    } catch (error) {
      console.error('Error updating property:', error);
      toast.error('Failed to update property');
    }
  };

  const deleteProperty = async (id: string) => {
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('delete_property_with_reservations', {
        p_property_id: id,
        p_user_id: user.id
      });

      if (error) throw error;

      if (data) {
        setProperties(prev => prev.filter(property => property.id !== id));
        toast.success('Propriété et toutes ses réservations supprimées avec succès');
      } else {
        toast.error('Propriété non trouvée ou non autorisée');
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      toast.error('Failed to delete property');
    }
  };

  const getPropertyById = (id: string): Property | undefined => {
    return properties.find(property => property.id === id);
  };

  useEffect(() => {
    loadProperties();
  }, [user]);

  const refreshProperties = () => {
    // ✅ OPTIMISATION : Invalider le cache avant de recharger
    if (user) {
      const cacheKey = `properties-${user.id}`;
      propertiesCache.delete(cacheKey);
    }
    loadProperties();
  };

  return {
    properties,
    isLoading,
    addProperty,
    updateProperty,
    deleteProperty,
    getPropertyById,
    refreshProperties,
  };
};