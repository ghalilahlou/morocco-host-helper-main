export class EdgeFunctionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'EdgeFunctionError';
  }
}

export class ValidationError extends EdgeFunctionError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends EdgeFunctionError {
  constructor(message: string, details?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends EdgeFunctionError {
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND_ERROR', 404, details);
    this.name = 'NotFoundError';
  }
}

export function handleError(error: unknown): Response {
  console.error('Error:', error);

  if (error instanceof EdgeFunctionError) {
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      }),
      {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const internalError = new EdgeFunctionError(
    'An internal server error occurred',
    'INTERNAL_SERVER_ERROR',
    500
  );

  return new Response(
    JSON.stringify({
      error: {
        message: internalError.message,
        code: internalError.code
      }
    }),
    {
      status: internalError.statusCode,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}