import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { describeAssist, describeLevel, PlacementTest } from './placement-test';

const passages = [
  {
    id: 'p1',
    text: 'Hello there.',
    question: 'Họ nói gì?',
    choices: ['Chào', 'Tạm biệt', 'Cảm ơn'],
  },
];

describe('PlacementTest', () => {
  it('shows the first question with every choice and a way to hear it again', () => {
    const markup = renderToStaticMarkup(
      <PlacementTest
        passages={passages}
        loadAudio={async () => new Blob()}
        onSubmit={async () => {
          throw new Error('not used');
        }}
      />,
    );
    expect(markup).toContain('Đoạn 1/1');
    expect(markup).toContain('Họ nói gì?');
    expect(markup).toContain('Tạm biệt');
    expect(markup).toContain('Nghe lại');
    expect(markup).not.toContain('Hello there.');
  });

  it('names levels and assist levels in Vietnamese', () => {
    expect(describeLevel('b2')).toBe('Trung cao (B2)');
    expect(describeAssist(1)).toBe('1 · Tối thiểu');
  });
});
