import { Button } from '@cuelingo/ui/components/button';
import { KeepMounted } from '@cuelingo/ui/components/keep-mounted';
import { FollowupComposer, type FollowupDraft } from '@cuelingo/ui/components/followup-composer';
import type { FollowupRequest } from '@cuelingo/shared';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { describeFollowupError } from './debrief-api';
import type { BriefState } from './use-debrief-brief';
import { summariseDebrief, type BriefList } from './debrief-brief';

export const BRIEF_EMPTY_TEXT = 'Cuộc họp không có câu nào được ghi, nên chưa có debrief.';
export const BRIEF_DENIED_TEXT = 'Không xem được debrief, hãy đăng nhập lại.';
export const BRIEF_TIMEOUT_TEXT = 'Debrief chưa sẵn sàng, xem sau ở Cuộc họp gần đây.';

function Bullets({ title, items }: { title: string; items: BriefList }) {
  if (items.shown.length === 0) return null;
  return (
    <div>
      <h4 className="text-muted-foreground text-xs font-medium">{title}</h4>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
        {items.shown.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
      {items.more > 0 ? (
        <p className="text-muted-foreground mt-0.5 pl-5 text-xs">và {items.more} mục khác</p>
      ) : null}
    </div>
  );
}

export interface PostMeetingCardProps {
  /** Elapsed timer text at the moment the meeting stopped (mm:ss). */
  duration: string;
  sentences: number;
  brief: BriefState;
  onOpen(): void;
  /** Drafts a follow-up message; without it the button is not shown. */
  onComposeFollowup?: (input: FollowupRequest) => Promise<FollowupDraft>;
  /** Start with the composer open (tests). */
  followupOpen?: boolean;
}

/** What the person sees right after Stop: how long, how much was heard, and the debrief as it arrives. */
export function PostMeetingCard({
  duration,
  sentences,
  brief,
  onOpen,
  onComposeFollowup,
  followupOpen = false,
}: PostMeetingCardProps) {
  const [composing, setComposing] = useState(followupOpen);
  const empty = sentences === 0;
  const content = brief.status === 'ready' ? summariseDebrief(brief.debrief) : null;
  return (
    <section aria-label="Cuộc họp vừa xong" className="mt-6 space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">Cuộc họp vừa xong</h3>
        <p className="text-muted-foreground text-sm tabular-nums">
          {duration} · {sentences} câu
        </p>
      </div>
      {!empty && brief.status === 'pending' ? (
        <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          Đang tạo debrief…
        </p>
      ) : null}
      {empty ? (
        <p role="status" className="text-muted-foreground text-sm">
          {BRIEF_EMPTY_TEXT}
        </p>
      ) : null}
      {brief.status === 'denied' ? (
        <p role="status" className="text-muted-foreground text-sm">
          {BRIEF_DENIED_TEXT}
        </p>
      ) : null}
      {brief.status === 'timeout' ? (
        <p role="status" className="text-muted-foreground text-sm">
          {BRIEF_TIMEOUT_TEXT}
        </p>
      ) : null}
      {content ? (
        <div className="space-y-3">
          {content.summary.length > 0 ? (
            <div className="space-y-0.5 text-sm">
              {content.summary.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          ) : null}
          <Bullets title="Quyết định" items={content.decisions} />
          <Bullets title="Việc cần làm" items={content.todos} />
        </div>
      ) : null}
      {empty ? null : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onOpen}>
            Xem đầy đủ
          </Button>
          {content && onComposeFollowup ? (
            <Button
              variant="outline"
              aria-expanded={composing}
              onClick={() => setComposing((open) => !open)}
            >
              Soạn follow-up
            </Button>
          ) : null}
        </div>
      )}
      {content && onComposeFollowup ? (
        <KeepMounted open={composing}>
          <FollowupComposer onCompose={onComposeFollowup} describeError={describeFollowupError} />
        </KeepMounted>
      ) : null}
    </section>
  );
}
