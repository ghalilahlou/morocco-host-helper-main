import React, { useEffect } from 'react';
import { GuestVerification } from '@/pages/GuestVerification';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { clearStaleSupabaseSessionIfNeeded } from '@/lib/guestSupabaseAuthCleanup';

/**
 * ✅ Wrapper stable pour GuestVerification avec nouveau design Figma
 * Utilise le GuestLocaleProvider global (App.tsx) pour la langue.
 */
export const GuestVerificationPage: React.FC = () => {
  useEffect(() => {
    void clearStaleSupabaseSessionIfNeeded();
  }, []);

  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center">
          <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg border-2 border-red-200">
            <h2 className="text-2xl font-bold text-red-800 mb-4">Une erreur s'est produite</h2>
            <p className="text-red-600 mb-4">
              Le formulaire de vérification a rencontré une erreur. Veuillez rafraîchir la page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Rafraîchir la page
            </button>
          </div>
        </div>
      }
    >
      <GuestVerification />
    </ErrorBoundary>
  );
};

export default GuestVerificationPage;

