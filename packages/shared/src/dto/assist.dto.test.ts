import { describe, expect, it } from 'vitest';
import { ComposeRequestSchema, LookupRequestSchema, RecapRequestSchema } from './assist.dto';

describe('assist languages', () => {
  it('rejects Vietnamese for lookup and compose, which only exist for learnable languages', () => {
    expect(
      LookupRequestSchema.safeParse({ term: 'plan', context: 'a plan', language: 'vi' }).success,
    ).toBe(false);
    expect(
      ComposeRequestSchema.safeParse({ intentVi: 'Tôi cần thêm một ngày', language: 'vi' }).success,
    ).toBe(false);
  });

  it('still accepts Japanese for lookup and every enabled language for recap', () => {
    expect(
      LookupRequestSchema.safeParse({ term: '計画', context: '計画を見直す', language: 'ja' })
        .success,
    ).toBe(true);
    for (const language of ['en', 'ja', 'ko', 'zh', 'vi']) {
      expect(
        RecapRequestSchema.safeParse({ sentences: [{ text: 'hello' }], language }).success,
      ).toBe(true);
    }
  });
});
