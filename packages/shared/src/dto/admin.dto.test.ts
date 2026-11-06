import { describe, expect, it } from 'vitest';
import { AdminAgentStatusSchema, UpdateAdminAgentRequestSchema } from './admin.dto';

describe('admin agent contract', () => {
  it('accepts the global switch or one plugin switch, never both or neither', () => {
    expect(UpdateAdminAgentRequestSchema.safeParse({ enabled: false }).success).toBe(true);
    expect(
      UpdateAdminAgentRequestSchema.safeParse({ plugin: { id: 'exercise', enabled: true } })
        .success,
    ).toBe(true);
    expect(UpdateAdminAgentRequestSchema.safeParse({}).success).toBe(false);
    expect(
      UpdateAdminAgentRequestSchema.safeParse({
        enabled: true,
        plugin: { id: 'core', enabled: true },
      }).success,
    ).toBe(false);
    expect(UpdateAdminAgentRequestSchema.safeParse({ enabled: true, userId: 'x' }).success).toBe(
      false,
    );
  });

  it('describes a plugin with its state, permissions and tools', () => {
    const status = AdminAgentStatusSchema.parse({
      enabled: true,
      available: true,
      plugins: [
        {
          id: 'core',
          version: '1.0.0',
          state: 'disabled',
          permissions: ['lookup'],
          tools: ['lookup_word'],
          disabledBy: 'breaker',
          retryAt: '2026-11-06T10:00:00.000Z',
        },
      ],
    });
    expect(status.plugins[0]?.disabledBy).toBe('breaker');
    expect(
      AdminAgentStatusSchema.safeParse({
        enabled: true,
        available: true,
        plugins: [{ id: 'x', version: '1', state: 'weird', permissions: [], tools: [] }],
      }).success,
    ).toBe(false);
  });
});
