import { describe, expect, it } from 'vitest';
import { createPartsBuilder } from './parts';

describe('createPartsBuilder', () => {
  it('merges text deltas and updates the tool step in place', () => {
    const b = createPartsBuilder();
    b.apply({ type: 'status', status: 'thinking' });
    b.apply({ type: 'text_delta', text: 'Hel' });
    b.apply({ type: 'text_delta', text: 'lo' });
    b.apply({ type: 'tool_call', callId: 'c1', tool: 'lookup_word' });
    expect(b.parts()[1]).toMatchObject({ type: 'tool_step', status: 'running' });
    b.apply({ type: 'tool_result', callId: 'c1', tool: 'lookup_word', ok: false, summary: 'Lỗi' });
    b.apply({ type: 'card', card: { kind: 'phrase_list', data: { items: [{ phrase: 'x' }] } } });
    b.apply({ type: 'text_delta', text: 'Done' });
    b.apply({ type: 'done', status: 'complete' });
    expect(b.parts()).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'tool_step', callId: 'c1', tool: 'lookup_word', status: 'error', summary: 'Lỗi' },
      { type: 'card', card: { kind: 'phrase_list', data: { items: [{ phrase: 'x' }] } } },
      { type: 'text', text: 'Done' },
    ]);
  });
});
