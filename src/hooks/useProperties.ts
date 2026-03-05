import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/booking';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { multiLevelCache } from '@/services/multiLevelCache';

const CACHE_KEY_PREFIX = 'properties-v3-';
const CACHE_TTL_INDEXEDDB = 24 * 60 * 60 * 1000;
const NETWORK_TIMEOUT = 10000; // 10s - assez pour un réseau lent

const PROPERTIES_SELECT = `
  id, name, address, property_type, max_occupancy,
  house_rules, contract_template, user_id, created_at, updated_at,
  airbnb_ics_url, photo_url, description, contact_info
`;

export const useProperties = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const { user } = useAuth();
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);

  const getCacheKey = useCallback(() => {
    return user ? `${CACHE_KEY_PREFIX}${user.id}` : null;
  }, [user]);

  const transformProperties = useCallback((data: any[]): Property[] => {
    return (data || []).map(property => ({
      ...property,
      house_rules: Array.isArray(property.house_rules)
        ? property.house_rules.filter((rule: any) => typeof rule === 'string') as string[]
        : [],
      contract_template: typeof property.contract_template === 'object' && property.contract_template !== null
        ? property.contract_template
        : {},
    }));
  }, []);

  const loadFromNetwork = useCallback(async (signal?: AbortSignal): Promise<Property[] | null> => {
    if (!user) return null;
    const cacheKey = getCacheKey();
    if (!cacheKey) return null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT);

      const { data, error } = await supabase
        .from('properties')
        .select(PROPERTIES_SELECT)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (signal?.aborted) return null;

      if (error) {
        console.warn('[PROPERTIES] Erreur réseau:', error.message);
        return null;
      }

      const transformed = transformProperties(data || []);
      await multiLevelCache.set(cacheKey, transformed, CACHE_TTL_INDEXEDDB);
      return transformed;
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) {
        return null;
      }
      console.warn('[PROPERTIES] Erreur:', err?.message);
      if (mountedRef.current) {
        setNetworkError('Connexion lente au serveur. Veuillez réessayer.');
      }
      return null;
    }
  }, [user, getCacheKey, transformProperties]);

  const loadProperties = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setProperties([]);
      setIsLoading(false);
      return;
    }

    const cacheKey = getCacheKey();
    if (!cacheKey) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (forceRefresh) {
      await multiLevelCache.invalidate(cacheKey);
    }

    // STEP 1: Show cached data immediately
    if (!forceRefresh) {
      try {
        const cached = await multiLevelCache.get<Property[]>(cacheKey);
        if (cached && cached.length > 0 && !controller.signal.aborted) {
          setProperties(cached);
          setIsLoading(false);

          // STEP 2: Refresh in background (non-blocking)
          setIsBackgroundRefreshing(true);
          loadFromNetwork(controller.signal).then(fresh => {
            if (!fresh || controller.signal.aborted || !mountedRef.current) {
              setIsBackgroundRefreshing(false);
              return;
            }
            // Only update if data actually changed (compare IDs + updated_at timestamps)
            const hasChanges = fresh.length !== cached.length ||
              fresh.some((p, i) => p.id !== cached[i]?.id || p.updated_at !== cached[i]?.updated_at);
            if (hasChanges) {
              setProperties(fresh);
            }
            setIsBackgroundRefreshing(false);
          });
          return;
        }
      } catch {
        // Cache miss - continue to network
      }
    }

    // No cache available - load from network (blocking)
    setIsLoading(true);
    setNetworkError(null);

    const networkData = await loadFromNetwork(controller.signal);

    if (controller.signal.aborted || !mountedRef.current) return;

    if (networkData && networkData.length > 0) {
      setProperties(networkData);
    } else {
      // Last resort: try expired cache
      try {
        const expiredCache = await multiLevelCache.getExpired<Property[]>(cacheKey);
        if (expiredCache && expiredCache.length > 0) {
          setProperties(expiredCache);
          toast.info('Affichage des données en cache (connexion lente)');
        } else {
          setProperties([]);
        }
      } catch {
        setProperties([]);
      }
    }
    setIsLoading(false);
  }, [user, getCacheKey, loadFromNetwork]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadProperties();
    } else {
      setProperties([]);
      setIsLoading(false);
    }
  }, [user, loadProperties]);

  // CRUD Operations

  const addProperty = async (property: Omit<Property, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) {
      toast.error('User not authenticated');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('properties')
        .insert([{ ...property, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      const newProperty = transformProperties([data])[0];
      setProperties(prev => [newProperty, ...prev]);

      const cacheKey = getCacheKey();
      if (cacheKey) await multiLevelCache.invalidate(cacheKey);

      toast.success('Propriété ajoutée avec succès');
      return newProperty;
    } catch (error) {
      console.error('Error adding property:', error);
      toast.error("Échec de l'ajout de la propriété");
      return null;
    }
  };

  const updateProperty = async (id: string, updates: Partial<Property>) => {
    try {
      setProperties(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

      const { error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      const cacheKey = getCacheKey();
      if (cacheKey) await multiLevelCache.invalidate(cacheKey);

      toast.success('Propriété mise à jour');
    } catch (error) {
      console.error('Error updating property:', error);
      loadProperties();
      toast.error('Échec de la mise à jour');
    }
  };

  const deleteProperty = async (id: string): Promise<boolean> => {
    if (!user) {
      toast.error('User not authenticated');
      return false;
    }

    try {
      const previousProperties = [...properties];
      setProperties(prev => prev.filter(p => p.id !== id));

      const { data, error } = await supabase.rpc('delete_property_with_reservations', {
        p_property_id: id,
        p_user_id: user.id
      });

      if (error) throw error;

      if (data) {
        const cacheKey = getCacheKey();
        if (cacheKey) await multiLevelCache.invalidate(cacheKey);

        window.dispatchEvent(new CustomEvent('property-deleted', { detail: { propertyId: id } }));
        toast.success('Propriété supprimée avec succès');
        return true;
      } else {
        setProperties(previousProperties);
        toast.error('Propriété non trouvée');
        return false;
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      loadProperties();
      toast.error('Échec de la suppression');
      return false;
    }
  };

  const getPropertyById = (id: string): Property | undefined => {
    return properties.find(property => property.id === id);
  };

  const refreshProperties = useCallback(() => {
    setNetworkError(null);
    retryCountRef.current = 0;
    loadProperties(true);
  }, [loadProperties]);

  const retryLoad = useCallback(async () => {
    setNetworkError(null);
    retryCountRef.current += 1;
    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 8000);
    await new Promise(resolve => setTimeout(resolve, delay));
    loadProperties(true);
  }, [loadProperties]);

  return {
    properties,
    isLoading,
    isBackgroundRefreshing,
    networkError,
    addProperty,
    updateProperty,
    deleteProperty,
    getPropertyById,
    refreshProperties,
    retryLoad,
  };
};
