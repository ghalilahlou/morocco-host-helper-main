import React, { useEffect } from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import { clearStaleSupabaseSessionIfNeeded } from '@/lib/guestSupabaseAuthCleanup';

export const GuestLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  useEffect(() => {
    void clearStaleSupabaseSessionIfNeeded();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-end">
          <LanguageSwitcher />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
};

export default GuestLayout;
