/**
 * Utilitaires de debug pour le système de contrats
 */

export interface ContractDebugData {
  bookingId: string;
  apiResponse?: any;
  hostData?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    signature_url?: string;
    signature_image_url?: string;
    signature_svg?: string;
  };
  propertyData?: {
    name?: string;
    address?: string;
    city?: string;
    contact_info?: any;
    contract_template?: any;
  };
  contractVariables?: Record<string, any>;
  errors?: string[];
}

/**
 * Logger centralisé pour le debug des contrats
 */
export class ContractDebugLogger {
  private static instance: ContractDebugLogger;
  private debugData: Map<string, ContractDebugData> = new Map();

  static getInstance(): ContractDebugLogger {
    if (!ContractDebugLogger.instance) {
      ContractDebugLogger.instance = new ContractDebugLogger();
    }
    return ContractDebugLogger.instance;
  }

  /**
   * Initialise une session de debug pour un booking
   */
  startDebugSession(bookingId: string): void {
    console.log(`🔍 ContractDebug - Starting debug session for booking: ${bookingId}`);
    this.debugData.set(bookingId, {
      bookingId,
      errors: []
    });
  }

  /**
   * Log la réponse API
   */
  logApiResponse(bookingId: string, response: any, error?: any): void {
    const data = this.debugData.get(bookingId) || { bookingId, errors: [] };
    data.apiResponse = { response, error };
    
    console.log(`🔍 ContractDebug [${bookingId}] - API Response:`, {
      success: !error,
      hasData: !!response,
      error: error?.message,
      responseKeys: response ? Object.keys(response) : []
    });
    
    if (error) {
      data.errors?.push(`API Error: ${error.message}`);
    }
    
    this.debugData.set(bookingId, data);
  }

  /**
   * Log les données d'hôte récupérées
   */
  logHostData(bookingId: string, hostData: any): void {
    const data = this.debugData.get(bookingId) || { bookingId, errors: [] };
    data.hostData = hostData;
    
    const hasSignature = !!(hostData?.signature_url || hostData?.signature_image_url || hostData?.signature_svg);
    const displayName = this.getHostDisplayName(hostData);
    
    console.log(`🔍 ContractDebug [${bookingId}] - Host Data:`, {
      displayName,
      hasFullName: !!hostData?.full_name,
      hasFirstLastName: !!(hostData?.first_name && hostData?.last_name),
      hasSignature,
      signatureTypes: {
        url: !!hostData?.signature_url,
        imageUrl: !!hostData?.signature_image_url,
        svg: !!hostData?.signature_svg
      }
    });
    
    if (!displayName || displayName === 'Nom non défini') {
      data.errors?.push('Host name not properly defined');
    }
    
    if (!hasSignature) {
      data.errors?.push('No host signature found');
    }
    
    this.debugData.set(bookingId, data);
  }

  /**
   * Log les données de propriété
   */
  logPropertyData(bookingId: string, propertyData: any): void {
    const data = this.debugData.get(bookingId) || { bookingId, errors: [] };
    data.propertyData = propertyData;
    
    console.log(`🔍 ContractDebug [${bookingId}] - Property Data:`, {
      hasName: !!propertyData?.name,
      hasAddress: !!propertyData?.address,
      hasCity: !!propertyData?.city,
      hasContactInfo: !!propertyData?.contact_info,
      contactName: propertyData?.contact_info?.name,
      hasContractTemplate: !!propertyData?.contract_template,
      templateLandlordName: propertyData?.contract_template?.landlord_name
    });
    
    this.debugData.set(bookingId, data);
  }

