import { ApiError } from '@cuelingo/core-sdk';
import type { Debrief, SessionDetail, StoredSegment } from '@cuelingo/shared';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  DebriefPageView,
  focusTranscriptSegment,
  SavePhraseButton,
  SpeakerRenameInput,
  visibleBlocks,
} from './DebriefPage';
import {
  buildBlockCopyText,
  countTranscriptSpeakers,
  filterTranscriptSegments,
  transcriptFilterOptions,
} from './content';
import { buildDebriefMarkdown } from './markdown';
import {
  COPY_CONFIRMATION_MS,
  getProcessingStatus,
  LONG_WAIT_MS,
  scheduleClipboardFeedbackClear,
  shouldPollDebrief,
  writeClipboardText,
} from './use-debrief';

const session: SessionDetail = {
  id: '74cd2b16-1bd2-4c46-9ed4-b1f1bc376f31',
  title: 'Weekly sync',
  startedAt: '2026-11-01T08:00:00.000Z',
  endedAt: '2026-11-01T08:30:00.000Z',
  status: 'debriefed',
  assistLevel: 2,
  language: 'en',
  segments: [
    {
      id: '6237275b-4e70-4d79-9622-5ab353cc7725',
      source: 'system',
      startMs: 0,
      endMs: 2_000,
      textEn: 'Let us circle back tomorrow.',
      textVi: 'Ngày mai chúng ta trao đổi lại nhé.',
    },
    {
      id: '7237275b-4e70-4d79-9622-5ab353cc7726',
      source: 'mic',
      startMs: 65_000,
      endMs: 67_000,
      textEn: 'I will send it today.',
      textVi: 'Tôi sẽ gửi hôm nay.',
    },
  ],
  speakers: [],
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
  processingSeconds: 0,
  processingTimedOut: false,
  error: null,
  feedbackBlock: null,
  clipboardFeedback: null,
  savedPhraseKeys: new Set<string>(),
  savingPhraseKey: null,
  phraseKey: (input: { phrase: string; meaningVi?: string }) =>
    `${input.phrase}\u0000${input.meaningVi ?? ''}`,
  onFeedback: vi.fn(),
  onSavePhrase: vi.fn(),
  onCopy: vi.fn(),
  onExport: vi.fn(),
  onRegenerate: vi.fn(),
  deleting: false,
  onDelete: vi.fn(),
};

describe('DebriefPageView follow-up', () => {
  const compose = vi.fn();

  it('offers a collapsed follow-up button when the debrief is ready', () => {
    const markup = renderToStaticMarkup(
      <DebriefPageView {...defaultProps} onComposeFollowup={compose} />,
    );
    expect(markup).toContain('Soạn follow-up');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('Kiểm tra lại trước khi gửi.');
  });

  it.each(['en', 'ja', 'vi'] as const)('offers it for a %s meeting', (language) => {
    const markup = renderToStaticMarkup(
      <DebriefPageView
        {...defaultProps}
        session={{ ...session, language }}
        onComposeFollowup={compose}
      />,
    );
    expect(markup).toContain('Soạn follow-up');
  });

  it('is absent without a ready debrief', () => {
    const markup = renderToStaticMarkup(
      <DebriefPageView {...defaultProps} debrief={undefined} onComposeFollowup={compose} />,
    );
    expect(markup).not.toContain('Soạn follow-up');
  });
});

