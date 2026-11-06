import type { AiGateway, ChatStreamPart } from '@cuelingo/ai-gateway';
import type { AgentStreamEvent } from '@cuelingo/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryConversationsRepository } from '../conversations';
import { createInMemoryPhrasesRepository } from '../review';
import { createInMemoryAgentRepository } from './index';

const as = (user: string) => ({ [TEST_USER_HEADER]: user });
const PAGE = '<p id="q">Quick quiz</p><script>document.title="x"</script>';

const finish = (reason: 'stop' | 'tool_calls'): ChatStreamPart => ({
  type: 'finish',
  reason,
  inputTokens: 100,
  outputTokens: 10,
});

function sseEvents(body: string): AgentStreamEvent[] {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map((block) =>
      JSON.parse(
        block
          .split('\n')
          .find((l) => l.startsWith('data: '))!
          .slice(6),
      ),
    );
}

describe('agent module: AGENT_HTML_BLOCKS', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  /** A model that calls `tool` once with `input`, then answers; remembers the tools it was offered. */
  async function setup(htmlBlocks: boolean | undefined, tool: string, input: unknown) {
    const offered: string[][] = [];
    let step = 0;
    const gateway: Pick<AiGateway, 'chat'> = {
      chat(request) {
        offered.push(request.tools.map((t) => t.name));
        const current = step++;
        return (async function* () {
          if (current === 0) {
            yield { type: 'tool_call', call: { id: 'c1', name: tool, input } } as ChatStreamPart;
            yield finish('tool_calls');
          } else {
            yield { type: 'text_delta', text: 'Xong.' } as ChatStreamPart;
            yield finish('stop');
          }
        })();
      },
    };
    const built = await buildTestApp({
      repos: {
        conversations: createInMemoryConversationsRepository(),
        agent: createInMemoryAgentRepository(),
        phrases: createInMemoryPhrasesRepository(),
      },
      agent: { enabled: true, gateway, htmlBlocks },
    });
    app = built;
    const created = await built.inject({
      method: 'POST',
      url: '/v1/conversations',
      headers: as('alice'),
      payload: {},
    });
    const id = created.json().id as string;
    const res = await built.inject({
      method: 'POST',
      url: `/v1/conversations/${id}/messages`,
      headers: as('alice'),
      payload: { content: 'Make a quiz' },
    });
    const stored = (
      await built.inject({ method: 'GET', url: `/v1/conversations/${id}`, headers: as('alice') })
    ).json();
    return { offered, events: sseEvents(res.body), stored };
  }

  it('offers render_html only when the flag is on, and by default does not', async () => {
    const off = await setup(undefined, 'render_html', { html: PAGE });
    expect(off.offered[0]).not.toContain('render_html');
    // The model asked for a tool it was not given: the turn goes on without a block.
    expect(off.events.some((e) => e.type === 'card')).toBe(false);
    expect(off.events.find((e) => e.type === 'tool_result')).toMatchObject({ ok: false });

    const on = await setup(true, 'render_html', { html: PAGE });
    expect(on.offered[0]).toContain('render_html');
  });

  it('streams an html_block card and stores it with the message when the flag is on', async () => {
    const { events, stored } = await setup(true, 'render_html', { html: PAGE, title: 'Quiz' });
    const card = events.find((e) => e.type === 'card');
    expect(card).toEqual({
      type: 'card',
      card: { kind: 'html_block', data: { title: 'Quiz', html: PAGE } },
    });
    expect(events.at(-1)).toEqual({ type: 'done', status: 'complete' });
    const parts = stored.messages[1].parts as Array<{ type: string; card?: { kind: string } }>;
    expect(parts.find((p) => p.type === 'card')?.card?.kind).toBe('html_block');
  });

  it('rejects a page with network code and shows no block', async () => {
    const { events } = await setup(true, 'render_html', { html: '<script>fetch("/x")</script>' });
    expect(events.some((e) => e.type === 'card')).toBe(false);
    expect(events.find((e) => e.type === 'tool_result')).toMatchObject({
      ok: true,
      summary: 'Chưa tạo được khối giao diện',
    });
  });

  it('does not let show_card smuggle an html_block past the flag', async () => {
    const { events, offered } = await setup(true, 'show_card', {
      kind: 'html_block',
      data: { html: PAGE },
    });
    expect(offered[0]).toContain('show_card');
    expect(events.some((e) => e.type === 'card')).toBe(false);
    expect(events.find((e) => e.type === 'tool_result')).toMatchObject({ ok: false });
  });
});
