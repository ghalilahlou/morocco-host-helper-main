/**
 * Cache mémoire pour les documents par booking.id
 * Réduit les appels à get-guest-documents-unified (ANALYSE_PERFORMANCE_STORAGE_GUEST_DOCUMENTS.md)
 */

export interface CachedDocumentUrls {
  guestDocuments: { id: string; name: string; url: string; guestName?: string; metadata?: any }[];
  contract: string | null;
  policeForms: { name: string; url: string }[];
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: CachedDocumentUrls;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedDocuments(bookingId: string): CachedDocumentUrls | null {
  const entry = cache.get(bookingId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(bookingId);
    return null;
  }
  return entry.data;
}

export function setCachedDocuments(bookingId: string, data: CachedDocumentUrls): void {
  cache.set(bookingId, { data, timestamp: Date.now() });
}

export function invalidateDocumentsCache(bookingId: string): void {
  cache.delete(bookingId);
}
