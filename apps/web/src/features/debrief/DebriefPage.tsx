'use client';

import { isLanguageCode, SUPPORTED_LANGUAGES, type LanguageCode } from '@cuelingo/shared';
import type {
  Debrief,
  DebriefFeedbackRequest,
  FollowupRequest,
  SavePhraseRequest,
  SessionDetail,
} from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cuelingo/ui/components/card';
import { KeepMounted } from '@cuelingo/ui/components/keep-mounted';
import { FollowupComposer, type FollowupDraft } from '@cuelingo/ui/components/followup-composer';
import { Kbd } from '@cuelingo/ui/components/kbd';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Section } from '@cuelingo/ui/components/section';
import { Segmented } from '@cuelingo/ui/components/segmented';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  buildBlockCopyText,
  countTranscriptSpeakers,
  filterTranscriptSegments,
  type CopyableBlock,
  type TranscriptFilter,
} from './content';
import { SpeakButton } from '@cuelingo/ui/components/speak-button';
import { client } from '../../lib/client';
import { describeFollowupError } from '../../lib/errors';
import { buildDebriefMarkdown } from './markdown';
import { useDebrief, type ClipboardFeedback } from './use-debrief';

type BlockName = DebriefFeedbackRequest['block'];

const BLOCK_ORDER: BlockName[] = [
  'summary',
  'actionItems',
  'hardSegments',
  'phraseSuggestions',
  'rephrase',
];

/** Blocks about learning the language; a meeting in a language nobody studies here has none. */
const LEARNING_BLOCKS: readonly BlockName[] = ['hardSegments', 'phraseSuggestions', 'rephrase'];

/** Whether each sentence of the meeting is translated (the bilingual transcript line). */
export function sessionTranslates(language: string | undefined): boolean {
  return isLanguageCode(language) ? SUPPORTED_LANGUAGES[language as LanguageCode].translates : true;
}

/** Whether the meeting's language is studied here (so it has learning blocks and a score). */
export function sessionLearns(language: string | undefined): boolean {
  return isLanguageCode(language) ? SUPPORTED_LANGUAGES[language as LanguageCode].learnable : true;
}

