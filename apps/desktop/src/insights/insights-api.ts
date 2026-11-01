import { ApiError } from '@cuelingo/core-sdk';
import {
  CreateGlossaryTermSchema,
  ErrorResponseSchema,
  GlossaryTermListSchema,
  GlossaryTermSchema,
  ProgressSchema,
  UpdateGlossaryTermSchema,
  type CreateGlossaryTermInput,
  type GlossaryTerm,
  type Progress,
  type UpdateGlossaryTerm,
} from '@cuelingo/shared';
import type { z } from 'zod';

type Fetch = typeof fetch;

export interface InsightsApi {
  listGlossary(): Promise<GlossaryTerm[]>;
  createGlossary(input: CreateGlossaryTermInput): Promise<GlossaryTerm>;
  updateGlossary(id: string, patch: UpdateGlossaryTerm): Promise<GlossaryTerm>;
  removeGlossary(id: string): Promise<void>;
  getProgress(): Promise<Progress>;
}

interface InsightsApiOptions {
  apiUrl: string;
  token: string;
  fetch?: Fetch;
}

function restUrl(apiUrl: string) {
  return apiUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/$/, '');
}

export function describeInsightsError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'CONFLICT') return 'Thuật ngữ này đã có trong danh sách';
    if (error.code === 'VALIDATION_ERROR') return 'Thông tin chưa hợp lệ, vui lòng kiểm tra lại';
    if (error.code === 'UNAUTHORIZED') return 'Phiên đăng nhập đã hết hạn';
    if (error.code === 'NETWORK_ERROR') return 'Không kết nối được tới máy chủ';
  }
  return 'Đã có lỗi, vui lòng thử lại';
}

export function createInsightsApi({ apiUrl, token, fetch: request = fetch }: InsightsApiOptions) {
  const baseUrl = restUrl(apiUrl);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  async function call<T>(
    method: string,
    path: string,
    schema: z.ZodType<T> | null,
    body?: unknown,
  ): Promise<T> {
    let response: Response;
    try {
      response = await request(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new ApiError(0, 'NETWORK_ERROR', (error as Error).message);
    }

    if (!response.ok) {
      const parsed = ErrorResponseSchema.safeParse(await response.json().catch(() => null));
      if (parsed.success) {
        throw new ApiError(
          response.status,
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.details,
        );
      }
      throw new ApiError(response.status, 'INTERNAL_ERROR', `HTTP ${response.status}`);
    }

    return (schema ? schema.parse(await response.json()) : undefined) as T;
  }

  return {
    async listGlossary() {
      return (await call('GET', '/v1/glossary', GlossaryTermListSchema)).items;
    },
    createGlossary(input: CreateGlossaryTermInput) {
      return call(
        'POST',
        '/v1/glossary',
        GlossaryTermSchema,
        CreateGlossaryTermSchema.parse(input),
      );
    },
    updateGlossary(id: string, patch: UpdateGlossaryTerm) {
      return call(
        'PATCH',
        `/v1/glossary/${id}`,
        GlossaryTermSchema,
        UpdateGlossaryTermSchema.parse(patch),
      );
    },
    async removeGlossary(id: string) {
      await call('DELETE', `/v1/glossary/${id}`, null);
    },
    getProgress() {
      return call('GET', '/v1/progress', ProgressSchema);
    },
  } satisfies InsightsApi;
}

export const insightsApi = createInsightsApi({
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  token: import.meta.env.VITE_REALTIME_TOKEN || 'dev-token',
});
