import { describe, expect, it } from 'vitest';
import { ExportSchema } from './privacy.dto';

describe('ExportSchema', () => {
  const base = {
    exportedAt: '2026-11-09T09:00:00.000Z',
    sessions: [],
    phrases: [],
    glossaryTerms: [],
  };

  it('reads an export from a server that predates conversations as having none', () => {
    expect(ExportSchema.parse(base).conversations).toEqual([]);
  });

  it('accepts conversations with their messages', () => {
    const id = '0b9b3b2a-8c7e-4d0e-9d6b-3b1a1f5f9a11';
    const parsed = ExportSchema.parse({
      ...base,
      conversations: [
        {
          conversation: {
            id,
            title: 'Họp sprint',
            language: 'en',
            createdAt: base.exportedAt,
            updatedAt: base.exportedAt,
          },
          messages: [
            {
              id: '6f1c2f56-7a50-4c52-8d4e-0f5f8a0f2b22',
              conversationId: id,
              seq: 0,
              role: 'user',
              parts: [{ type: 'text', text: 'hello' }],
              status: 'complete',
              createdAt: base.exportedAt,
            },
          ],
        },
      ],
    });
    expect(parsed.conversations[0]?.messages).toHaveLength(1);
  });
});
