/**
 * Account — Hồ sơ của chính người đăng nhập: xem, đổi tên, đóng tài khoản.
 */
import { accountRoutes } from './account.routes';
import { createAccountService } from './account.service';
import type { AccountRepository } from './account.repository';

export function createAccountModule(repo: AccountRepository) {
  const account = createAccountService(repo);
  return { account, routes: accountRoutes(account) };
}

export type { AccountRepository } from './account.repository';
export {
  createInMemoryAccountRepository,
  createPostgresAccountRepository,
} from './account.repository';
