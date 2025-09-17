// ✅ HOOK POUR TESTS DE DEBUG EN DÉVELOPPEMENT
import { useEffect } from 'react';
import { runAllTests } from '@/utils/testDataIntegrity';

export const useDebugTests = (enabled: boolean = false) => {
  useEffect(() => {
    // N'exécuter qu'en mode développement et si activé
    if (process.env.NODE_ENV === 'development' && enabled) {
      console.log('🔧 Mode debug activé - Lancement des tests...');
      
      // Attendre que l'application soit initialisée
      const timeout = setTimeout(() => {
        runAllTests();
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [enabled]);

  // Fonction pour lancer les tests manuellement
  const runTests = () => {
    if (process.env.NODE_ENV === 'development') {
      return runAllTests();
    }
    console.warn('Tests disponibles uniquement en mode développement');
    return false;
  };

  return { runTests };
};
