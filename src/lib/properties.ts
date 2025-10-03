// Properties query utilities with defensive error handling
import { SupabaseClient } from '@supabase/supabase-js';
import { safeArrayResponse } from './supa';

export interface Property {
  id: string;
  name: string;
  address?: string;
  is_active?: boolean;
}

/**
 * Safely loads properties with fallback for missing is_active column
 * @param supabase - Supabase client
 * @returns Array of properties
 */
export async function selectActiveProperties(supabase: SupabaseClient): Promise<Property[]> {
  try {
    // First try with is_active column
    const response = await supabase
      .from('properties')
      .select('id, name, address, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });
    
    if (response.error && response.error.code === '42703') {
      // Column doesn't exist, fallback to basic query
      console.warn('⚠️ is_active column not found, using fallback query');
      const fallbackResponse = await supabase
        .from('properties')
        .select('id, name, address')
        .order('name', { ascending: true });
      
      return safeArrayResponse(fallbackResponse, 'Loading properties (fallback)');
    }
    
    return safeArrayResponse(response, 'Loading properties');
  } catch (error) {
    console.error('❌ Error loading properties:', error);
    return [];
  }
}

/**
 * Loads all properties (for admin use)
 * @param supabase - Supabase client
 * @returns Array of all properties
 */
export async function selectAllProperties(supabase: SupabaseClient): Promise<Property[]> {
  try {
    const response = await supabase
      .from('properties')
      .select('id, name, address, is_active')
      .order('name', { ascending: true });
    
    return safeArrayResponse(response, 'Loading all properties');
  } catch (error) {
    console.error('❌ Error loading all properties:', error);
    return [];
  }
}