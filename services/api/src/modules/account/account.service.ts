import { ErrorCode, type Me } from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { AccountRepository } from './account.repository';

export type AccountService = ReturnType<typeof createAccountService>;

export function createAccountService(repo: AccountRepository) {
  const missing = () => new AppError(ErrorCode.NotFound, 'Account not found');

  return {
    async get(userId: string): Promise<Me> {
      return (await repo.get(userId)) ?? Promise.reject(missing());
    },
    async rename(userId: string, name: string): Promise<Me> {
      return (await repo.updateName(userId, name)) ?? Promise.reject(missing());
    },
    async close(userId: string): Promise<void> {
      if (!(await repo.delete(userId))) throw missing();
    },
  };
}
