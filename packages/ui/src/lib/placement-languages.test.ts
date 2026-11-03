import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLACEMENT_LANGUAGES, placementChoice } from './placement-languages';

const options = [
  { value: 'en', label: 'Tiếng Anh' },
  { value: 'ja', label: 'Tiếng Nhật' },
];

describe('placementChoice', () => {
  it('drops languages without placement content and falls back to one that has it', () => {
    const choice = placementChoice(options, 'ja');
    expect(choice.options.map((option) => option.value)).toEqual(['en']);
    expect(choice.language).toBe('en');
  });

  it('keeps the current language when it has content', () => {
    expect(placementChoice(options, 'en').language).toBe('en');
  });
});

describe('PLACEMENT_LANGUAGES', () => {
  it('matches the languages the server has placement content for', () => {
    const source = readFileSync(
      new URL(
        '../../../../services/api/src/modules/placement/placement.content.ts',
        import.meta.url,
      ),
      'utf8',
    );
    const body = /const TESTS[^=]*=\s*\{([^}]*)\}/.exec(source)?.[1] ?? '';
    const keys = [...body.matchAll(/\b([a-z]{2})\s*:/g)].map((match) => match[1]);
    expect([...PLACEMENT_LANGUAGES].sort()).toEqual(keys.sort());
  });
});
