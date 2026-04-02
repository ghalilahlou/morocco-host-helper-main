import iso3166 from './iso3166-countries.json';

type IsoRow = { name: string };

/**
 * Noms de pays / territoires ISO 3166 (anglais, source : UN M.49 + dépendances).
 * + synonymes courts pour compatibilité avec l’ancienne liste et la saisie usuelle.
 */
const LEGACY_SYNONYMS: string[] = [
  'United Kingdom',
  'United States',
  'Russia',
  'Czech Republic',
  'Turkey',
  'South Korea',
  'North Korea',
  'Ivory Coast',
];

function buildNationalityList(): string[] {
  const rows = iso3166 as IsoRow[];
  const merged = new Set<string>();
  for (const r of rows) {
    merged.add(r.name);
  }
  for (const s of LEGACY_SYNONYMS) {
    merged.add(s);
  }

  const sorted = [...merged]
    .filter((n) => n !== 'Morocco')
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

  return ['Morocco', '---', ...sorted, 'Other'];
}

export const NATIONALITIES: string[] = buildNationalityList();
