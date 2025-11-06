import React from 'react';
import { GuestLocaleProvider } from '@/i18n/GuestLocaleProvider';
import { GuestLayout } from './GuestLayout';
import { GuestVerification } from '@/pages/GuestVerification';

/**
 * ✅ Wrapper stable pour GuestVerification
 * Évite les remontages multiples en encapsulant les providers dans un composant réutilisable
 * 
 * PROBLÈME RÉSOLU:
 * - Avant : React Router créait de nouvelles instances de GuestLocaleProvider à chaque route
 * - Après : Un seul wrapper réutilisable stable
 */
export const GuestVerificationPage: React.FC = () => {
  return (
    <GuestLocaleProvider>
      <GuestLayout>
        <GuestVerification />
      </GuestLayout>
    </GuestLocaleProvider>
  );
};

export default GuestVerificationPage;

