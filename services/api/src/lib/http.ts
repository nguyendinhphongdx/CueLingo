import { ErrorCode } from '@cuelingo/shared';
import { z } from 'zod';
import { AppError } from './errors';

/** Validate untrusted input (body, params, query) against a schema from @cuelingo/shared. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    throw new AppError(ErrorCode.Validation, 'Invalid request', details);
  }
  return result.data;
}

export const IdParamsSchema = z.object({ id: z.uuid() });
