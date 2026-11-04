import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SpeakerTag } from './speaker-tag';

describe('SpeakerTag', () => {
  it('prints the name as text for each kind of speaker', () => {
    expect(renderToStaticMarkup(<SpeakerTag label="me" source="mic" />)).toContain('>Tôi<');
    expect(renderToStaticMarkup(<SpeakerTag label="speaker_2" source="system" />)).toContain(
      '>Speaker 2<',
    );
    expect(
      renderToStaticMarkup(<SpeakerTag label="speaker_2" displayName="Lan" source="system" />),
    ).toContain('>Lan<');
    expect(renderToStaticMarkup(<SpeakerTag source="system" />)).toContain('>Người khác<');
  });

  it('keeps the same colour for the same speaker number', () => {
    const tone = (label: string) =>
      /class="([^"]*)"/.exec(
        renderToStaticMarkup(<SpeakerTag label={label} source="system" />),
      )![1];
    expect(tone('speaker_1')).toBe(tone('speaker_1'));
    expect(tone('speaker_1')).not.toBe(tone('speaker_2'));
  });

  it('is a plain span without onRename and a labelled button with it', () => {
    expect(renderToStaticMarkup(<SpeakerTag label="speaker_1" source="system" />)).not.toContain(
      '<button',
    );
    const markup = renderToStaticMarkup(
      <SpeakerTag label="speaker_1" displayName="Lan" source="system" onRename={() => {}} />,
    );
    expect(markup).toContain('<button');
    expect(markup).toContain('aria-label="Lan, đổi tên người nói"');
  });
});
