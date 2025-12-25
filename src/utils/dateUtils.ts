/**
 * Utilitaires pour la gestion des dates sans décalage de fuseau horaire
 * Évite les problèmes de décalage d'un jour lors de la conversion de dates YYYY-MM-DD
 */

/**
 * Convertit une chaîne de date YYYY-MM-DD en objet Date en heure locale
 * Évite le décalage d'un jour causé par l'interprétation UTC de new Date()
 * 
 * @param dateString - Date au format YYYY-MM-DD
 * @returns Date object en heure locale (minuit local)
 */
export function parseLocalDate(dateString: string): Date {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error('Invalid date string');
  }
  
  // Extraire les composants de la date
  const parts = dateString.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
  }
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Les mois sont 0-indexés en JavaScript
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date values: ${dateString}`);
  }
  
  // Créer la date en heure locale (évite le décalage UTC)
  return new Date(year, month, day);
}

/**
 * Formate une date en chaîne YYYY-MM-DD en heure locale
 * Évite le décalage d'un jour causé par toISOString() qui utilise UTC
 * 
 * @param date - Date object
 * @returns Date au format YYYY-MM-DD en heure locale
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convertit une date en chaîne YYYY-MM-DD pour stockage en base de données
 * Utilise l'heure locale pour éviter les décalages
 * 
 * @param date - Date object ou chaîne YYYY-MM-DD
 * @returns Date au format YYYY-MM-DD
 */
export function toDateString(date: Date | string): string {
  if (typeof date === 'string') {
    // Si c'est déjà une chaîne, vérifier qu'elle est au bon format
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    // Sinon, essayer de la parser
    const parsed = parseLocalDate(date);
    return formatLocalDate(parsed);
  }
  return formatLocalDate(date);
}

/**
 * ✅ NOUVEAU : Extrait la partie date (YYYY-MM-DD) depuis n'importe quel format
 * Évite le décalage de timezone en extrayant directement la date sans conversion UTC
 * 
 * @param dateValue - Date au format ISO, YYYY-MM-DD, ou Date object
 * @returns Date au format YYYY-MM-DD en heure locale
 * 
 * @example
 * extractDateOnly('2025-12-16T23:00:00.000Z') // '2025-12-16'
 * extractDateOnly('2025-12-16') // '2025-12-16'
 * extractDateOnly(new Date(2025, 11, 16)) // '2025-12-16' (en heure locale)
 */
export function extractDateOnly(dateValue: string | Date | any): string {
  if (typeof dateValue === 'string') {
    // Si format ISO complet (2025-12-16T23:00:00.000Z), extraire juste YYYY-MM-DD
    if (dateValue.includes('T')) {
      return dateValue.split('T')[0];
    }
    // Si déjà YYYY-MM-DD, retourner tel quel
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    // Sinon, essayer de parser
    try {
      return parseLocalDate(dateValue);
    } catch {
      // Si échec, essayer avec new Date puis formater
      const dateObj = new Date(dateValue);
      return formatLocalDate(dateObj);
    }
  }
  
  // Si Date object, utiliser formatLocalDate pour éviter décalage UTC
  const dateObj = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return formatLocalDate(dateObj);
}

