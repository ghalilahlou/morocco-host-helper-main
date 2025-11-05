/**
 * Service de cache intelligent pour améliorer les performances
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTtl: number;
  cleanupInterval: number;
}

class OptimizedCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private config: CacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100,
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
      ...config
    };

    this.startCleanupTimer();
  }

  private startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup() {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const isExpired = (now - entry.timestamp) > entry.ttl;
      if (isExpired) {
        entriesToDelete.push(key);
      }
    }

    entriesToDelete.forEach(key => this.cache.delete(key));

    // Si le cache dépasse la taille max, supprimer les entrées les moins utilisées
    if (this.cache.size > this.config.maxSize) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.accessCount - b.accessCount);
      
      const toDelete = sortedEntries.slice(0, this.cache.size - this.config.maxSize);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: ttl || this.config.defaultTtl,
      accessCount: 0,
      lastAccessed: now
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const isExpired = (now - entry.timestamp) > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    // Mettre à jour les statistiques d'accès
    entry.accessCount++;
    entry.lastAccessed = now;

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.values());
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      totalAccessCount: entries.reduce((sum, entry) => sum + entry.accessCount, 0),
      averageAccessCount: entries.length > 0 
        ? entries.reduce((sum, entry) => sum + entry.accessCount, 0) / entries.length 
        : 0,
      expiredEntries: entries.filter(entry => 
        (now - entry.timestamp) > entry.ttl
      ).length
    };
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// Instance globale du cache
export const cacheService = new OptimizedCacheService({
  maxSize: 200,
  defaultTtl: 10 * 60 * 1000, // 10 minutes
  cleanupInterval: 2 * 60 * 1000 // 2 minutes
});

// Hook React pour utiliser le cache
export const useCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    enabled?: boolean;
    refetchOnMount?: boolean;
  } = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const {
    ttl = 10 * 60 * 1000,
    enabled = true,
    refetchOnMount = false
  } = options;

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return;

    // Vérifier le cache d'abord
    if (!force) {
      const cached = cacheService.get<T>(key);
      if (cached) {
        setData(cached);
        return cached;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      cacheService.set(key, result, ttl);
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttl, enabled]);

  const invalidate = useCallback(() => {
    cacheService.delete(key);
    setData(null);
  }, [key]);

  useEffect(() => {
    if (refetchOnMount || !cacheService.has(key)) {
      fetchData();
    } else {
      const cached = cacheService.get<T>(key);
      if (cached) {
        setData(cached);
      }
    }
  }, [key, fetchData, refetchOnMount]);

  return {
    data,
    loading,
    error,
    fetchData,
    invalidate,
    refetch: () => fetchData(true)
  };
};

// Import nécessaire
import { useState, useCallback, useEffect } from 'react';

