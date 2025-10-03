import type { EdgeFunction } from './types';
import runtime from '@/config/runtime';

interface EdgeClientConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

interface EdgeFunctionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class EdgeClient {
  private supabaseUrl: string;
  private supabaseAnonKey: string;

  constructor(config: EdgeClientConfig) {
    this.supabaseUrl = config.supabaseUrl;
    this.supabaseAnonKey = config.supabaseAnonKey;
  }

  private async _fetch<T = unknown>(path: string, options: RequestInit): Promise<EdgeFunctionResponse<T>> {
    const url = `${this.supabaseUrl}/functions/v1${path}`;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.supabaseAnonKey}`,
      'apikey': this.supabaseAnonKey,
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const text = await response.text();

      let data: T | undefined;
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch (jsonError) {
        console.warn("EdgeClient: Failed to parse JSON response", text);
        return { success: false, error: text || "Invalid JSON response" };
      }

      if (!response.ok) {
        const errorBody: { error?: string; message?: string } = data as object;
        return { success: false, error: errorBody.error || errorBody.message || text || "Unknown error" };
      }

      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("EdgeClient: Network or unexpected error", errorMessage);
      return { success: false, error: `Network Error: ${errorMessage}` };
    }
  }

  async get<T = unknown>(path: string, headers?: HeadersInit): Promise<EdgeFunctionResponse<T>> {
    return this._fetch(path, { method: 'GET', headers });
  }

  async post<T = unknown>(path: string, body: object, headers?: HeadersInit): Promise<EdgeFunctionResponse<T>> {
    return this._fetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }
}

export const edgeClient = new EdgeClient({
  supabaseUrl: runtime.env.SUPABASE_URL || '',
  supabaseAnonKey: runtime.env.SUPABASE_ANON_KEY || '',
});

// Pour les Edge Functions Deno, on utilise directement Deno.env.get
// Ce fichier est destiné au frontend/backend Node.js
