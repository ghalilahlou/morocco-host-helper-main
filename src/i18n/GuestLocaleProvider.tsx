import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { detectLocale, registerDictionaries, t, type Locale } from './index';
import en from './en';
import fr from './fr';
import es from './es';

// Register initial dictionaries once
registerDictionaries({ en, fr, es });

interface GuestLocaleContextValue {
  locale: Locale;
  setLocale: (loc: Locale) => void;
}

const GuestLocaleContext = createContext<GuestLocaleContextValue | undefined>(undefined);

export const GuestLocaleProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(detectLocale());

  useEffect(() => {
    try {
      localStorage.setItem('guest_locale', locale);
    } catch {
      // Ignore localStorage errors (e.g., in private browsing)
    }
    // Update ?lang in URL without reloading
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', locale);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Ignore URL manipulation errors
    }
  }, [locale]);

  const value = useMemo<GuestLocaleContextValue>(() => ({
    locale,
    setLocale: (loc: Locale) => setLocaleState(loc),
  }), [locale]);

  return (
    <GuestLocaleContext.Provider value={value}>{children}</GuestLocaleContext.Provider>
  );
};

export function useGuestLocale() {
  const ctx = useContext(GuestLocaleContext);
  if (!ctx) throw new Error('useGuestLocale must be used within GuestLocaleProvider');
  return ctx;
}

// Convenience hook to get a locale-bound translate function
export function useT() {
  const { locale } = useGuestLocale();
  return (key: string, vars?: Record<string, string | number>) => t(key, locale, vars);
}