  /**
   * Log les variables de contrat construites
   */
  logContractVariables(bookingId: string, variables: Record<string, any>): void {
    const data = this.debugData.get(bookingId) || { bookingId, errors: [] };
    data.contractVariables = variables;
    
    console.log(`🔍 ContractDebug [${bookingId}] - Contract Variables:`, {
      HOST_NAME: variables.HOST_NAME || '(vide)',
      PROPERTY_ADDRESS: variables.PROPERTY_ADDRESS || '(vide)',
      PROPERTY_CITY: variables.PROPERTY_CITY || '(vide)',
      HOST_SIGNATURE_STATUS: this.getSignatureStatus(variables),
      variableCount: Object.keys(variables).length,
      allVariables: variables
    });
    
    // Vérifier les variables critiques
    const criticalVars = ['HOST_NAME', 'PROPERTY_ADDRESS'];
    for (const varName of criticalVars) {
      if (!variables[varName] || variables[varName] === 'Propriétaire') {
        data.errors?.push(`Critical variable ${varName} is empty or has default value`);
      }
    }
    
    this.debugData.set(bookingId, data);
  }

  /**
   * Log avant la génération du PDF
   */
  logBeforePdfGeneration(bookingId: string, finalData: any): void {
    console.log(`🔍 ContractDebug [${bookingId}] - Before PDF Generation:`, {
      hostName: finalData.hostName || '(vide)',
      hasHostSignature: !!finalData.hostSignature,
      signatureType: this.getSignatureType(finalData.hostSignature),
      propertyAddress: finalData.propertyAddress || '(vide)',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Obtient le nom d'affichage de l'hôte
   */
  getHostDisplayName(hostData: any): string {
    if (!hostData) return 'Aucune donnée hôte';
    
    const { full_name, first_name, last_name } = hostData;
    
    if (full_name) return full_name;
    if (first_name && last_name) return `${first_name} ${last_name}`;
    if (first_name) return first_name;
    if (last_name) return last_name;
    
    return 'Nom non défini';
  }

  /**
   * Obtient le statut de signature
   */
  private getSignatureStatus(variables: Record<string, any>): string {
    if (variables.HOST_SIGNATURE_URL) return 'URL présente';
    if (variables.HOST_SIGNATURE_IMAGE) return 'Image présente';
    if (variables.HOST_SIGNATURE_SVG) return 'SVG présent';
    return 'Aucune signature';
  }

  /**
   * Obtient le type de signature
   */
  private getSignatureType(signature: any): string {
    if (!signature) return 'Aucune';
    if (typeof signature === 'string') {
      if (signature.startsWith('data:image/svg')) return 'SVG DataURL';
      if (signature.startsWith('data:image/')) return 'Image DataURL';
      if (signature.startsWith('http')) return 'HTTP URL';
      return 'String';
    }
    return typeof signature;
  }

  /**
   * Génère un rapport de debug complet
   */
  generateDebugReport(bookingId: string): ContractDebugData | null {
    const data = this.debugData.get(bookingId);
    if (!data) return null;
    
    console.log(`📋 ContractDebug [${bookingId}] - Debug Report:`, data);
    
    if (data.errors && data.errors.length > 0) {
      console.error(`❌ ContractDebug [${bookingId}] - Errors found:`, data.errors);
    }
    
    return data;
  }

  /**
   * Nettoie les données de debug pour un booking
   */
  clearDebugSession(bookingId: string): void {
    this.debugData.delete(bookingId);
    console.log(`🧹 ContractDebug - Cleared debug session for booking: ${bookingId}`);
  }
}

/**
 * Hook pour utiliser le debug logger dans les composants React
 */
export const useContractDebug = (bookingId: string) => {
  const logger = ContractDebugLogger.getInstance();
  
  return {
    startSession: () => logger.startDebugSession(bookingId),
    logApiResponse: (response: any, error?: any) => logger.logApiResponse(bookingId, response, error),
    logHostData: (hostData: any) => logger.logHostData(bookingId, hostData),
    logPropertyData: (propertyData: any) => logger.logPropertyData(bookingId, propertyData),
    logContractVariables: (variables: Record<string, any>) => logger.logContractVariables(bookingId, variables),
    logBeforePdfGeneration: (finalData: any) => logger.logBeforePdfGeneration(bookingId, finalData),
    generateReport: () => logger.generateDebugReport(bookingId),
    clearSession: () => logger.clearDebugSession(bookingId)
  };
};
