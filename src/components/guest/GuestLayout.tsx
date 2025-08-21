import React from 'react';
import LanguageSwitcher from './LanguageSwitcher';

export const GuestLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div className="min-h-screen">
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
