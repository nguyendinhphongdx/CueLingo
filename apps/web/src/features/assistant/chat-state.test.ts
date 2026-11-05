import type { AgentStreamEvent, Message } from '@cuelingo/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  applyStreamEvent,
  displayMessages,
  emptyDraft,
  isPendingVisible,
  settleConversation,
  type PendingTurn,
} from './chat-state';

const fold = (events: AgentStreamEvent[]) => events.reduce(applyStreamEvent, emptyDraft());

describe('applyStreamEvent', () => {
  it('joins text deltas into one text part', () => {
    const draft = fold([
      { type: 'status', status: 'thinking' },
      { type: 'text_delta', text: 'Xin ' },
      { type: 'text_delta', text: 'chào' },
    ]);
    expect(draft.parts).toEqual([{ type: 'text', text: 'Xin chào' }]);
    expect(draft.status).toBe('streaming');
  });

  it('shows a tool step as running, then fills in its result', () => {
    const running = fold([{ type: 'tool_call', callId: 'c1', tool: 'save_phrase' }]);
    expect(running.parts).toEqual([
      { type: 'tool_step', callId: 'c1', tool: 'save_phrase', status: 'running' },
    ]);
    const done = applyStreamEvent(running, {
      type: 'tool_result',
      callId: 'c1',
      tool: 'save_phrase',
      ok: true,
      summary: 'Đã lưu',
    });
    expect(done.parts).toEqual([
      { type: 'tool_step', callId: 'c1', tool: 'save_phrase', status: 'ok', summary: 'Đã lưu' },
    ]);
    const failed = fold([{ type: 'tool_result', callId: 'x', tool: 'lookup_word', ok: false }]);
    expect(failed.parts[0]).toMatchObject({ callId: 'x', status: 'error' });
  });

  it('starts a new text part after a tool step or a card', () => {
    const draft = fold([
      { type: 'text_delta', text: 'a' },
      { type: 'tool_call', callId: 'c1', tool: 'show_card' },
      {
        type: 'card',
        card: { kind: 'phrase_list', data: { items: [{ phrase: 'x' }] } },
      },
      { type: 'text_delta', text: 'b' },
    ]);
    expect(draft.parts.map((p) => p.type)).toEqual(['text', 'tool_step', 'card', 'text']);
  });

  it('ends with the done status, and keeps the code of an error that came before it', () => {
    const draft = fold([
      { type: 'error', code: 'AGENT_FAILED' },
      { type: 'done', status: 'error' },
    ]);
    expect(draft).toMatchObject({ status: 'error', errorCode: 'AGENT_FAILED' });
    expect(fold([{ type: 'done', status: 'limited' }]).status).toBe('limited');
  });
});

const ID = '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const msg = (
  seq: number,
  role: 'user' | 'assistant',
  text: string,
  status = 'complete',
): Message => ({
  id: `00000000-0000-4000-8000-00000000000${seq}`,
  conversationId: ID,
  seq,
  role,
  parts: [{ type: 'text', text }],
  status: status as Message['status'],
  createdAt: '2026-11-05T00:00:00.000Z',
});

describe('displayMessages', () => {
  const stored = [msg(0, 'user', 'q1'), msg(1, 'assistant', 'a1')];
  const pending = (over: Partial<PendingTurn> = {}): PendingTurn => ({
    viewId: ID,
    targetId: ID,
    base: stored,
    userText: 'q2',
    draft: emptyDraft(),
    ...over,
  });

  it('shows stored messages when nothing is being sent', () => {
    expect(displayMessages(stored, null, ID).map((m) => m.key)).toEqual(['seq-0', 'seq-1']);
  });

  it('adds the user message at once and the reply as it streams, using the keys the stored ones will have', () => {
    const shown = displayMessages(
      stored,
      pending({ draft: fold([{ type: 'text_delta', text: 'hi' }]) }),
      ID,
    );
    expect(shown.map((m) => [m.key, m.role])).toEqual([
      ['seq-0', 'user'],
      ['seq-1', 'assistant'],
      ['seq-2', 'user'],
      ['seq-3', 'assistant'],
    ]);
    expect(shown[2]?.parts).toEqual([{ type: 'text', text: 'q2' }]);
    expect(shown[3]).toMatchObject({ status: 'streaming', parts: [{ type: 'text', text: 'hi' }] });
  });

  it('ignores messages stored mid-turn by the server (no duplicates)', () => {
    const during = [...stored, msg(2, 'user', 'q2'), msg(3, 'assistant', '', 'streaming')];
    expect(displayMessages(during, pending(), ID)).toHaveLength(4);
  });

  it('starts a brand new chat from zero and follows it to its new address', () => {
    const fresh = pending({ viewId: null, targetId: null, base: [] });
    expect(displayMessages([], fresh, null).map((m) => m.key)).toEqual(['seq-0', 'seq-1']);
    const created = { ...fresh, targetId: ID };
    expect(isPendingVisible(created, null)).toBe(true);
    expect(isPendingVisible(created, ID)).toBe(true);
    expect(isPendingVisible(created, 'other')).toBe(false);
  });

  it('does not show a turn on another conversation', () => {
    expect(displayMessages(stored, pending(), 'other')).toHaveLength(2);
  });
});

describe('settleConversation', () => {
  const sleep = vi.fn().mockResolvedValue(undefined);

  it('reads once when the reply is already final', async () => {
    const read = vi.fn().mockResolvedValue([msg(0, 'user', 'q'), msg(1, 'assistant', 'a')]);
    await settleConversation(read, sleep);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('reads again while the reply still says streaming, then returns the final state', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce([msg(1, 'assistant', 'a', 'streaming')])
      .mockResolvedValueOnce([msg(1, 'assistant', 'a', 'stopped')]);
    const result = await settleConversation(read, sleep);
    expect(read).toHaveBeenCalledTimes(2);
    expect(result?.[0]?.status).toBe('stopped');
  });

  it('gives up after a few reads and returns null when reading fails at once', async () => {
    const stuck = vi.fn().mockResolvedValue([msg(1, 'assistant', 'a', 'streaming')]);
    await settleConversation(stuck, sleep);
    expect(stuck).toHaveBeenCalledTimes(5);
    expect(await settleConversation(vi.fn().mockRejectedValue(new Error('x')), sleep)).toBeNull();
  });
});
