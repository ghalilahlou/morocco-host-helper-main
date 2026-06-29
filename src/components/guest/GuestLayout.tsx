import React, { useEffect } from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import { clearStaleSupabaseSessionIfNeeded } from '@/lib/guestSupabaseAuthCleanup';
import { Screen } from '@/components/layout/Screen';
import { Container } from '@/components/layout/Container';

export const GuestLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  useEffect(() => {
    void clearStaleSupabaseSessionIfNeeded();
  }, []);

  return (
    <Screen className="bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="w-full">
        <Container className="py-3 flex items-center justify-end">
          <LanguageSwitcher />
        </Container>
      </header>
      <main>{children}</main>
    </Screen>
  );
};

export default GuestLayout;
