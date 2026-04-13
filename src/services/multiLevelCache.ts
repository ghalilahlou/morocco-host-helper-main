/**
 * Service de cache multi-niveaux pour optimiser les performances
 * 
 * ✅ SOLUTION INNOVANTE : Cache-First Architecture
 * 
 * Architecture :
 * - Level 1: Memory Cache (Map) - TTL court (60s) - Accès instantané
 * - Level 2: IndexedDB - TTL long (24h) - Persistant entre sessions
 * - Level 3: Database Query - Source de vérité (arrière-plan)
 * 
 * Avantages :
 * - Affichage instantané depuis le cache
 * - Fonctionne hors-ligne
 * - Mise à jour transparente en arrière-plan
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MultiLevelCache {
  // Level 1: Memory Cache
  private memoryCache = new Map<string, CacheEntry<any>>();
  private memoryTTL = 60000; // ✅ OPTIMISÉ : 60 secondes (était 30s)

  // Level 2: IndexedDB
  private dbName = 'morocco-host-cache-v2';
  private dbVersion = 2;
  private storeName = 'cache';
  private db: IDBDatabase | null = null;
  private indexedDBTTL = 24 * 60 * 60 * 1000; // ✅ OPTIMISÉ : 24 heures (était 5min)

  /**
   * Initialiser IndexedDB
   */
  private async initIndexedDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.warn('IndexedDB not available, using memory cache only');
        reject(new Error('IndexedDB not available'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Obtenir une valeur du cache (multi-niveaux)
   * @param key - Clé du cache
   * @param allowExpired - Si true, retourne les données même expirées (utile en cas de timeout réseau)
   */
  async get<T>(key: string, allowExpired = false): Promise<T | null> {
    const now = Date.now();

    // ✅ Level 1: Memory cache
    const memory = this.memoryCache.get(key);
    if (memory) {
      const isValid = (now - memory.timestamp) < memory.ttl;
      if (isValid || allowExpired) {
        return memory.data as T;
      }
    }

    // ✅ Level 2: IndexedDB cache
    try {
      const db = await this.initIndexedDB();
      const tx = db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            const isValid = (now - result.timestamp) < result.ttl;
            if (isValid || allowExpired) {
              // ✅ Re-hydrater le cache mémoire
              this.memoryCache.set(key, {
                data: result.data,
                timestamp: result.timestamp,
                ttl: result.ttl
              });
              resolve(result.data as T);
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          resolve(null);
        };
      });
    } catch (error) {
      // IndexedDB non disponible, retourner null
      return null;
    }
  }

  /**
   * ✅ NOUVEAU : Obtenir les données même expirées (fallback en cas de timeout)
   */
  async getExpired<T>(key: string): Promise<T | null> {
    return this.get<T>(key, true);
  }

  /**
   * Mettre une valeur en cache (multi-niveaux)
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const now = Date.now();
    const cacheTTL = ttl || this.memoryTTL;

    // ✅ Level 1: Memory cache
    this.memoryCache.set(key, {
      data,
      timestamp: now,
      ttl: cacheTTL
    });

    // Level 2: IndexedDB cache (only for longer TTLs)
    if (cacheTTL > this.memoryTTL) {
      try {
        const db = await this.initIndexedDB();
        const tx = db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.put({ key, data, timestamp: now, ttl: cacheTTL });
        await new Promise<void>((resolve, reject) => {
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch {
        // IndexedDB not available - memory cache is still active
      }
    }
  }

  /**
   * Invalider une clé du cache
   */
  async invalidate(key: string): Promise<void> {
    // Level 1: Memory cache (synchrone)
    this.memoryCache.delete(key);

    // Level 2: IndexedDB cache (correctement wrappé dans une Promise)
    try {
      const db = await this.initIndexedDB();
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.delete(key);
      await new Promise<void>((resolve) => {
        req.onsuccess = () => resolve();
        req.onerror = () => resolve(); // non-bloquant, on continue quoi qu'il arrive
      });
    } catch {
      // IndexedDB non disponible, ignorer silencieusement
    }
  }

  /**
   * Invalider toutes les clés correspondant à un pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // ✅ Level 1: Memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // ✅ Level 2: IndexedDB cache
    try {
      const db = await this.initIndexedDB();
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.openCursor();

      return new Promise((resolve) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            if (cursor.key.toString().includes(pattern)) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => {
          resolve();
        };
      });
    } catch (error) {
      // IndexedDB non disponible, ignorer silencieusement
    }
  }

  /**
   * Nettoyer le cache (supprimer les entrées expirées)
   */
  async cleanup(): Promise<void> {
    const now = Date.now();

    // ✅ Level 1: Memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.memoryCache.delete(key);
      }
    }

    // ✅ Level 2: IndexedDB cache
    try {
      const db = await this.initIndexedDB();
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.openCursor();

      return new Promise((resolve) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const entry = cursor.value;
            if (now - entry.timestamp >= entry.ttl) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => {
          resolve();
        };
      });
    } catch (error) {
      // IndexedDB non disponible, ignorer silencieusement
    }
  }

  /**
   * Vider complètement le cache
   */
  async clear(): Promise<void> {
    // ✅ Level 1: Memory cache
    this.memoryCache.clear();

    // ✅ Level 2: IndexedDB cache
    try {
      const db = await this.initIndexedDB();
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      await store.clear();
    } catch (error) {
      // IndexedDB non disponible, ignorer silencieusement
    }
  }

  /**
   * Obtenir les statistiques du cache
   */
  getStats(): {
    memorySize: number;
    memoryKeys: string[];
  } {
    return {
      memorySize: this.memoryCache.size,
      memoryKeys: Array.from(this.memoryCache.keys())
    };
  }
}

// ✅ Singleton pour le cache global
export const multiLevelCache = new MultiLevelCache();

// ✅ Nettoyer le cache toutes les 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    multiLevelCache.cleanup();
  }, 5 * 60 * 1000);
}

