import type { Export } from '@cuelingo/shared';
import type { PrivacyRepository } from './privacy.repository';

export type PrivacyService = ReturnType<typeof createPrivacyService>;

export function createPrivacyService(repo: PrivacyRepository, now: () => Date = () => new Date()) {
  return {
    deleteMyData(userId: string): Promise<void> {
      return repo.deleteMyData(userId);
    },
    exportMyData(userId: string): Promise<Export> {
      return repo.exportMyData(userId, now());
    },
  };
}
