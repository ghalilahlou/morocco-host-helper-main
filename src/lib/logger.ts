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
    this.logLevel = import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN;
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
    console.info(this.formatMessage(LogLevel.INFO, message, context));
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
    console.warn(this.formatMessage(LogLevel.WARN, message, context));
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const entry: LogEntry = {
      level: LogLevel.ERROR,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    };

    this.addLog(entry);
    console.error(this.formatMessage(LogLevel.ERROR, message, context), error);
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
