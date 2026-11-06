import {
  ErrorCode,
  type AdminAgentStatus,
  type AdminMetrics,
  type UpdateAdminAgentRequest,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { AdminRepository } from './admin.repository';

/** What the admin module needs from the assistant; `modules/agent` provides it, wired in `app.ts`. */
export interface AgentAdminPort {
  status(): Promise<AdminAgentStatus>;
  setEnabled(enabled: boolean): Promise<AdminAgentStatus>;
  setPlugin(id: string, enabled: boolean): Promise<AdminAgentStatus | undefined>;
}

export type AdminService = ReturnType<typeof createAdminService>;

export function createAdminService(
  repo: AdminRepository,
  allowedEmails: readonly string[],
  /** Looked up per call: the assistant is built after the admin module and may be absent. */
  agent: () => AgentAdminPort | undefined = () => undefined,
) {
  const allowlist = new Set(
    allowedEmails.map((email) => email.trim().toLowerCase()).filter(Boolean),
  );
  async function isAdmin(userId: string): Promise<boolean> {
    const email = await repo.emailForUser(userId);
    return Boolean(email && allowlist.has(email.toLowerCase()));
  }
  async function requireAdmin(userId: string): Promise<void> {
    if (!(await isAdmin(userId))) throw new AppError(ErrorCode.Forbidden, 'Admin access required');
  }
  return {
    /** The single place the allowlist is read; other modules ask this instead of copying it. */
    isAdmin,
    async metrics(userId: string): Promise<AdminMetrics> {
      await requireAdmin(userId);
      return repo.metrics(new Date());
    },
    async agentStatus(userId: string): Promise<AdminAgentStatus> {
      await requireAdmin(userId);
      return (await agent()?.status()) ?? { enabled: false, available: false, plugins: [] };
    },
    async updateAgent(userId: string, input: UpdateAdminAgentRequest): Promise<AdminAgentStatus> {
      await requireAdmin(userId);
      const port = agent();
      if (!port) throw new AppError(ErrorCode.NotFound, 'The assistant is not configured');
      if (input.plugin) {
        const status = await port.setPlugin(input.plugin.id, input.plugin.enabled);
        if (!status) throw new AppError(ErrorCode.NotFound, 'Plugin not found');
        return status;
      }
      return port.setEnabled(input.enabled === true);
    },
  };
}
