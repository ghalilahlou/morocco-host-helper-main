/**
 * Script pour vider le cache des réservations
 * Utilisation : npx tsx scripts/clear-bookings-cache.ts
 */

import { multiLevelCache } from '../src/services/multiLevelCache';

async function clearBookingsCache() {
  console.log('🧹 Nettoyage du cache des réservations...');
  
  try {
    // Invalider tous les caches de réservations
    const patterns = [
      'bookings-',
      'bookings-all-'
    ];
    
    for (const pattern of patterns) {
      await multiLevelCache.invalidatePattern(pattern);
      console.log(`✅ Cache invalidé pour le pattern: ${pattern}`);
    }
    
    // Nettoyer IndexedDB
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      const dbName = 'multiLevelCache';
      const request = indexedDB.deleteDatabase(dbName);
      
      request.onsuccess = () => {
        console.log('✅ IndexedDB nettoyé');
      };
      
      request.onerror = () => {
        console.error('❌ Erreur lors du nettoyage IndexedDB');
      };
    }
    
    console.log('✅ Cache des réservations vidé avec succès!');
    console.log('🔄 Rechargez la page pour voir les réservations.');
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage du cache:', error);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  clearBookingsCache();
}

export { clearBookingsCache };

