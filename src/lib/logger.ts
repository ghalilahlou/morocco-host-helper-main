// Centralized logging system to replace console.log usage

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  private constructor() {
    // ✅ SÉCURITÉ : En production, ne montrer QUE les erreurs critiques
    // En développement, tout est visible
    this.logLevel = import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.ERROR;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    let formattedMessage = `[${timestamp}] ${levelName}: ${message}`;

    if (context && Object.keys(context).length > 0) {
      formattedMessage += ` | Context: ${JSON.stringify(context)}`;
    }

    return formattedMessage;
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const entry: LogEntry = {
      level: LogLevel.DEBUG,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    this.addLog(entry);

    if (import.meta.env.DEV) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry: LogEntry = {
      level: LogLevel.INFO,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    this.addLog(entry);
    
    // ✅ SÉCURITÉ : Ne pas afficher les logs info en production
    if (import.meta.env.DEV) {
      console.info(this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const entry: LogEntry = {
      level: LogLevel.WARN,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    this.addLog(entry);
    
    // ✅ SÉCURITÉ : Ne pas afficher les warnings en production (sauf si critiques)
    if (import.meta.env.DEV) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    // ✅ SÉCURITÉ : Masquer les données sensibles dans les erreurs en production
    const sanitizedContext = import.meta.env.DEV 
      ? context 
      : this.sanitizeContext(context);

    const entry: LogEntry = {
      level: LogLevel.ERROR,
      message,
      timestamp: new Date().toISOString(),
      context: sanitizedContext,
      error,
    };

    this.addLog(entry);
    
    // ✅ Les erreurs sont toujours affichées mais avec contexte sanitized en production
    const sanitizedMessage = import.meta.env.DEV 
      ? this.formatMessage(LogLevel.ERROR, message, context)
      : this.formatMessage(LogLevel.ERROR, message, sanitizedContext);
    
    console.error(sanitizedMessage, error);
  }

  // ✅ SÉCURITÉ : Masquer les données sensibles dans les logs de production
  private sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!context) return undefined;

    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'authorization', 'apiKey', 'api_key'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        // Récursif pour les objets imbriqués
        sanitized[key] = this.sanitizeContext(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // Method to get logs for debugging (only in development)
  getLogs(): LogEntry[] {
    if (!import.meta.env.DEV) {
      return [];
    }
    return [...this.logs];
  }

  // Method to clear logs
  clearLogs(): void {
    this.logs = [];
  }

  // Method to set log level
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Convenience functions
export const debug = (message: string, context?: Record<string, unknown>) => logger.debug(message, context);
export const info = (message: string, context?: Record<string, unknown>) => logger.info(message, context);
export const warn = (message: string, context?: Record<string, unknown>) => logger.warn(message, context);
export const error = (message: string, error?: Error, context?: Record<string, unknown>) => logger.error(message, error, context);

// ✅ SÉCURITÉ : Fonction spéciale pour les logs critiques qui doivent toujours être visibles (ex: lien de réservation)
export const critical = (message: string, context?: Record<string, unknown>) => {
  // Toujours afficher les logs critiques, même en production
  console.log(`🔗 ${message}`, context || '');
};