export function visibleBlocks(learns: boolean): BlockName[] {
  return learns ? BLOCK_ORDER : BLOCK_ORDER.filter((b) => !LEARNING_BLOCKS.includes(b));
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

export function focusTranscriptSegment(
  segmentId: string,
  root: Pick<Document, 'getElementById'> = document,
  reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
): boolean {
  const element = root.getElementById(`segment-${segmentId}`);
  if (!element) return false;
  element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  element.focus({ preventScroll: true });
  return true;
}

function FeedbackButtons({
  block,
  pending,
  value,
  onFeedback,
}: {
  block: BlockName;
  pending: boolean;
  value?: boolean;
  onFeedback: (block: BlockName, useful: boolean) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
      <span className="text-muted-foreground mr-1 text-sm">Khối này có hữu ích không?</span>
      <Button
        variant={value === true ? 'secondary' : 'ghost'}
        className="min-h-11"
        disabled={pending}
        aria-pressed={value === true}
        onClick={() => onFeedback(block, true)}
      >
        👍 Hữu ích
      </Button>
      <Button
        variant={value === false ? 'secondary' : 'ghost'}
        className="min-h-11"
        disabled={pending}
        aria-pressed={value === false}
        onClick={() => onFeedback(block, false)}
      >
        👎 Không hữu ích
      </Button>
    </div>
  );
}

function CopyFeedbackMessage({ feedback }: { feedback?: ClipboardFeedback }) {
  if (!feedback) return null;
  return (
    <span
      role={feedback.status === 'error' ? 'alert' : 'status'}
      className={
        feedback.status === 'error' ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'
      }
    >
      {feedback.status === 'copied'
        ? 'Đã sao chép'
        : 'Không thể sao chép. Hãy kiểm tra quyền clipboard.'}
    </span>
  );
}

function DebriefBlock({
  title,
  block,
  selected,
  feedbackBlock,
  feedbackValue,
  clipboardFeedback,
  copyText,
  onCopy,
  onFeedback,
  setRef,
  onSelect,
  children,
}: {
  title: string;
  block: BlockName;
  selected: boolean;
  feedbackBlock: BlockName | null;
  feedbackValue?: DebriefFeedbackRequest;
  clipboardFeedback?: ClipboardFeedback;
  copyText?: string;
  onCopy: (key: string, text: string) => void;
  onFeedback: (block: BlockName, useful: boolean) => void;
  setRef: (element: HTMLDivElement | null) => void;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <div
      ref={setRef}
      tabIndex={-1}
      data-debrief-block={block}
      onClick={onSelect}
      onFocusCapture={onSelect}
      className={`scroll-mt-4 rounded-xl outline-none ${selected ? 'ring-ring ring-2 ring-offset-2' : ''}`}
    >
      <Section title={title}>
        <Card>
          <CardContent className="pt-6">
            {copyText !== undefined && (
              <div className="mb-4 flex min-h-11 flex-wrap items-center justify-end gap-2 border-b pb-3">
                <CopyFeedbackMessage feedback={clipboardFeedback} />
                <Button
                  variant="outline"
                  className="min-h-11"
                  aria-label={`Sao chép ${title.toLocaleLowerCase('vi')}`}
                  onClick={() => onCopy(block, copyText)}
                >
                  Sao chép
                </Button>
              </div>
            )}
            {children}
            <FeedbackButtons
              block={block}
              pending={feedbackBlock === block}
              value={feedbackValue?.block === block ? feedbackValue.useful : undefined}
              onFeedback={onFeedback}
            />
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}

export interface DebriefPageViewProps {
  session?: SessionDetail;
  debrief?: Debrief;
  loading: boolean;
  processing: boolean;
  processingSeconds: number;
  processingTimedOut: boolean;
  error: string | null;
  feedbackBlock: BlockName | null;
  feedbackValue?: DebriefFeedbackRequest;
  clipboardFeedback: ClipboardFeedback | null;
  savedPhraseKeys: ReadonlySet<string>;
  savingPhraseKey: string | null;
  phraseKey: (input: Pick<SavePhraseRequest, 'phrase' | 'meaningVi'>) => string;
  onFeedback: (block: BlockName, useful: boolean) => void;
  onSavePhrase: (input: SavePhraseRequest) => void;
  onCopy: (key: string, text: string) => void;
  onExport: (includeTranscript: boolean) => void;
  onRetry: () => void;
  deleting: boolean;
  onDelete: () => void;
  /** Drafts a follow-up message for this meeting; the section is hidden without it. */
  onComposeFollowup?: (input: FollowupRequest) => Promise<FollowupDraft>;
}

export function SavePhraseButton({
  input,
  saved,
  saving,
  onSave,
}: {
  input: SavePhraseRequest;
  saved: boolean;
  saving: boolean;
  onSave: (input: SavePhraseRequest) => void;
}) {
  return (
    <Button
      variant="outline"
      className="min-h-11 shrink-0"
      disabled={saved || saving}
      onClick={() => onSave(input)}
    >
      {saved ? 'Đã lưu' : saving ? 'Đang lưu…' : 'Lưu'}
    </Button>
  );
}

export function DebriefPageView({
  session,
  debrief,
  loading,
  processing,
  processingSeconds,
  processingTimedOut,
  error,
  feedbackBlock,
  feedbackValue,
  clipboardFeedback,
  savedPhraseKeys,
  savingPhraseKey,
  phraseKey,
  onFeedback,
  onSavePhrase,
  onCopy,
  onExport,
  onRetry,
  deleting,
  onDelete,
  onComposeFollowup,
}: DebriefPageViewProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [transcriptFilter, setTranscriptFilter] = useState<TranscriptFilter>('all');
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);
  const blockRefs = useRef<Array<HTMLDivElement | null>>([]);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const translates = sessionTranslates(session?.language);
  const learns = sessionLearns(session?.language);
  const blocks = useMemo(() => visibleBlocks(learns), [learns]);

  const copyTexts = useMemo(() => {
    if (!debrief) return new Map<BlockName, string>();
    return new Map<BlockName, string>(
      (['summary', 'actionItems', 'phraseSuggestions', 'rephrase'] as CopyableBlock[]).map(
        (block) => [block, buildBlockCopyText(debrief, block)],
      ),
    );
  }, [debrief]);

  useEffect(() => {
    if (!debrief) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTypingTarget(event.target)
      )
        return;

      const key = event.key.toLowerCase();
      if (key === 'j' || key === 'k') {
        event.preventDefault();
        const direction = key === 'j' ? 1 : -1;
        const nextIndex = (selectedBlockIndex + direction + blocks.length) % blocks.length;
        setSelectedBlockIndex(nextIndex);
        blockRefs.current[nextIndex]?.focus({ preventScroll: true });
        blockRefs.current[nextIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (key === 'c') {
        const block = blocks[selectedBlockIndex];
        const text = block ? copyTexts.get(block) : undefined;
        if (block && text !== undefined) {
          event.preventDefault();
          onCopy(block, text);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [blocks, copyTexts, debrief, onCopy, selectedBlockIndex]);

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

  if (loading)
    return (
      <>
        <PageHeader title="Chi tiết cuộc họp" />
        <p className="text-muted-foreground text-sm">Đang tải debrief…</p>
      </>
    );

  if (!debrief) {
    return (
      <>
        <PageHeader title="Chi tiết cuộc họp" />
        <Card>
          <CardHeader>
            <CardTitle>
              {processing
                ? processingTimedOut
                  ? 'Lâu hơn bình thường, bạn có thể quay lại sau'
                  : `Đang tạo… ${processingSeconds} s`
                : 'Chưa thể mở debrief'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {processing && !processingTimedOut && (
              <p className="text-muted-foreground text-sm">
                CueLingo đang tổng hợp cuộc họp và sẽ tự kiểm tra lại.
              </p>
            )}
            {processingTimedOut && (
              <Button variant="outline" className="min-h-11" onClick={onRetry}>
                Thử lại
              </Button>
            )}
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <Link
              href="/sessions"
              className="focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Quay lại danh sách cuộc họp
            </Link>
            {!confirmingDelete ? (
              <Button variant="destructive" onClick={() => setConfirmingDelete(true)}>
                Xoá cuộc họp
              </Button>
            ) : (
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Xác nhận xoá cuộc họp"
              >
                <span className="text-sm">Xoá vĩnh viễn?</span>
                <Button variant="destructive" disabled={deleting} onClick={onDelete}>
                  {deleting ? 'Đang xoá…' : 'Xác nhận'}
                </Button>
                <Button
                  variant="outline"
                  disabled={deleting}
                  onClick={() => setConfirmingDelete(false)}
                >
                  Huỷ
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  const hardSegments = debrief.hardSegmentIds.map((id) => ({
    id,
    segment: session?.segments.find((segment) => segment.id === id),
  }));
  const counts = countTranscriptSpeakers(session?.segments ?? []);
  const visibleSegments = filterTranscriptSegments(session?.segments ?? [], transcriptFilter);

  const showSegment = (segmentId: string) => {
    const segment = session?.segments.find((item) => item.id === segmentId);
    if (segment) setTranscriptFilter(segment.source);
    setHighlightedSegmentId(segmentId);
    requestAnimationFrame(() => focusTranscriptSegment(segmentId));
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedSegmentId(null), 1_500);
  };

  const blockProps = (block: BlockName) => {
    const index = blocks.indexOf(block);
    return {
      block,
      selected: selectedBlockIndex === index,
      feedbackBlock,
      feedbackValue,
      clipboardFeedback: clipboardFeedback?.key === block ? clipboardFeedback : undefined,
      copyText: copyTexts.get(block),
      onCopy,
      onFeedback,
      setRef: (element: HTMLDivElement | null) => {
        blockRefs.current[index] = element;
      },
      onSelect: () => setSelectedBlockIndex(index),
    };
  };

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/sessions"
          className="focus-visible:ring-ring mb-2 inline-flex min-h-11 items-center rounded-md text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          ← Cuộc họp
        </Link>
        <PageHeader
          title={session?.title || debrief.summary.headlineVi}
          description={
            learns
              ? `Điểm hiểu: ${
                  debrief.comprehensionPct === null
                    ? 'Chưa đủ dữ liệu'
                    : `${Math.round(debrief.comprehensionPct)}%`
                }`
              : undefined
          }
          action={
            <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
              <CopyFeedbackMessage
                feedback={clipboardFeedback?.key === 'all' ? clipboardFeedback : undefined}
              />
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => onCopy('all', buildDebriefMarkdown(debrief, { session }))}
              >
                Sao chép cả debrief
              </Button>
              {onComposeFollowup && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  aria-expanded={followupOpen}
                  onClick={() => setFollowupOpen((open) => !open)}
                >
                  Soạn follow-up
                </Button>
              )}
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
                <input
                  type="checkbox"
                  checked={includeTranscript}
                  onChange={(event) => setIncludeTranscript(event.target.checked)}
                />
                {translates ? 'Kèm transcript song ngữ' : 'Kèm transcript'}
              </label>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => onExport(includeTranscript)}
              >
                Tải Markdown
              </Button>
              {!confirmingDelete ? (
                <Button
                  variant="destructive"
                  className="min-h-11"
                  onClick={() => setConfirmingDelete(true)}
                >
                  Xoá cuộc họp
                </Button>
              ) : (
                <span
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label="Xác nhận xoá cuộc họp"
                >
                  <span className="text-sm">Xoá vĩnh viễn?</span>
                  <Button variant="destructive" disabled={deleting} onClick={onDelete}>
                    {deleting ? 'Đang xoá…' : 'Xác nhận'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={deleting}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Huỷ
                  </Button>
                </span>
              )}
            </div>
          }
        />
      </div>

      <p className="text-muted-foreground hidden items-center gap-2 text-xs sm:flex">
        Phím tắt: <Kbd>J</Kbd>/<Kbd>K</Kbd> chuyển khối, <Kbd>C</Kbd> sao chép khối đang chọn.
      </p>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {onComposeFollowup && (
        <KeepMounted open={followupOpen}>
          <Section title="Soạn follow-up">
            <Card>
              <CardContent className="pt-6">
                <FollowupComposer
                  onCompose={onComposeFollowup}
                  describeError={describeFollowupError}
                />
              </CardContent>
            </Card>
          </Section>
        </KeepMounted>
      )}

      <DebriefBlock title="Tóm tắt" {...blockProps('summary')}>
        <h2 className="font-medium">{debrief.summary.headlineVi}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {debrief.summary.bulletsVi.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </DebriefBlock>

      <DebriefBlock title="Quyết định & việc cần làm" {...blockProps('actionItems')}>
        {debrief.actionItems.length ? (
          <ul className="space-y-3 text-sm">
            {debrief.actionItems.map((item, index) => (
              <li key={`${item.kind}-${index}`}>
                <strong>{item.kind === 'decision' ? 'Quyết định' : 'Việc cần làm'}:</strong>{' '}
                {item.textVi}
                {item.owner && <span className="text-muted-foreground"> — {item.owner}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Không có mục nào.</p>
        )}
      </DebriefBlock>

      {learns && (
        <DebriefBlock title="Đoạn khó" {...blockProps('hardSegments')}>
          {hardSegments.length ? (
            <ul className="space-y-2">
              {hardSegments.map(({ id, segment }, index) => (
                <li key={id}>
                  <a
                    href={`#segment-${id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      showSegment(id);
                    }}
                    className="focus-visible:ring-ring flex min-h-11 cursor-pointer items-center rounded-md px-2 text-sm underline-offset-4 hover:bg-accent hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {segment?.textEn || `Mở đoạn khó ${index + 1} trong transcript`}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Không có đoạn khó nào.</p>
          )}
        </DebriefBlock>
      )}

      {learns && (
        <DebriefBlock title="Cụm từ nên lưu" {...blockProps('phraseSuggestions')}>
          {debrief.phraseSuggestions.length ? (
            <ul className="divide-y">
              {debrief.phraseSuggestions.map((suggestion) => {
                const input = {
                  phrase: suggestion.phrase,
                  meaningVi: suggestion.meaningVi,
                  sessionId: debrief.sessionId,
                };
                const key = phraseKey(input);
                const saved = savedPhraseKeys.has(key);
                return (
                  <li key={key} className="flex items-start justify-between gap-4 py-3">
                    <span className="min-w-0 text-sm">
                      <strong className="flex items-center gap-1">
                        {suggestion.phrase}
                        <SpeakButton text={suggestion.phrase} loadAudio={client.tts.speak} />
                      </strong>
                      <span className="text-muted-foreground block">{suggestion.meaningVi}</span>
                      {suggestion.exampleEn && (
                        <span className="mt-1 block">{suggestion.exampleEn}</span>
                      )}
                    </span>
                    <SavePhraseButton
                      input={input}
                      saved={saved}
                      saving={savingPhraseKey === key}
                      onSave={onSavePhrase}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Không có cụm từ gợi ý.</p>
          )}
        </DebriefBlock>
      )}

      {learns && (
        <DebriefBlock title="Câu bạn nói → câu nên nói" {...blockProps('rephrase')}>
          {debrief.rephrase.length ? (
            <ul className="space-y-4 text-sm">
              {debrief.rephrase.map((item, index) => (
                <li key={`${item.said}-${index}`}>
                  <p className="text-muted-foreground line-through">{item.said}</p>
                  <p className="mt-1 font-medium">{item.better}</p>
                  {item.noteVi && <p className="text-muted-foreground mt-1">{item.noteVi}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Không có câu gợi ý.</p>
          )}
        </DebriefBlock>
      )}

      <Section
        title={translates ? 'Transcript song ngữ' : 'Transcript'}
        description={`${counts.all} câu · Họ ${counts.system} · Tôi ${counts.mic}`}
      >
        <Card>
          <CardContent className="space-y-5 pt-6">
            <Segmented
              label="Lọc transcript theo người nói"
              value={transcriptFilter}
              onChange={setTranscriptFilter}
              options={[
                { value: 'all', label: `Tất cả ${counts.all}` },
                { value: 'system', label: `Họ ${counts.system}` },
                { value: 'mic', label: `Tôi ${counts.mic}` },
              ]}
            />
            {visibleSegments.length ? (
              <ol className="space-y-4">
                {visibleSegments.map((segment) => (
                  <li
                    key={segment.id}
                    id={`segment-${segment.id}`}
                    tabIndex={-1}
                    className={`scroll-mt-4 rounded-md border-l-4 pl-4 outline-none motion-safe:transition-colors motion-safe:duration-300 ${
                      highlightedSegmentId === segment.id
                        ? 'border-primary bg-accent'
                        : 'border-transparent focus:border-primary focus:bg-accent'
                    }`}
                  >
                    <p className="text-muted-foreground text-xs font-medium">
                      {segment.source === 'mic' ? 'Tôi' : 'Họ'}
                    </p>
                    <p className="mt-1 text-sm">{segment.textEn}</p>
                    {translates && (
                      <p className="text-muted-foreground mt-1 text-sm">
                        {segment.textVi || 'Chưa có bản dịch'}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground text-sm">
                {counts.all
                  ? 'Không có câu nào trong bộ lọc này.'
                  : 'Chưa có transcript cho cuộc họp này.'}
              </p>
            )}
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}

export function DebriefPage({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const state = useDebrief(sessionId, () => router.replace('/sessions'));
  return (
    <DebriefPageView
      session={state.session}
      debrief={state.debrief}
      loading={state.loading}
      processing={state.processing}
      processingSeconds={state.processingSeconds}
      processingTimedOut={state.processingTimedOut}
      error={state.error}
      feedbackBlock={state.feedbackBlock}
      feedbackValue={state.feedbackValue}
      clipboardFeedback={state.clipboardFeedback}
      savedPhraseKeys={state.savedPhraseKeys}
      savingPhraseKey={state.savingPhraseKey}
      phraseKey={state.phraseKey}
      onFeedback={state.sendFeedback}
      onSavePhrase={(input) => void state.savePhrase(input)}
      onCopy={(key, text) => void state.copyText(key, text)}
      onExport={state.exportMarkdown}
      onRetry={state.retryDebrief}
      deleting={state.deleting}
      onDelete={state.deleteSession}
      onComposeFollowup={(input) => client.followup(sessionId, input)}
    />
  );
}
