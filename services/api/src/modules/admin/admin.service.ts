import { ErrorCode, type AdminMetrics } from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { AdminRepository } from './admin.repository';

export type AdminService = ReturnType<typeof createAdminService>;

export function createAdminService(repo: AdminRepository, allowedEmails: readonly string[]) {
  const allowlist = new Set(
    allowedEmails.map((email) => email.trim().toLowerCase()).filter(Boolean),
  );
  return {
    async metrics(userId: string): Promise<AdminMetrics> {
      const email = await repo.emailForUser(userId);
      if (!email || !allowlist.has(email.toLowerCase())) {
        throw new AppError(ErrorCode.Forbidden, 'Admin access required');
      }
      return repo.metrics(new Date());
    },
  };
}
