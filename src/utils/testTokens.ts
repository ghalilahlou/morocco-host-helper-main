// Utilitaire pour la gestion des tokens de test
// Permet d'utiliser des tokens par défaut en période de développement

export interface TestToken {
  token: string;
  propertyId: string;
  propertyName: string;
  isActive: boolean;
  description: string;
}

// Tokens de test par défaut
export const DEFAULT_TEST_TOKENS: TestToken[] = [
  {
    token: 'test-token-001',
    propertyId: 'test-property-001',
    propertyName: 'Villa Test - Marrakech',
    isActive: true,
    description: 'Token de test pour Villa Marrakech'
  },
  {
    token: 'test-token-002', 
    propertyId: 'test-property-002',
    propertyName: 'Appartement Test - Casablanca',
    isActive: true,
    description: 'Token de test pour Appartement Casablanca'
  },
  {
    token: 'dev-token-123',
    propertyId: 'dev-property-123',
    propertyName: 'Propriété de Développement',
    isActive: true,
    description: 'Token de développement'
  }
];

// Fonction pour vérifier si un token est un token de test
export const isTestToken = (token: string): boolean => {
  return DEFAULT_TEST_TOKENS.some(testToken => testToken.token === token);
};

// Fonction pour obtenir les données d'un token de test
export const getTestTokenData = (token: string): TestToken | null => {
  return DEFAULT_TEST_TOKENS.find(testToken => testToken.token === token) || null;
};

// Fonction pour créer un token de test dynamique
export const createTestToken = (propertyId: string, propertyName: string): TestToken => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  
  return {
    token: `test-${timestamp}-${randomId}`,
    propertyId,
    propertyName,
    isActive: true,
    description: `Token de test généré automatiquement pour ${propertyName}`
  };
};

// Fonction pour valider un token (test ou réel)
export const validateToken = async (token: string, propertyId: string): Promise<{
  isValid: boolean;
  isTestToken: boolean;
  tokenData?: any;
  error?: string;
}> => {
  // Vérifier d'abord si c'est un token de test
  if (isTestToken(token)) {
    const testTokenData = getTestTokenData(token);
    if (testTokenData && testTokenData.isActive) {
      return {
        isValid: true,
        isTestToken: true,
        tokenData: {
          id: testTokenData.token,
          token: testTokenData.token,
          property_id: testTokenData.propertyId,
          is_active: true,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 jours
        }
      };
    }
  }

  // Si ce n'est pas un token de test, retourner false
  // Le frontend devra alors utiliser l'edge function normale
  return {
    isValid: false,
    isTestToken: false,
    error: 'Token non reconnu comme token de test'
  };
};

// Configuration pour activer/désactiver les tokens de test
export const TEST_TOKENS_CONFIG = {
  enabled: true, // Mettre à false en production
  allowAllTokens: false, // Si true, accepte tous les tokens
  logTestUsage: true // Log l'utilisation des tokens de test
};

// Fonction pour logger l'utilisation des tokens de test
export const logTestTokenUsage = (token: string, action: string) => {
  if (TEST_TOKENS_CONFIG.logTestUsage) {
    console.log(`🧪 [TEST TOKEN] ${action} - Token: ${token} - Time: ${new Date().toISOString()}`);
  }
};
