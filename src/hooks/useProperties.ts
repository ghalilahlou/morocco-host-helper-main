import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/booking';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export const useProperties = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const loadProperties = async () => {
    if (!user) {
      setProperties([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedProperties: Property[] = (data || []).map(property => ({
        ...property,
        house_rules: Array.isArray(property.house_rules) 
          ? property.house_rules.filter(rule => typeof rule === 'string') as string[]
          : [],
        contract_template: typeof property.contract_template === 'object' && property.contract_template !== null 
          ? property.contract_template 
          : {},
      }));

      setProperties(transformedProperties);
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Failed to load properties');
    } finally {
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