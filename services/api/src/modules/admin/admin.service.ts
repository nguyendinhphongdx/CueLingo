import { ErrorCode, type AdminMetrics } from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { AdminRepository } from './admin.repository';

export type AdminService = ReturnType<typeof createAdminService>;

export function createAdminService(repo: AdminRepository, allowedEmails: readonly string[]) {
  const allowlist = new Set(
    allowedEmails.map((email) => email.trim().toLowerCase()).filter(Boolean),
  );
  async function isAdmin(userId: string): Promise<boolean> {
    const email = await repo.emailForUser(userId);
    return Boolean(email && allowlist.has(email.toLowerCase()));
  }
  return {
    /** The single place the allowlist is read; other modules ask this instead of copying it. */
    isAdmin,
    async metrics(userId: string): Promise<AdminMetrics> {
      if (!(await isAdmin(userId)))
        throw new AppError(ErrorCode.Forbidden, 'Admin access required');
      return repo.metrics(new Date());
    },
  };
}
