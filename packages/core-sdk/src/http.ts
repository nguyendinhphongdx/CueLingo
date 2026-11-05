import { ErrorResponseSchema, type ErrorCode } from '@cuelingo/shared';
import type { z } from 'zod';

export interface ClientOptions {
  baseUrl: string;
  /** Returns the current access token, or null when signed out. */
  getToken: () => Promise<string | null> | string | null;
  fetch?: typeof fetch;
  /** Browsers: 'include' sends the session cookie to an API on another origin. */
  credentials?: RequestCredentials;
}

/** Error thrown for any non-2xx response; `code` comes from @cuelingo/shared ErrorCode. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export type Http = ReturnType<typeof createHttp>;

export function createHttp(options: ClientOptions) {
  const doFetch = options.fetch ?? fetch;

  async function request<S extends z.ZodType>(
    method: string,
    path: string,
    schema: S | null,
    body?: unknown,
    init?: { signal?: AbortSignal },
  ): Promise<z.output<S>> {
    const token = await options.getToken();
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';

    // The token lookup is async: a request cancelled meanwhile must not be sent at all.
    if (init?.signal?.aborted) throw new ApiError(0, 'NETWORK_ERROR', 'Request aborted');

    let res: Response;
    try {
      res = await doFetch(`${options.baseUrl}${path}`, {
        method,
        headers,
        credentials: options.credentials,
        signal: init?.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new ApiError(0, 'NETWORK_ERROR', (err as Error).message);
    }

    if (!res.ok) {
      const parsed = ErrorResponseSchema.safeParse(await res.json().catch(() => null));
      if (parsed.success) {
        const { code, message, details } = parsed.data.error;
        throw new ApiError(res.status, code, message, details);
      }
      throw new ApiError(res.status, 'INTERNAL_ERROR', `HTTP ${res.status}`);
    }
    // Validate responses too: a contract drift fails loudly here instead of deep in the UI.
    return (schema ? schema.parse(await res.json()) : undefined) as z.output<S>;
  }

  return { request };
}
