import type { Debrief, SessionDetail } from '@cuelingo/shared';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DebriefPageView, SavePhraseButton } from './DebriefPage';
import { buildDebriefMarkdown } from './markdown';
import { shouldPollDebrief } from './use-debrief';
import { ApiError } from '@cuelingo/core-sdk';

const session: SessionDetail = {
  id: '74cd2b16-1bd2-4c46-9ed4-b1f1bc376f31',
  title: 'Weekly sync',
  startedAt: '2026-11-01T08:00:00.000Z',
  endedAt: '2026-11-01T08:30:00.000Z',
  status: 'debriefed',
  assistLevel: 2,
  segments: [
    {
      id: '6237275b-4e70-4d79-9622-5ab353cc7725',
      source: 'system',
      startMs: 0,
      endMs: 2_000,
      textEn: 'Let us circle back tomorrow.',
      textVi: 'Ngày mai chúng ta trao đổi lại nhé.',
    },
  ],
};

const debrief: Debrief = {
  id: '6c766563-12ff-4220-af5f-a392741dd0a6',
  sessionId: session.id,
  version: 1,
  createdAt: '2026-11-01T09:00:00.000Z',
  summary: { headlineVi: 'Cập nhật tiến độ', bulletsVi: ['Nhóm đã thống nhất phạm vi.'] },
  actionItems: [{ textVi: 'Gửi bản nháp', owner: 'Lan', kind: 'todo' }],
  hardSegmentIds: [session.segments[0]!.id],
  phraseSuggestions: [
    { phrase: 'circle back', meaningVi: 'trao đổi lại', exampleEn: 'Let us circle back.' },
  ],
  rephrase: [{ said: 'I will send for you.', better: 'I will send it to you.' }],
  comprehensionPct: 82,
};

const defaultProps = {
  session,
  debrief,
  loading: false,
  processing: false,
  error: null,
  feedbackBlock: null,
  savedPhraseKeys: new Set<string>(),
  savingPhraseKey: null,
  phraseKey: (input: { phrase: string; meaningVi?: string }) =>
    `${input.phrase}\u0000${input.meaningVi ?? ''}`,
  onFeedback: vi.fn(),
  onSavePhrase: vi.fn(),
  onExport: vi.fn(),
};

describe('DebriefPageView', () => {
  it('shows the processing state while a missing debrief is being polled', () => {
    const markup = renderToStaticMarkup(
      <DebriefPageView {...defaultProps} debrief={undefined} processing />,
    );
    expect(markup).toContain('Đang xử lý debrief…');
    expect(markup).toContain('mỗi 5 giây');
  });

  it('shows all five blocks, comprehension, save action and bilingual transcript', () => {
    const markup = renderToStaticMarkup(<DebriefPageView {...defaultProps} />);
    for (const heading of [
      'Tóm tắt',
      'Quyết định &amp; việc cần làm',
      'Đoạn khó',
      'Cụm từ nên lưu',
      'Câu bạn nói → câu nên nói',
    ]) {
      expect(markup).toContain(heading);
    }
    expect(markup).toContain('82%');
    expect(markup).toContain('>Lưu<');
    expect(markup).toContain('Let us circle back tomorrow.');
    expect(markup).toContain('Ngày mai chúng ta trao đổi lại nhé.');
    expect(markup.match(/👍 Hữu ích/g)).toHaveLength(5);
  });

  it('shows the saved state for a saved phrase', () => {
    const savedPhraseKeys = new Set(['circle back\u0000trao đổi lại']);
    const markup = renderToStaticMarkup(
      <DebriefPageView {...defaultProps} savedPhraseKeys={savedPhraseKeys} />,
    );
    expect(markup).toContain('>Đã lưu<');
  });

  it('passes SavePhraseRequest to the save action when clicked', () => {
    const onSave = vi.fn();
    const input = {
      phrase: 'circle back',
      meaningVi: 'trao đổi lại',
      sessionId: session.id,
    };
    const element = SavePhraseButton({
      input,
      saved: false,
      saving: false,
      onSave,
    }) as ReactElement<{
      onClick: () => void;
    }>;

    element.props.onClick();

    expect(onSave).toHaveBeenCalledWith(input);
  });
});

describe('debrief polling', () => {
  const notFound = new ApiError(404, 'NOT_FOUND', 'Missing');

  it('polls a 404 for less than two minutes only', () => {
    expect(shouldPollDebrief(notFound, 119_999)).toBe(true);
    expect(shouldPollDebrief(notFound, 120_000)).toBe(false);
    expect(shouldPollDebrief(new ApiError(500, 'INTERNAL_ERROR', 'Failed'), 0)).toBe(false);
  });
});

describe('buildDebriefMarkdown', () => {
  it('includes summary, action items, phrases and rephrases', () => {
    const markdown = buildDebriefMarkdown(debrief);
    expect(markdown).toContain('## Tóm tắt');
    expect(markdown).toContain('Gửi bản nháp');
    expect(markdown).toContain('**circle back**');
    expect(markdown).toContain('I will send it to you.');
  });
});
