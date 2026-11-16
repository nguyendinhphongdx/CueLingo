import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SpeakableOption } from './speakable-option';
import { VoicePicker } from './voice-picker';

describe('SpeakableOption', () => {
  it('shows the sentence, its note, and both buttons without any selecting first', () => {
    const html = renderToStaticMarkup(
      <SpeakableOption
        text="Could you share the deck?"
        note="Lịch sự, hợp ngữ cảnh họp"
        loadAudio={vi.fn()}
        onCopy={vi.fn()}
      />,
    );
    expect(html).toContain('Could you share the deck?');
    expect(html).toContain('Lịch sự, hợp ngữ cảnh họp');
    expect(html).toContain('aria-label="Nghe thử"');
    expect(html).toContain('aria-label="Sao chép"');
  });
});

describe('VoicePicker', () => {
  it('lists every voice and marks the chosen one', () => {
    const html = renderToStaticMarkup(
      <VoicePicker voice="Puck" onChange={vi.fn()} loadAudio={vi.fn()} />,
    );
    for (const name of ['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir', 'Leda']) {
      expect(html).toContain(name);
    }
    expect(html).toContain('Giọng đọc');
  });
});
