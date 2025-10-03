/**
 * Client HTTP unifié pour les Edge Functions Supabase
 * Gère timeouts, retries, et mapping des erreurs
 */

interface EdgeClientConfig {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

interface EdgeError {
  code: string;
  message: string;
  details?: any;
}

interface EdgeResponse<T = any> {
  success: boolean;
  data?: T;
  error?: EdgeError;
}

class EdgeClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config: EdgeClientConfig = {}) {
    // Configuration de l'URL de base
    this.baseUrl = config.baseUrl || this.getDefaultBaseUrl();
    this.timeout = config.timeout || 12000; // 12s
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000; // 1s
  }

  private getDefaultBaseUrl(): string {
    // Toujours utiliser l'URL Supabase directement pour éviter les problèmes de proxy
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://csopyblkfyofwkeqqegd.supabase.co';
    console.log('🔧 [EdgeClient] Using Supabase URL:', supabaseUrl);
    
    return `${supabaseUrl}/functions/v1`;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(status: number): boolean {
    // Retry sur les erreurs serveur temporaires
    return status === 502 || status === 503 || status === 504 || status === 408;
  }

  private async fetchWithTimeout(
    url: string, 
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async makeRequest<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<EdgeResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    
    // Headers par défaut
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...options.headers,
    });

    // Ne jamais exposer la service role key côté client
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseAnonKey) {
      headers.set('Authorization', `Bearer ${supabaseAnonKey}`);
      headers.set('apikey', supabaseAnonKey);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🌐 [EdgeClient] Request attempt ${attempt + 1}/${this.maxRetries + 1}: ${options.method || 'GET'} ${url}`);
        console.log(`🔑 [EdgeClient] Using API key:`, supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'MISSING');
        
        const response = await this.fetchWithTimeout(url, {
          ...options,
          headers,
        });

        // Si le status n'est pas retryable ou dernier essai, traiter la réponse
        if (!this.isRetryableError(response.status) || attempt === this.maxRetries) {
          return await this.handleResponse<T>(response);
        }

        console.warn(`⚠️ [EdgeClient] Retryable error ${response.status}, retrying in ${this.retryDelay}ms...`);
        
      } catch (error) {
        lastError = error as Error;
        
        // Timeout ou erreur réseau
        if (attempt === this.maxRetries) {
          console.error(`❌ [EdgeClient] Final attempt failed:`, error);
          break;
        }
        
        console.warn(`⚠️ [EdgeClient] Network error, retrying in ${this.retryDelay}ms...`, error);
      }

      // Attendre avant retry (backoff exponentiel)
      if (attempt < this.maxRetries) {
        await this.sleep(this.retryDelay * Math.pow(2, attempt));
      }
    }

    // Si on arrive ici, toutes les tentatives ont échoué
    throw new Error(`Request failed after ${this.maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  private async handleResponse<T>(response: Response): Promise<EdgeResponse<T>> {
    let data: any;
    
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      console.error('❌ [EdgeClient] Failed to parse response JSON:', parseError);
      throw new Error(`Invalid JSON response: ${parseError.message}`);
    }

    // Si la réponse n'est pas 2xx, traiter comme erreur
    if (!response.ok) {
      const errorMessage = data.error?.message || data.message || `HTTP ${response.status}`;
      const errorCode = data.error?.code || `HTTP_${response.status}`;
      
      console.error(`❌ [EdgeClient] HTTP ${response.status}:`, {
        code: errorCode,
        message: errorMessage,
        details: data.error?.details || data.details
      });

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          details: data.error?.details || data.details
        }
      };
    }

    // Réponse succès
    console.log(`✅ [EdgeClient] Success:`, { success: data.success, hasData: !!data.data });
    
    return {
      success: data.success !== false, // true par défaut si pas spécifié
      data: data.data || data,
      error: data.error || undefined
    };
  }

  /**
   * Effectuer une requête POST
   */
  async post<T>(path: string, body?: any): Promise<EdgeResponse<T>> {
    return this.makeRequest<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Effectuer une requête POST avec FormData (pour upload de fichiers)
   */
  async postFormData<T>(path: string, formData: FormData): Promise<EdgeResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    
    // Headers pour FormData (pas de Content-Type, laissé au navigateur)
    const headers = new Headers();

    // Ajouter l'authentification
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseAnonKey) {
      headers.set('Authorization', `Bearer ${supabaseAnonKey}`);
      headers.set('apikey', supabaseAnonKey);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🌐 [EdgeClient] FormData request attempt ${attempt + 1}/${this.maxRetries + 1}: POST ${url}`);
        console.log(`🔑 [EdgeClient] Using API key:`, supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'MISSING');
        
        const response = await this.fetchWithTimeout(url, {
          method: 'POST',
          headers,
          body: formData,
        });

        // Si le status n'est pas retryable ou dernier essai, traiter la réponse
        if (!this.isRetryableError(response.status) || attempt === this.maxRetries) {
          return await this.handleResponse<T>(response);
        }

        console.warn(`⚠️ [EdgeClient] Retryable error ${response.status}, retrying in ${this.retryDelay}ms...`);
        
      } catch (error) {
        lastError = error as Error;
        
        // Timeout ou erreur réseau
        if (attempt === this.maxRetries) {
          console.error(`❌ [EdgeClient] Final attempt failed:`, error);
          break;
        }
        
        console.warn(`⚠️ [EdgeClient] Network error, retrying in ${this.retryDelay}ms...`, error);
      }

      // Attendre avant retry (backoff exponentiel)
      if (attempt < this.maxRetries) {
        await this.sleep(this.retryDelay * Math.pow(2, attempt));
      }
    }

    // Si on arrive ici, toutes les tentatives ont échoué
    throw new Error(`FormData request failed after ${this.maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Effectuer une requête GET
   */
  async get<T>(path: string): Promise<EdgeResponse<T>> {
    return this.makeRequest<T>(path, {
      method: 'GET',
    });
  }

  /**
   * Effectuer une requête PUT
   */
  async put<T>(path: string, body?: any): Promise<EdgeResponse<T>> {
    return this.makeRequest<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Effectuer une requête DELETE
   */
  async delete<T>(path: string): Promise<EdgeResponse<T>> {
    return this.makeRequest<T>(path, {
      method: 'DELETE',
    });
  }
}

// Instance par défaut
export const edgeClient = new EdgeClient();

// Export des types pour utilisation externe
export type { EdgeClientConfig, EdgeError, EdgeResponse };
