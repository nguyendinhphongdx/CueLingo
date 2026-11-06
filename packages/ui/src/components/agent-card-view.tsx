import { Check, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { isClozeCorrect, splitCloze, type AgentCardLike } from '../lib/agent-card';
import { cn } from '../lib/utils';
import { Button } from './button';
import { FlashcardDeck } from './flashcard-deck';
import { SpeakButton } from './speak-button';

type CardOf<K extends AgentCardLike['kind']> = Extract<AgentCardLike, { kind: K }>['data'];
type LoadAudio = (text: string) => Promise<Blob>;

const frame = 'bg-card text-card-foreground w-full max-w-[560px] rounded-2xl border p-4 shadow-xs';

function Title({ children }: { children?: string }) {
  return children ? <h4 className="mb-3 text-sm font-semibold">{children}</h4> : null;
}

function Flashcards({ data, loadAudio }: { data: CardOf<'flashcards'>; loadAudio?: LoadAudio }) {
  const [index, setIndex] = useState(0);
  const total = data.cards.length;
  const card = data.cards[index];
  return (
    <div className="flex w-full flex-col gap-2">
      <Title>{data.title}</Title>
      {card ? (
        <FlashcardDeck
          card={{
            itemId: String(index),
            exercise: 'recognize',
            phrase: card.front,
            prompt: card.front,
            answer: card.back,
            meaningVi: null,
            contextEn: null,
          }}
          position={index + 1}
          total={total}
          submitting={false}
          onRate={() => setIndex((value) => value + 1)}
          loadAudio={loadAudio}
        />
      ) : (
        <div className={cn(frame, 'flex items-center justify-between gap-3')}>
          <p className="text-sm">Bạn đã xem hết {total} thẻ.</p>
          <Button variant="outline" size="sm" onClick={() => setIndex(0)}>
            Xem lại
          </Button>
        </div>
      )}
    </div>
  );
}

function ClozeItem({ item }: { item: CardOf<'cloze'>['items'][number] }) {
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const [before, after] = splitCloze(item.sentence);
  const correct = isClozeCorrect(typed, item.answer);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (typed.trim()) setChecked(true);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-1.5">
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-relaxed">
        <span>{before}</span>
        <input
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            setChecked(false);
          }}
          aria-label="Điền vào chỗ trống"
          autoComplete="off"
          spellCheck={false}
          className="border-input bg-background focus-visible:ring-ring h-8 w-32 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
        <span>{after}</span>
        <Button type="submit" size="sm" variant="outline" disabled={!typed.trim()}>
          Kiểm tra
        </Button>
      </p>
      {item.hint ? <p className="text-muted-foreground text-xs">Gợi ý: {item.hint}</p> : null}
      {checked ? (
        <p
          role="status"
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium',
            correct ? 'text-green-700 dark:text-green-400' : 'text-destructive',
          )}
        >
          {correct ? (
            <Check aria-hidden="true" className="size-3.5" />
          ) : (
            <X aria-hidden="true" className="size-3.5" />
          )}
          {correct ? 'Đúng rồi' : `Chưa đúng. Đáp án: ${item.answer}`}
        </p>
      ) : null}
    </form>
  );
}

function Cloze({ data }: { data: CardOf<'cloze'> }) {
  return (
    <div className={frame}>
      <Title>{data.title}</Title>
      <div className="space-y-4">
        {data.items.map((item, index) => (
          <ClozeItem key={index} item={item} />
        ))}
      </div>
    </div>
  );
}

function QuizChoice({ data }: { data: CardOf<'quiz_choice'> }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  return (
    <div className={frame}>
      <p className="mb-3 text-sm font-medium">{data.question}</p>
      <ul className="space-y-2">
        {data.options.map((option, index) => {
          const isAnswer = index === data.answerIndex;
          const isPicked = index === picked;
          return (
            <li key={index}>
              <button
                type="button"
                disabled={answered}
                aria-pressed={isPicked}
                onClick={() => setPicked(index)}
                className={cn(
                  'border-input hover:bg-muted focus-visible:ring-ring flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default',
                  answered &&
                    isAnswer &&
                    'border-green-600 bg-green-500/10 text-green-900 dark:text-green-100',
                  answered && isPicked && !isAnswer && 'border-destructive bg-destructive/10',
                )}
              >
                <span>{option}</span>
                {answered && isAnswer ? (
                  <Check aria-label="Đáp án đúng" className="size-4 shrink-0" />
                ) : null}
                {answered && isPicked && !isAnswer ? (
                  <X aria-label="Chưa đúng" className="size-4 shrink-0" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {answered ? (
        <p role="status" className="mt-3 text-sm">
          <span className="font-medium">
            {picked === data.answerIndex ? 'Đúng rồi. ' : 'Chưa đúng. '}
          </span>
          {data.explanation}
        </p>
      ) : null}
    </div>
  );
}

function CompareTable({ data }: { data: CardOf<'compare_table'> }) {
  return (
    <div className={cn(frame, 'max-w-full')}>
      <Title>{data.title}</Title>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {data.columns.map((column, index) => (
                <th key={index} className="bg-muted border px-2.5 py-1.5 text-left font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border px-2.5 py-1.5 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PhraseList({ data, loadAudio }: { data: CardOf<'phrase_list'>; loadAudio?: LoadAudio }) {
  return (
    <div className={frame}>
      <Title>{data.title}</Title>
      <ul className="divide-y">
        {data.items.map((item, index) => (
          <li key={index} className="flex items-start justify-between gap-2 py-2 first:pt-0">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">{item.phrase}</p>
              {item.meaningVi ? <p className="text-sm">{item.meaningVi}</p> : null}
              {item.example ? (
                <p className="text-muted-foreground text-xs italic">“{item.example}”</p>
              ) : null}
            </div>
            {loadAudio ? <SpeakButton text={item.phrase} loadAudio={loadAudio} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shown for an `html_block` when the client has not turned interactive pages on (flag off or no runner). */
function HtmlBlockOff() {
  return (
    <p role="note" className={cn(frame, 'text-muted-foreground text-sm')}>
      Khối giao diện tương tác chưa được bật nên không hiển thị.
    </p>
  );
}

/**
 * A card the assistant chose to show (ADR 0019, layer 1): fixed shapes drawn here, never code from the
 * model. All text is plain text. `loadAudio` is how the client fetches speech; without it no speaker shows.
 */
export function AgentCardView({
  card,
  loadAudio,
  renderHtmlBlock,
  className,
}: {
  card: AgentCardLike;
  loadAudio?: LoadAudio;
  /** How the client draws an `html_block` (in a `SandboxFrame`). Without it the block is not shown at all. */
  renderHtmlBlock?: (data: Extract<AgentCardLike, { kind: 'html_block' }>['data']) => ReactNode;
  className?: string;
}) {
  return (
    <div data-card-kind={card.kind} className={cn('w-full', className)}>
      {card.kind === 'flashcards' ? (
        <Flashcards data={card.data} loadAudio={loadAudio} />
      ) : card.kind === 'cloze' ? (
        <Cloze data={card.data} />
      ) : card.kind === 'quiz_choice' ? (
        <QuizChoice data={card.data} />
      ) : card.kind === 'html_block' ? (
        (renderHtmlBlock?.(card.data) ?? <HtmlBlockOff />)
      ) : card.kind === 'compare_table' ? (
        <CompareTable data={card.data} />
      ) : (
        <PhraseList data={card.data} loadAudio={loadAudio} />
      )}
    </div>
  );
}
