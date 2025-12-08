export type Locale = 'fr' | 'en' | 'es';

let dictionaries: Record<Locale, Record<string, string>> = {
  en: {},
  fr: {},
  es: {},
};

export function registerDictionaries(dicts: Partial<Record<Locale, Record<string, string>>>) {
  dictionaries = { ...dictionaries, ...(dicts as any) };
}

export function detectLocale(): Locale {
  try {
    const url = new URL(window.location.href);
    const qp = url.searchParams.get('lang');
    if (qp === 'fr' || qp === 'en' || qp === 'es') return qp;
  } catch {}
  try {
    const stored = localStorage.getItem('guest_locale') as Locale | null;
    if (stored === 'fr' || stored === 'en' || stored === 'es') return stored;
  } catch {}
  const nav = (navigator?.language || navigator?.languages?.[0] || 'fr').toLowerCase();
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('es')) return 'es';
  return 'fr'; // ✅ CORRIGÉ : Français par défaut au lieu de l'anglais
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(.*?)\}\}/g, (_, k) => String(vars[k.trim()] ?? ''));
}

export function t(key: string, locale?: Locale, vars?: Record<string, string | number>): string {
  const loc: Locale = locale || 'fr'; // ✅ CORRIGÉ : Français par défaut
  const value = dictionaries[loc]?.[key] ?? dictionaries['fr']?.[key] ?? dictionaries['en']?.[key] ?? key;
  return interpolate(value, vars);
}
