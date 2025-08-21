// Centralized error handling system

import React from 'react';
import { logger } from './logger';
import type { SupabaseError } from '@/types/common';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', context?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', 401, true, context);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', context?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', 403, true, context);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', context?: Record<string, unknown>) {
    super(message, 'NOT_FOUND_ERROR', 404, true, context);
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', 500, true, context);
    this.name = 'DatabaseError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network error occurred', context?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', 503, true, context);
    this.name = 'NetworkError';
  }
}

// Error handler for async operations
export const asyncErrorHandler = <T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (err) {
      handleError(err);
      throw err;
    }
  };
};

// Central error handling function
export const handleError = (err: unknown, context?: Record<string, unknown>): void => {
  if (err instanceof AppError) {
    logger.error(err.message, err, { ...err.context, ...context });
    return;
  }

  if (err instanceof Error) {
    logger.error(err.message, err, context);
    return;
  }

  // Handle Supabase errors
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const supabaseError = err as SupabaseError;
    logger.error(supabaseError.message, new Error(supabaseError.message), {
      details: supabaseError.details,
      hint: supabaseError.hint,
      code: supabaseError.code,
      ...context,
    });
    return;
  }

  // Handle unknown errors
  logger.error('Unknown error occurred', new Error('Unknown error'), {
    error: err,
    ...context,
  });
};

// Error boundary for React components
export const createErrorBoundary = (fallback: React.ComponentType<{ error: Error }>) => {
  return class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
  > {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      handleError(error, {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      });
    }

    render() {
      if (this.state.hasError && this.state.error) {
        const FallbackComponent = fallback;
        return React.createElement(FallbackComponent, { error: this.state.error });
      }

      return this.props.children;
    }
  };
};

// Utility function to check if error is operational
export const isOperationalError = (error: unknown): boolean => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

// Utility function to get user-friendly error message
export const getUserFriendlyMessage = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Don't expose internal error messages to users
    return 'Une erreur inattendue s\'est produite. Veuillez réessayer.';
  }

  return 'Une erreur inattendue s\'est produite. Veuillez réessayer.';
};

// Error codes mapping
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UPLOAD_ERROR: 'UPLOAD_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
