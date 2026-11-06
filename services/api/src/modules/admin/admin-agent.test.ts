import type { AiGateway } from '@cuelingo/ai-gateway';
import type { AdminAgentStatus } from '@cuelingo/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryConversationsRepository } from '../conversations';
import { createInMemoryAdminRepository } from './admin.repository.memory';

const ADMIN = 'admin-user';
const MEMBER = 'member-user';
const as = (user: string) => ({ [TEST_USER_HEADER]: user });

describe('/v1/admin/agent', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>> | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function setup(options: { agent?: boolean; enabled?: boolean } = {}) {
    const toolNames: string[][] = [];
    const gateway: Pick<AiGateway, 'chat'> = {
      chat(input) {
        toolNames.push((input.tools ?? []).map((tool) => tool.name));
        return (async function* () {
          yield { type: 'text_delta' as const, text: 'ok' };
          yield { type: 'finish' as const, reason: 'stop' as const };
        })();
      },
    };
    const built = await buildTestApp({
      repos: {
        admin: createInMemoryAdminRepository({
          [ADMIN]: 'owner@example.com',
          [MEMBER]: 'member@example.com',
        }),
        conversations: createInMemoryConversationsRepository(),
      },
      adminEmails: ['owner@example.com'],
      agent: options.agent === false ? undefined : { enabled: options.enabled ?? true, gateway },
    });
    app = built;
    const get = (user = ADMIN) =>
      built.inject({ method: 'GET', url: '/v1/admin/agent', headers: as(user) });
    const patch = (payload: object, user = ADMIN) =>
      built.inject({ method: 'PATCH', url: '/v1/admin/agent', headers: as(user), payload });
    const ask = async (user = MEMBER) => {
      const created = await built.inject({
        method: 'POST',
        url: '/v1/conversations',
        headers: as(user),
        payload: {},
      });
      return built.inject({
        method: 'POST',
        url: `/v1/conversations/${created.json().id}/messages`,
        headers: { ...as(user), origin: 'http://localhost:3000' },
        payload: { content: 'hi' },
      });
    };
    return { get, patch, ask, toolNames };
  }

  it('refuses everyone who is not an admin, for both methods', async () => {
    const t = await setup();
    expect((await t.get(MEMBER)).statusCode).toBe(403);
    expect((await t.patch({ enabled: false }, MEMBER)).statusCode).toBe(403);
    // The refused request changed nothing.
    expect(((await t.get()).json() as AdminAgentStatus).enabled).toBe(true);
    expect((await t.ask()).statusCode).toBe(200);
  });

  it('lists the global flag and every plugin with state, version, permissions and tools', async () => {
    const t = await setup();
    const response = await t.get();
    expect(response.statusCode).toBe(200);
    const status = response.json() as AdminAgentStatus;
    expect(status).toMatchObject({ enabled: true, available: true });
    const core = status.plugins.find((plugin) => plugin.id === 'core');
    expect(core).toMatchObject({ state: 'loaded', version: '1.0.0' });
    expect(core?.permissions).toContain('phrases:write');
    expect(core?.tools).toEqual(
      expect.arrayContaining(['lookup_word', 'list_saved_phrases', 'save_phrase', 'show_card']),
    );
  });

  it('turns the whole assistant off and on again from memory (503 AGENT_DISABLED)', async () => {
    const t = await setup();
    const off = await t.patch({ enabled: false });
    expect(off.statusCode).toBe(200);
    expect((off.json() as AdminAgentStatus).enabled).toBe(false);

    const blocked = await t.ask();
    expect(blocked.statusCode).toBe(503);
    expect(blocked.json().error.code).toBe('AGENT_DISABLED');

    await t.patch({ enabled: true });
    expect((await t.ask()).statusCode).toBe(200);
  });

  it('does not turn on an assistant the deploy has off', async () => {
    const t = await setup({ enabled: false });
    const status = (await t.patch({ enabled: true })).json() as AdminAgentStatus;
    expect(status).toMatchObject({ enabled: true, available: false });
    expect((await t.ask()).statusCode).toBe(503);
  });

  it('hides the tools of a disabled plugin from the model and brings them back', async () => {
    const t = await setup();
    const off = (
      await t.patch({ plugin: { id: 'core', enabled: false } })
    ).json() as AdminAgentStatus;
    expect(off.plugins.find((plugin) => plugin.id === 'core')).toMatchObject({
      state: 'disabled',
      disabledBy: 'admin',
    });
    await t.ask();
    expect(t.toolNames.at(-1)).not.toContain('save_phrase');

    await t.patch({ plugin: { id: 'core', enabled: true } });
    await t.ask();
    expect(t.toolNames.at(-1)).toContain('save_phrase');
  });

  it('answers 404 for an unknown plugin and 400 for a bad body', async () => {
    const t = await setup();
    expect((await t.patch({ plugin: { id: 'nope', enabled: false } })).statusCode).toBe(404);
    expect((await t.patch({})).statusCode).toBe(400);
    expect((await t.patch({ enabled: true, userId: 'x' })).statusCode).toBe(400);
  });

  it('reports an unavailable assistant when the module is not configured', async () => {
    const t = await setup({ agent: false });
    expect((await t.get()).json()).toEqual({ enabled: false, available: false, plugins: [] });
    expect((await t.patch({ enabled: true })).statusCode).toBe(404);
  });
});