describe('DebriefPageView', () => {
  it('shows the processing state while a missing debrief is being polled', () => {
    const markup = renderToStaticMarkup(
      <DebriefPageView {...defaultProps} debrief={undefined} processing />,
    );
    expect(markup).toContain('Đang tạo… 0 s');
    expect(markup).toContain('tự kiểm tra lại');
  });

  it('shows the long-wait message and retry action after 90 seconds', () => {
    const markup = renderToStaticMarkup(
      <DebriefPageView
        {...defaultProps}
        debrief={undefined}
        processing
        processingSeconds={90}
        processingTimedOut
      />,
    );
    expect(markup).toContain('Debrief chưa tạo được.');
    expect(markup).toContain('>Tạo lại debrief<');
    expect(markup).not.toContain('Đang tạo…');
  });

  it('shows the regenerate failure next to the button', () => {
    const markup = renderToStaticMarkup(
      <DebriefPageView
        {...defaultProps}
        debrief={undefined}
        processing
        processingTimedOut
        error="Bạn bấm hơi nhanh, đợi một lát rồi thử lại."
      />,
    );
    expect(markup).toContain('Bạn bấm hơi nhanh');
  });

  it('says a live meeting has no debrief yet, with no spinner and no timer', () => {
    const markup = renderToStaticMarkup(
      <DebriefPageView
        {...defaultProps}
        session={{ ...session, status: 'live', endedAt: null }}
        debrief={undefined}
        processing
      />,
    );
    expect(markup).toContain('Cuộc họp này chưa kết thúc. Debrief sẽ có sau khi cuộc họp dừng.');
    expect(markup).not.toContain('Đang tạo…');
    expect(markup).not.toContain('Tạo lại debrief');
  });

  it('says an ended meeting without sentences has no debrief, keeping back and delete', () => {
    const markup = renderToStaticMarkup(
      <DebriefPageView
        {...defaultProps}
        session={{ ...session, status: 'ended', segments: [] }}
        debrief={undefined}
        processing
      />,
    );
    expect(markup).toContain('Cuộc họp này không có câu nào được ghi nên không có debrief.');
    expect(markup).toContain('Quay lại danh sách cuộc họp');
    expect(markup).toContain('Xoá cuộc họp');
    expect(markup).not.toContain('Đang tạo…');
    expect(markup).not.toContain('Tạo lại debrief');
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
    expect(markup).toContain('Tất cả 2');
    expect(markup).toContain('Người khác 1');
    expect(markup).toContain('Tôi 1');
    expect(markup).toContain('Sao chép cả debrief');
    expect(markup.match(/aria-label="Sao chép /g)).toHaveLength(4);
    expect(markup.match(/👍 Hữu ích/g)).toHaveLength(5);
    expect(markup).toContain('Xoá cuộc họp');
  });

  it('shows a Vietnamese meeting without learning blocks, score or translations', () => {
    const viSession: SessionDetail = {
      ...session,
      language: 'vi',
      segments: session.segments.map((segment) => ({ ...segment, textVi: '' })),
    };
    const markup = renderToStaticMarkup(
      <DebriefPageView
        {...defaultProps}
        session={viSession}
        debrief={{ ...debrief, comprehensionPct: null }}
      />,
    );
    expect(markup).toContain('Tóm tắt');
    expect(markup).toContain('Quyết định &amp; việc cần làm');
    for (const heading of ['Đoạn khó', 'Cụm từ nên lưu', 'Câu bạn nói → câu nên nói']) {
      expect(markup).not.toContain(heading);
    }
    expect(markup).not.toContain('Điểm hiểu');
    expect(markup).not.toContain('Chưa có bản dịch');
    expect(markup).not.toContain('song ngữ');
    expect(markup).toContain('Transcript');
    expect(markup).toContain('Let us circle back tomorrow.');
    expect(markup.match(/👍 Hữu ích/g)).toHaveLength(2);
    expect(markup.match(/aria-label="Sao chép /g)).toHaveLength(2);
  });

  it('shows a Korean meeting with the bilingual transcript but no learning blocks or score', () => {
    const koSession: SessionDetail = { ...session, language: 'ko' };
    const markup = renderToStaticMarkup(
      <DebriefPageView
        {...defaultProps}
        session={koSession}
        debrief={{ ...debrief, comprehensionPct: null }}
      />,
    );
    expect(markup).toContain('Transcript song ngữ');
    expect(markup).toContain('Tôi sẽ gửi hôm nay.');
    for (const heading of ['Đoạn khó', 'Cụm từ nên lưu', 'Câu bạn nói → câu nên nói']) {
      expect(markup).not.toContain(heading);
    }
    expect(markup).not.toContain('Điểm hiểu');
    expect(markup.match(/aria-label="Sao chép /g)).toHaveLength(2);
  });

  it('keeps learning blocks and the score for en and ja meetings', () => {
    for (const language of ['en', 'ja'] as const) {
      const markup = renderToStaticMarkup(
        <DebriefPageView {...defaultProps} session={{ ...session, language }} />,
      );
      expect(markup).toContain('Điểm hiểu');
      expect(markup).toContain('Cụm từ nên lưu');
      expect(markup).toContain('Transcript song ngữ');
    }
  });

  it('skips hidden blocks when cycling with J/K', () => {
    expect(visibleBlocks(false)).toEqual(['summary', 'actionItems']);
    expect(visibleBlocks(true)).toHaveLength(5);
  });

  it('shows the saved state for a saved phrase', () => {
    const savedPhraseKeys = new Set(['circle back\u0000trao đổi lại']);
    const markup = renderToStaticMarkup(
      <DebriefPageView {...defaultProps} savedPhraseKeys={savedPhraseKeys} />,
    );
    expect(markup).toContain('>Đã lưu<');
  });

  it('shows clipboard success and blocked-permission feedback near the action', () => {
    const copied = renderToStaticMarkup(
      <DebriefPageView
        {...defaultProps}
        clipboardFeedback={{ key: 'summary', status: 'copied' }}
      />,
    );
    const blocked = renderToStaticMarkup(
      <DebriefPageView {...defaultProps} clipboardFeedback={{ key: 'summary', status: 'error' }} />,
    );
    expect(copied).toContain('Đã sao chép');
    expect(blocked).toContain('Không thể sao chép. Hãy kiểm tra quyền clipboard.');
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

describe('debrief interactions', () => {
  it('filters Tôi to mic segments and counts each speaker', () => {
    expect(countTranscriptSpeakers(session.segments)).toEqual({ all: 2, me: 1, other: 1 });
    expect(filterTranscriptSegments(session.segments, 'me')).toEqual([session.segments[1]]);
    expect(filterTranscriptSegments(session.segments, 'other')).toEqual([session.segments[0]]);
  });

  it('filters by each person of the meeting and keeps older sentences under their source', () => {
    const lan = { id: '11111111-1111-4111-8111-111111111111', label: 'speaker_1' as const };
    const minh = { id: '22222222-2222-4222-8222-222222222222', label: 'speaker_2' as const };
    const speakers = [
      { ...minh, displayName: null },
      { ...lan, displayName: 'Lan' },
    ];
    const [first, second] = session.segments as [StoredSegment, StoredSegment];
    const segments = [
      { ...first, speakerId: lan.id },
      { ...first, id: 'a1111111-1111-4111-8111-111111111111', speakerId: lan.id },
      { ...first, id: 'b1111111-1111-4111-8111-111111111111', speakerId: minh.id },
      second,
      { ...first, id: 'c1111111-1111-4111-8111-111111111111' },
    ];
    const detail = { ...session, segments, speakers };
    expect(countTranscriptSpeakers(segments, speakers)).toEqual({
      all: 5,
      me: 1,
      other: 1,
      [lan.id]: 2,
      [minh.id]: 1,
    });
    expect(transcriptFilterOptions(detail)).toEqual([
      { value: 'all', label: 'Tất cả 5' },
      { value: 'me', label: 'Tôi 1' },
      { value: lan.id, label: 'Lan 2' },
      { value: minh.id, label: 'Speaker 2 1' },
      { value: 'other', label: 'Người khác 1' },
    ]);
    expect(filterTranscriptSegments(segments, lan.id, speakers)).toHaveLength(2);
    expect(filterTranscriptSegments(segments, 'me', speakers)).toEqual([second]);
  });

  it('shows a speaker tag per sentence, renamable only for people of the meeting', () => {
    const lan = { id: '11111111-1111-4111-8111-111111111111', label: 'speaker_1' as const };
    const detail = {
      ...session,
      speakers: [{ ...lan, displayName: 'Lan' }],
      segments: [{ ...session.segments[0]!, speakerId: lan.id }, session.segments[1]!],
    };
    const markup = renderToStaticMarkup(
      <DebriefPageView {...defaultProps} session={detail} onRenameSpeaker={vi.fn()} />,
    );
    expect(markup).toContain('aria-label="Lan, đổi tên người nói"');
    expect(markup.match(/đổi tên người nói/g)).toHaveLength(1);
    expect(markup).toContain('>Tôi<');
  });

  it('offers to rebuild the debrief once after a rename, never by itself', () => {
    const ask = renderToStaticMarkup(<DebriefPageView {...defaultProps} regeneratePrompt="ask" />);
    expect(ask).toContain('Tạo lại debrief với tên mới');
    const waiting = renderToStaticMarkup(
      <DebriefPageView {...defaultProps} regeneratePrompt="waiting" />,
    );
    expect(waiting).not.toContain('Tạo lại debrief với tên mới');
    expect(waiting).toContain('Đang tạo lại debrief với tên mới');
    expect(renderToStaticMarkup(<DebriefPageView {...defaultProps} />)).not.toContain(
      'Tạo lại debrief với tên mới',
    );
    expect(defaultProps.onRegenerate).not.toHaveBeenCalled();
  });

  it('labels the rename field for assistive tech', () => {
    const markup = renderToStaticMarkup(
      <SpeakerRenameInput initial="Lan" fallback="Speaker 1" onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(markup).toContain('aria-label="Tên người nói (Speaker 1)');
    expect(markup).toContain('maxLength="40"');
    expect(markup).toContain('value="Lan"');
  });

  it('scrolls and focuses the requested transcript segment with reduced motion respected', () => {
    const scrollIntoView = vi.fn();
    const focus = vi.fn();
    const root = {
      getElementById: vi.fn(() => ({ scrollIntoView, focus })),
    } as unknown as Pick<Document, 'getElementById'>;

    expect(focusTranscriptSegment(session.segments[0]!.id, root, true)).toBe(true);
    expect(root.getElementById).toHaveBeenCalledWith(`segment-${session.segments[0]!.id}`);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('writes the exact block content to the clipboard and reports a blocked clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const summary = buildBlockCopyText(debrief, 'summary');
    await writeClipboardText(summary, { writeText });
    expect(writeText).toHaveBeenCalledWith('Cập nhật tiến độ\n- Nhóm đã thống nhất phạm vi.');

    await expect(
      writeClipboardText(summary, { writeText: vi.fn().mockRejectedValue(new Error('blocked')) }),
    ).rejects.toThrow('blocked');
  });
});

describe('debrief polling', () => {
  const notFound = new ApiError(404, 'NOT_FOUND', 'Missing');

  it('polls a 404 for less than 90 seconds only', () => {
    expect(shouldPollDebrief(notFound, LONG_WAIT_MS - 1)).toBe(true);
    expect(shouldPollDebrief(notFound, LONG_WAIT_MS)).toBe(false);
    expect(shouldPollDebrief(new ApiError(500, 'INTERNAL_ERROR', 'Failed'), 0)).toBe(false);
  });

  it('changes to the long-wait state after 90 seconds with fake timers', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T08:00:00.000Z'));
    const startedAt = Date.now();
    vi.advanceTimersByTime(LONG_WAIT_MS);
    expect(getProcessingStatus(startedAt)).toEqual({
      elapsedMs: LONG_WAIT_MS,
      seconds: 90,
      timedOut: true,
    });
    vi.useRealTimers();
  });

  it('keeps clipboard confirmation for two seconds', () => {
    vi.useFakeTimers();
    const clear = vi.fn();
    scheduleClipboardFeedbackClear(clear);
    vi.advanceTimersByTime(COPY_CONFIRMATION_MS - 1);
    expect(clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(clear).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

describe('buildDebriefMarkdown', () => {
  it('includes summary, action items, phrases and rephrases', () => {
    const markdown = buildDebriefMarkdown(debrief);
    expect(markdown).toContain('## Tóm tắt');
    expect(markdown).toContain('Gửi bản nháp');
    expect(markdown).toContain('**circle back**');
    expect(markdown).toContain('I will send it to you.');
    expect(markdown).not.toContain('## Transcript song ngữ');
  });

  it('optionally includes the bilingual transcript in chronological order', () => {
    const reversedSession = { ...session, segments: [...session.segments].reverse() };
    const markdown = buildDebriefMarkdown(debrief, {
      session: reversedSession,
      includeTranscript: true,
    });
    expect(markdown).toContain('## Transcript song ngữ');
    expect(markdown).toContain('**00:00 · Người khác**');
    expect(markdown).toContain('**01:05 · Tôi**');
    expect(markdown).toContain('EN: Let us circle back tomorrow.');
    expect(markdown).toContain('VI: Tôi sẽ gửi hôm nay.');
    expect(markdown.indexOf('00:00')).toBeLessThan(markdown.indexOf('01:05'));
  });

  it('names the speakers in the exported transcript', () => {
    const lan = { id: '11111111-1111-4111-8111-111111111111', label: 'speaker_1' as const };
    const markdown = buildDebriefMarkdown(debrief, {
      session: {
        ...session,
        speakers: [{ ...lan, displayName: 'Lan' }],
        segments: [{ ...session.segments[0]!, speakerId: lan.id }, session.segments[1]!],
      },
      includeTranscript: true,
    });
    expect(markdown).toContain('**00:00 · Lan**');
    expect(markdown).toContain('**01:05 · Tôi**');
  });

  it('keeps the translation line but omits learning sections for a Korean meeting', () => {
    const koSession = { ...session, language: 'ko' as const };
    const markdown = buildDebriefMarkdown(debrief, { session: koSession, includeTranscript: true });
    expect(markdown).toContain('## Tóm tắt');
    expect(markdown).not.toContain('Cụm từ nên lưu');
    expect(markdown).not.toContain('Câu bạn nói');
    expect(markdown).toContain('## Transcript song ngữ');
    expect(markdown).toContain('VI: Tôi sẽ gửi hôm nay.');
  });

  it('omits learning sections and the translation line for a Vietnamese meeting', () => {
    const viSession = { ...session, language: 'vi' as const };
    const markdown = buildDebriefMarkdown(debrief, { session: viSession, includeTranscript: true });
    expect(markdown).toContain('## Tóm tắt');
    expect(markdown).toContain('Gửi bản nháp');
    expect(markdown).not.toContain('Cụm từ nên lưu');
    expect(markdown).not.toContain('Câu bạn nói');
    expect(markdown).toContain('## Transcript\n');
    expect(markdown).not.toContain('song ngữ');
    expect(markdown).not.toContain('VI:');
    expect(markdown).toContain('- Let us circle back tomorrow.');
  });
});
