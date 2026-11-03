import { describe, expect, it } from 'vitest';
import { CreateGlossaryTermSchema, UpdateGlossaryTermSchema } from './glossary.dto';

describe('CreateGlossaryTermSchema', () => {
  it('trims the term and defaults optional fields to null', () => {
    expect(CreateGlossaryTermSchema.parse({ term: '  Sprint review ' })).toEqual({
      term: 'Sprint review',
      translation: null,
      note: null,
      language: 'en',
    });
  });

  it('rejects a language that is not known', () => {
    expect(CreateGlossaryTermSchema.safeParse({ term: 'x', language: 'xx' }).success).toBe(false);
  });

  it('rejects an empty term', () => {
    expect(CreateGlossaryTermSchema.safeParse({ term: '   ' }).success).toBe(false);
  });
});

describe('UpdateGlossaryTermSchema', () => {
  it('accepts a partial update', () => {
    expect(UpdateGlossaryTermSchema.parse({ note: 'tên khách hàng' })).toEqual({
      note: 'tên khách hàng',
    });
  });
});
