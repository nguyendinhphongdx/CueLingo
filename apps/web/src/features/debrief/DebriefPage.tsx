'use client';

import type {
  Debrief,
  DebriefFeedbackRequest,
  SavePhraseRequest,
  SessionDetail,
} from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cuelingo/ui/components/card';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Section } from '@cuelingo/ui/components/section';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useDebrief } from './use-debrief';

type BlockName = DebriefFeedbackRequest['block'];

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

function DebriefBlock({
  title,
  block,
  feedbackBlock,
  feedbackValue,
  onFeedback,
  children,
}: {
  title: string;
  block: BlockName;
  feedbackBlock: BlockName | null;
  feedbackValue?: DebriefFeedbackRequest;
  onFeedback: (block: BlockName, useful: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Section title={title}>
      <Card>
        <CardContent className="pt-6">
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
  );
}

export interface DebriefPageViewProps {
  session?: SessionDetail;
  debrief?: Debrief;
  loading: boolean;
  processing: boolean;
  error: string | null;
  feedbackBlock: BlockName | null;
  feedbackValue?: DebriefFeedbackRequest;
  savedPhraseKeys: ReadonlySet<string>;
  savingPhraseKey: string | null;
  phraseKey: (input: Pick<SavePhraseRequest, 'phrase' | 'meaningVi'>) => string;
  onFeedback: (block: BlockName, useful: boolean) => void;
  onSavePhrase: (input: SavePhraseRequest) => void;
  onExport: () => void;
  deleting: boolean;
  onDelete: () => void;
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
  error,
  feedbackBlock,
  feedbackValue,
  savedPhraseKeys,
  savingPhraseKey,
  phraseKey,
  onFeedback,
  onSavePhrase,
  onExport,
  deleting,
  onDelete,
}: DebriefPageViewProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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
            <CardTitle>{processing ? 'Đang xử lý debrief…' : 'Chưa thể mở debrief'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {processing && (
              <p className="text-muted-foreground text-sm">
                CueLingo đang tổng hợp cuộc họp. Trang này sẽ tự thử lại mỗi 5 giây trong tối đa 2
                phút.
              </p>
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
          description={`Điểm hiểu: ${
            debrief.comprehensionPct === null
              ? 'Chưa đủ dữ liệu'
              : `${Math.round(debrief.comprehensionPct)}%`
          }`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="min-h-11" onClick={onExport}>
                Xuất Markdown
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

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <DebriefBlock
        title="Tóm tắt"
        block="summary"
        feedbackBlock={feedbackBlock}
        feedbackValue={feedbackValue}
        onFeedback={onFeedback}
      >
        <h2 className="font-medium">{debrief.summary.headlineVi}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {debrief.summary.bulletsVi.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </DebriefBlock>

      <DebriefBlock
        title="Quyết định & việc cần làm"
        block="actionItems"
        feedbackBlock={feedbackBlock}
        feedbackValue={feedbackValue}
        onFeedback={onFeedback}
      >
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

      <DebriefBlock
        title="Đoạn khó"
        block="hardSegments"
        feedbackBlock={feedbackBlock}
        feedbackValue={feedbackValue}
        onFeedback={onFeedback}
      >
        {hardSegments.length ? (
          <ul className="space-y-2">
            {hardSegments.map(({ id, segment }, index) => (
              <li key={id}>
                <a
                  href={`#segment-${id}`}
                  className="focus-visible:ring-ring flex min-h-11 items-center rounded-md px-2 text-sm underline-offset-4 hover:bg-accent hover:underline focus-visible:ring-2 focus-visible:outline-none"
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

      <DebriefBlock
        title="Cụm từ nên lưu"
        block="phraseSuggestions"
        feedbackBlock={feedbackBlock}
        feedbackValue={feedbackValue}
        onFeedback={onFeedback}
      >
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
                    <strong className="block">{suggestion.phrase}</strong>
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

      <DebriefBlock
        title="Câu bạn nói → câu nên nói"
        block="rephrase"
        feedbackBlock={feedbackBlock}
        feedbackValue={feedbackValue}
        onFeedback={onFeedback}
      >
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

      <Section title="Transcript song ngữ">
        <Card>
          <CardContent className="pt-6">
            {session?.segments.length ? (
              <ol className="space-y-4">
                {session.segments.map((segment) => (
                  <li
                    key={segment.id}
                    id={`segment-${segment.id}`}
                    tabIndex={-1}
                    className="scroll-mt-4 rounded-md border-l-4 border-transparent pl-4 focus:border-primary focus:bg-accent focus:outline-none target:border-primary target:bg-accent"
                  >
                    <p className="text-sm">{segment.textEn}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {segment.textVi || 'Chưa có bản dịch'}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground text-sm">Chưa có transcript cho cuộc họp này.</p>
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
      error={state.error}
      feedbackBlock={state.feedbackBlock}
      feedbackValue={state.feedbackValue}
      savedPhraseKeys={state.savedPhraseKeys}
      savingPhraseKey={state.savingPhraseKey}
      phraseKey={state.phraseKey}
      onFeedback={state.sendFeedback}
      onSavePhrase={(input) => void state.savePhrase(input)}
      onExport={state.exportMarkdown}
      deleting={state.deleting}
      onDelete={state.deleteSession}
    />
  );
}
