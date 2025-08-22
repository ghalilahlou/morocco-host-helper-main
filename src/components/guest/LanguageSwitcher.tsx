import React from 'react';
import { useGuestLocale } from '@/i18n/GuestLocaleProvider';
import { Button } from '@/components/ui/button';

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useGuestLocale();

  const Item: React.FC<{ code: 'fr' | 'en' | 'es'; label: string }> = ({ code, label }) => (
    <button
      onClick={() => setLocale(code)}
      className={
        'text-xs sm:text-sm px-1 sm:px-2 transition-colors underline-offset-4 ' +
        (locale === code ? 'underline text-foreground' : 'text-muted-foreground hover:text-foreground')
      }
      aria-pressed={locale === code}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Item code="fr" label="FR" />
      <span className="text-muted-foreground/60">|</span>
      <Item code="en" label="EN" />
      <span className="text-muted-foreground/60">|</span>
      <Item code="es" label="ES" />
    </div>
  );
};

export default LanguageSwitcher;
