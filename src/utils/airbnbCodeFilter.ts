// ============================================================================
// UTILITAIRE DE FILTRAGE - Détection des codes Airbnb
// ============================================================================

/**
 * Liste exhaustive des préfixes de codes Airbnb
 */
const AIRBNB_CODE_PREFIXES = [
  'HM', 'CL', 'PN', 'ZN', 'JN', 'UN', 'FN', 'HN', 'KN', 'SN',
  'RM', 'TN', 'VN', 'WN', 'XN', 'YN', 'AN', 'BN', 'CN', 'DN',
  'EN', 'GN', 'LN', 'MN', 'NN', 'ON', 'QN', 'RN'
];

/**
 * Vérifie si une chaîne ressemble à un code Airbnb
 * @param str - La chaîne à vérifier
 * @returns true si c'est un code Airbnb, false sinon
 */
export function isAirbnbCode(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false;
  
  const trimmed = str.trim().toUpperCase();
  
  // ✅ CORRIGÉ : Détecter aussi les booking_reference en format UID: (fallback ICS)
  // Ces entrées sont créées par sync-airbnb-unified quand aucun code Airbnb (HM...) n'est trouvé
  if (trimmed.startsWith('UID:')) return true;
  
  // Vérifier si ça commence par un préfixe Airbnb
  const hasAirbnbPrefix = AIRBNB_CODE_PREFIXES.some(prefix => 
    trimmed.startsWith(prefix)
  );
  
  if (!hasAirbnbPrefix) return false;
  
  // Vérifier le format : 2 lettres + chiffres/lettres (ex: HM9NJPA3)
  const airbnbCodePattern = /^[A-Z]{2}[A-Z0-9]{4,10}$/;
  return airbnbCodePattern.test(trimmed);
}

/**
 * Vérifie si une réservation a un code Airbnb comme référence
 * @param booking - La réservation à vérifier
 * @returns true si la réservation a un code Airbnb
 */
export function hasAirbnbReference(booking: any): boolean {
  if (!booking) return false;
  
  const ref = booking.booking_reference || booking.bookingReference;
  return isAirbnbCode(ref);
}

/**
 * Filtre un tableau de réservations pour exclure celles avec codes Airbnb
 * @param bookings - Tableau de réservations
 * @returns Tableau filtré sans codes Airbnb
 */
export function filterOutAirbnbCodes<T extends { booking_reference?: string; bookingReference?: string }>(
  bookings: T[]
): T[] {
  return bookings.filter(booking => !hasAirbnbReference(booking));
}

/**
 * Génère une clause SQL OR pour filtrer les codes Airbnb
 * @returns Chaîne SQL pour Supabase .or()
 */
export function getAirbnbFilterClause(): string {
  // Exclure tous les préfixes Airbnb
  const conditions = AIRBNB_CODE_PREFIXES.map(prefix => 
    `booking_reference.not.like.${prefix}%`
  );
  
  // Ajouter les cas null et INDEPENDENT_BOOKING
  conditions.unshift('booking_reference.is.null');
  conditions.unshift('booking_reference.eq.INDEPENDENT_BOOKING');
  
  // ✅ CORRIGÉ : Aussi exclure les UID: (fallback ICS quand pas de code Airbnb)
  conditions.push('booking_reference.not.like.UID:%');
  
  return conditions.join(',');
}

/**
 * Logs de débogage pour le filtrage (désactivé en production)
 */
export function logFilteringDebug(_bookings: any[], _context: string) {
  // ✅ OPTIMISATION : Logs désactivés pour améliorer la performance
  // Décommenter pour le debug si nécessaire
  /*
  const airbnbCodes = _bookings.filter(hasAirbnbReference);
  const cleanBookings = _bookings.filter(b => !hasAirbnbReference(b));
  
  console.log(`🔍 [FILTRAGE ${_context}]`, {
    total: _bookings.length,
    airbnbCodes: airbnbCodes.length,
    clean: cleanBookings.length,
    airbnbCodesList: airbnbCodes.map(b => b.booking_reference || b.bookingReference)
  });
  */
}
