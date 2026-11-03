import { ErrorCode, type ErrorResponse } from '@cuelingo/shared';
import type { FastifyError, FastifyInstance } from 'fastify';

const STATUS: Record<ErrorCode, number> = {
  [ErrorCode.Validation]: 400,
  [ErrorCode.Unauthorized]: 401,
  [ErrorCode.Forbidden]: 403,
  [ErrorCode.NotFound]: 404,
  [ErrorCode.Conflict]: 409,
  [ErrorCode.AssistFailed]: 502,
  [ErrorCode.TtsFailed]: 502,
  [ErrorCode.TranscribeFailed]: 502,
  [ErrorCode.FollowupFailed]: 502,
  [ErrorCode.AudioTooLarge]: 413,
  [ErrorCode.LanguageNotCloud]: 400,
  [ErrorCode.RateLimited]: 429,
  [ErrorCode.Internal]: 500,
  // WebSocket-only codes still need an HTTP status because they share the enum.
  [ErrorCode.WsUnauthorized]: 401,
  [ErrorCode.WsBadMessage]: 400,
  [ErrorCode.WsTranslationFailed]: 502,
};

/** The only error type services throw on purpose. Anything else becomes a 500. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  get status(): number {
    return STATUS[this.code];
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      const body: ErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: request.id,
        },
      };
      return reply.status(error.status).send(body);
    }
    // Fastify's own client errors (malformed JSON, payload too large...).
    if (error.statusCode && error.statusCode < 500) {
      const body: ErrorResponse = {
        error: { code: ErrorCode.Validation, message: error.message, requestId: request.id },
      };
      return reply.status(error.statusCode).send(body);
    }
    request.log.error({ err: error }, 'unhandled error');
    const body: ErrorResponse = {
      error: { code: ErrorCode.Internal, message: 'Internal error', requestId: request.id },
    };
    return reply.status(500).send(body);
  });
}
