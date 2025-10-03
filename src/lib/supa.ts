// Supabase error handling utilities
import { PostgrestSingleResponse, PostgrestResponse } from '@supabase/supabase-js';

/**
 * Throws an error if the Supabase response contains an error
 * @param response - Supabase response object
 * @returns The data from the response
 */
export async function must<T>(response: PostgrestSingleResponse<T>): Promise<T> {
  if (response.error) {
    throw new Error(`Database error: ${response.error.message} (${response.error.code})`);
  }
  return response.data;
}

/**
 * Throws an error if the Supabase response contains an error (for array responses)
 * @param response - Supabase response object
 * @returns The data from the response
 */
export async function mustArray<T>(response: PostgrestResponse<T>): Promise<T[]> {
  if (response.error) {
    throw new Error(`Database error: ${response.error.message} (${response.error.code})`);
  }
  return response.data || [];
}

/**
 * Safely handles Supabase responses with error logging
 * @param response - Supabase response object
 * @param context - Context for error logging
 * @returns The data or null if error
 */
export function safeResponse<T>(response: PostgrestSingleResponse<T>, context: string): T | null {
  if (response.error) {
    console.error(`❌ ${context}:`, response.error);
    return null;
  }
  return response.data;
}

/**
 * Safely handles Supabase array responses with error logging
 * @param response - Supabase response object
 * @param context - Context for error logging
 * @returns The data array or empty array if error
 */
export function safeArrayResponse<T>(response: PostgrestResponse<T>, context: string): T[] {
  if (response.error) {
    console.error(`❌ ${context}:`, response.error);
    return [];
  }
  return response.data || [];
}