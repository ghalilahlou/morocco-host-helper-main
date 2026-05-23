/** Patterns qui indiquent que la chaîne n'est pas un nom de personne. */
const UNWANTED_NAME_PATTERNS: RegExp[] = [
  /phone\s*number/i,
  /phone/i,
  /address/i,
  /adresse/i,
  /email/i,
  /tel/i,
  /mobile/i,
  /fax/i,
  /^[A-Z0-9]{6,}$/,   // Codes alphanumériques longs
  /^\d+$/,             // Que des chiffres
  /^[A-Z]{2,}\d+$/,   // Combinaisons type "JBFDPhone"
];

/**
 * Nettoie et valide une chaîne censée être un nom de personne.
 *
 * Cas couverts :
 * - URL params (noms encodés, parfois pollution de type « phone number »)
 * - Noms extraits par OCR (multilignes, légendes parasites)
 * - Noms saisis manuellement (espaces multiples, retours à la ligne)
 *
 * @returns Le nom nettoyé, ou `''` si la chaîne n'est pas un nom valide.
 */
export function sanitizeGuestName(raw: string): string {
  if (!raw || raw.trim() === '') return '';

  // Prendre la première ligne non vide (l'OCR peut retourner « NOM\nLÉGENDE »)
  const firstLine = raw
    .split(/[\n\r]+/)
    .map((s) => s.trim())
    .find((s) => s.length > 0) ?? '';

  if (!firstLine) return '';

  for (const pattern of UNWANTED_NAME_PATTERNS) {
    if (pattern.test(firstLine)) return '';
  }

  // Doit contenir au moins une lettre
  if (!/[a-zA-Z]/.test(firstLine)) return '';

  return firstLine.replace(/\s+/g, ' ').trim();
}
