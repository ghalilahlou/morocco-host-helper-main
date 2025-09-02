// ✅ SYSTÈME DE MONITORING DES ERREURS FRONTEND
// Utilitaire pour détecter et signaler les problèmes de données

export interface DataIntegrityError {
  type: 'missing_property_id' | 'invalid_data' | 'transformation_error';
  context: string;
  details: any;
  timestamp: string;
}

class ErrorMonitor {
  private errors: DataIntegrityError[] = [];
  private maxErrors = 100; // Limite pour éviter la fuite mémoire

  logError(type: DataIntegrityError['type'], context: string, details: any) {
    const error: DataIntegrityError = {
      type,
      context,
      details,
      timestamp: new Date().toISOString()
    };

    this.errors.push(error);
    
    // Limiter le nombre d'erreurs stockées
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log dans la console pour debug
    console.error(`🚨 Data Integrity Error [${type}] in ${context}:`, details);

    // En production, vous pourriez envoyer à un service comme Sentry
    if (process.env.NODE_ENV === 'production') {
      // Exemple : Sentry.captureException(new Error(`${type}: ${context}`), { extra: details });
    }
  }

  validateBooking(booking: any, context: string = 'unknown'): boolean {
    let isValid = true;

    // Vérifier property_id obligatoire
    if (!booking.propertyId && !booking.property_id) {
      this.logError('missing_property_id', context, {
        bookingId: booking.id,
        hasProperty: !!booking.property,
        checkInDate: booking.checkInDate || booking.check_in_date
      });
      isValid = false;
    }

    // Vérifier cohérence des dates
    if (booking.checkInDate && booking.checkOutDate) {
      const checkIn = new Date(booking.checkInDate);
      const checkOut = new Date(booking.checkOutDate);
      if (checkIn >= checkOut) {
        this.logError('invalid_data', context, {
          bookingId: booking.id,
          issue: 'invalid_date_range',
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate
        });
        isValid = false;
      }
    }

    return isValid;
  }

  validateProperty(property: any, context: string = 'unknown'): boolean {
    let isValid = true;

    // Vérifier champs obligatoires
    const requiredFields = ['id', 'name', 'user_id'];
    for (const field of requiredFields) {
      if (!property[field]) {
        this.logError('invalid_data', context, {
          propertyId: property.id || 'unknown',
          missingField: field,
          property: property
        });
        isValid = false;
      }
    }

    return isValid;
  }

  getErrorSummary() {
    const summary = this.errors.reduce((acc, error) => {
      const key = `${error.type}:${error.context}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors: this.errors.length,
      byType: summary,
      recentErrors: this.errors.slice(-10)
    };
  }

  clearErrors() {
    this.errors = [];
  }
}

// Instance singleton
export const errorMonitor = new ErrorMonitor();

// Utilitaires de validation rapide
export const validateBookingData = (booking: any, context?: string) => {
  return errorMonitor.validateBooking(booking, context);
};

export const validatePropertyData = (property: any, context?: string) => {
  return errorMonitor.validateProperty(property, context);
};

export const logDataError = (type: DataIntegrityError['type'], context: string, details: any) => {
  errorMonitor.logError(type, context, details);
};

export const getErrorReport = () => {
  return errorMonitor.getErrorSummary();
};
