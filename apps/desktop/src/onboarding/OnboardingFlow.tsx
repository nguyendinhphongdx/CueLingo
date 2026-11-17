import { useEffect, useState } from 'react';
import { Button } from '@cuelingo/ui/components/button';
import { Segmented } from '@cuelingo/ui/components/segmented';
import { ArrowLeft, Captions, Languages, MessageSquareText, X } from 'lucide-react';
import { IconButton } from '@cuelingo/ui/components/icon-button';
import { Logo } from '@cuelingo/ui/components/logo';
import { native } from '../lib/native';
import { shortcutLabel } from '../lib/platform';
import { CaptionBlock } from '../overlay/CaptionBlock';
import { sampleTranscript } from '../overlay/sample';
import { saveAssistLevel } from '../settings/use-assist-settings';
import type { SelectableAssistLevel } from '../settings/settings-store';
import { ShortcutList } from '../app/AboutCard';
import { PlacementSection } from '../study/PlacementSection';
import { describeModelProgress, useModelProgress } from '../session/model-progress';
import { ModelDownloadControl } from '../models/ModelDownloadControl';
import { canContinue, formatSize, type ModelView } from '../models/model-state';
import { useLocalModels } from '../models/use-local-models';
import { PermissionsStep } from './PermissionsStep';
import {
  advanceProgress,
  ONBOARDING_STEPS,
  readProgress,
  writeProgress,
  type OnboardingProgress,
} from './onboarding-storage';

const steps = ONBOARDING_STEPS.map((step) => step.label);

export const nextOnboardingStep = (step: number) => Math.min(steps.length - 1, step + 1);

const assistOptions = [
  { level: 4, label: 'Đầy đủ', hint: 'Caption gốc kèm bản dịch tiếng Việt.' },
  { level: 3, label: 'Gợi ý', hint: 'Tiếng Anh là chính, bản dịch nhấn mạnh ý khó.' },
  { level: 1, label: 'Tối thiểu', hint: 'Chỉ hiện bản dịch tiếng Việt.' },
  { level: 0, label: 'Ẩn', hint: 'Ẩn caption nhưng vẫn ghi lại để debrief.' },
] as const satisfies ReadonlyArray<{
  level: SelectableAssistLevel;
  label: string;
  hint: string;
}>;

export async function saveSelectedAssistLevel(
  value: string,
  save: (level: SelectableAssistLevel) => Promise<void> = saveAssistLevel,
) {
  const level = Number(value) as SelectableAssistLevel;
  await save(level);
  return level;
}

function WelcomeStep() {
  return (
    <div className="flex min-h-[320px] flex-col justify-center">
      <Logo size={52} />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Theo kịp cuộc họp bằng tiếng Anh
      </h1>
      <p className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed">
        CueLingo hiện caption song ngữ khi họp, giúp bạn tra từ và soạn câu ngay lúc cần, rồi
        debrief và ôn lại cụm từ từ chính cuộc họp.
      </p>
      <div className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
        <p className="flex items-center gap-2 font-medium">
          <Captions aria-hidden="true" className="text-primary size-4" />
          Hiểu cuộc họp
        </p>
        <p className="flex items-center gap-2 font-medium">
          <MessageSquareText aria-hidden="true" className="text-primary size-4" />
          Nói khi cần
        </p>
        <p className="flex items-center gap-2 font-medium">
          <Languages aria-hidden="true" className="text-primary size-4" />
          Học từ cuộc họp
        </p>
      </div>
    </div>
  );
}

function SampleCaptionStep() {
  const [overlayMessage, setOverlayMessage] = useState<string | null>(null);

  const showOverlay = async () => {
    try {
      const visible = await native.toggleOverlay();
      setOverlayMessage(visible ? 'Overlay thử đang hiện.' : 'Overlay thử đã được ẩn.');
    } catch {
      setOverlayMessage('Không thể mở overlay. Bạn có thể thử lại sau trong Phiên họp.');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Caption và phím tắt</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Caption nổi trên các app họp và luôn giữ bản dịch ở dòng dễ đọc nhất.
      </p>
      <div className="bg-card mt-6 space-y-5 rounded-xl border px-6 py-5 text-[17px]">
        {sampleTranscript.slice(0, 2).map((segment, index) => (
          <CaptionBlock
            key={segment.segmentId}
            segment={segment}
            level={4}
            faded={index === 0}
            showSpeaker={false}
            onLookup={() => undefined}
          />
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => void showOverlay()}>
          Hiện overlay thử
        </Button>
        <p className="text-muted-foreground text-sm">
          Sau này, bấm <kbd className="text-foreground font-medium">{shortcutLabel('L')}</kbd> để ẩn
          hoặc hiện.
        </p>
      </div>
      {overlayMessage ? (
        <p role="status" className="text-muted-foreground mt-3 text-sm">
          {overlayMessage}
        </p>
      ) : null}
      <div className="bg-card mt-6 rounded-xl border px-4 py-3">
        <ShortcutList />
      </div>
    </div>
  );
}

/** The model the first step downloads: English, the only one that runs on this machine. */
const MODEL_LANGUAGE = 'en';

/** The step that downloads the speech model. */
export const MODEL_STEP = 2;

/** A build that cannot manage models from the app: the model comes down with the first meeting, as before. */
function LegacyModelStep() {
  const progress = describeModelProgress(useModelProgress());
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Mô hình nhận dạng</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Mô hình chạy ngay trên máy bạn nên caption tiếng Anh nhanh và âm thanh không rời khỏi máy.
        CueLingo tải nó một lần, khi bạn bắt đầu cuộc họp đầu tiên. Bạn có thể làm bước tiếp theo
        trong lúc chờ.
      </p>
      <p
        role="status"
        className="bg-card text-muted-foreground mt-6 rounded-xl border px-4 py-3 text-sm"
      >
        {progress ?? 'Chưa tải gì lúc này. Mô hình sẽ tự tải nếu máy chưa có.'}
      </p>
    </div>
  );
}

/** The model step when the app can download it: the person cannot go on until the model is in place. */
export function ModelStepView({ view, onDownload }: { view: ModelView; onDownload(): void }) {
  const size =
    'sizeBytes' in view && view.sizeBytes > 0 ? ` (khoảng ${formatSize(view.sizeBytes)})` : '';
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Mô hình nhận dạng</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Mô hình chạy ngay trên máy bạn nên caption tiếng Anh nhanh và âm thanh không rời khỏi máy.
        CueLingo cần tải nó về một lần{size} trước khi họp. Bạn chỉ phải tải khi máy chưa có.
      </p>
      <div role="status" className="bg-card mt-6 space-y-3 rounded-xl border px-4 py-4">
        <ModelDownloadControl view={view} name="tiếng Anh" onDownload={onDownload} />
        {canContinue(view) ? (
          <p className="text-muted-foreground text-sm">
            Mô hình đã có trên máy. Bạn có thể tiếp tục.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">Cần tải xong mô hình để tiếp tục.</p>
        )}
      </div>
    </div>
  );
}

function ModelStep({ view, onDownload }: { view: ModelView | null; onDownload(): void }) {
  return view === null ? (
    <LegacyModelStep />
  ) : (
    <ModelStepView view={view} onDownload={onDownload} />
  );
}

function ListeningStep() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Bài nghe đánh giá</h1>
      <PlacementSection />
    </div>
  );
}

function AssistLevelStep() {
  const [level, setLevel] = useState<SelectableAssistLevel>(4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectLevel = async (value: string) => {
    const next = Number(value) as SelectableAssistLevel;
    setLevel(next);
    setSaving(true);
    setError(null);
    try {
      await saveSelectedAssistLevel(value);
    } catch {
      setError('Không thể lưu mức hỗ trợ. Vui lòng chọn lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Bạn muốn được hỗ trợ đến đâu?</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Chọn mức phù hợp lúc này. Bạn có thể đổi bất cứ lúc nào trong Phiên họp.
      </p>
      <div className="mt-6">
        <Segmented
          label="Mức hỗ trợ caption"
          value={String(level)}
          disabled={saving}
          onChange={(value) => void selectLevel(value)}
          options={assistOptions.map((option) => ({
            value: String(option.level),
            label: `${option.level} · ${option.label}`,
          }))}
        />
      </div>
      <ul className="mt-5 divide-y">
        {assistOptions.map((option) => (
          <li key={option.level} className="flex gap-4 py-3 text-sm">
            <span className="w-20 shrink-0 font-medium">
              {option.level} · {option.label}
            </span>
            <span className="text-muted-foreground">{option.hint}</span>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const FORWARD: Record<number, string> = {
  0: 'Bắt đầu',
  1: 'Tiếp tục',
  2: 'Tiếp tục',
  3: 'Tiếp tục',
  4: 'Tiếp tục',
  5: 'Vào CueLingo',
};

/** What the footer offers on a step: the forward button, the skip button, and whether going on is blocked. */
export function footerFor(
  step: number,
  modelView: ModelView | null,
): { forward: string; skip: string | null; blocked: boolean } {
  const onModelStep = step === MODEL_STEP;
  // With a model manager the model step is mandatory: no skip, and no way forward until it is in place.
  const managed = onModelStep && modelView !== null;
  return {
    forward: FORWARD[step] ?? 'Tiếp tục',
    skip: managed ? null : (SKIPPABLE[step] ?? null),
    blocked: onModelStep && !canContinue(modelView),
  };
}

/** The steps a person may leave for later; their cards come back on the home page. */
const SKIPPABLE: Record<number, string> = {
  1: 'Để sau',
  2: 'Bỏ qua, tải sau',
  3: 'Để sau',
  4: 'Để sau',
};

export function OnboardingFlow({
  onFinish,
  onExit,
  userId = 'dev',
  initialStep,
}: {
  onFinish(): void;
  /** Leaves the guide without finishing; where the person stopped is kept for the home-page cards. */
  onExit?(): void;
  userId?: string;
  /** Overrides the saved resume point (a card reopening a step). */
  initialStep?: number;
}) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(() => readProgress(userId));
  const [step, setStep] = useState(() =>
    Math.min(Math.max(initialStep ?? progress?.step ?? 0, 0), steps.length - 1),
  );
  const last = steps.length - 1;
  const models = useLocalModels();
  const modelView = models.view(MODEL_LANGUAGE);
  const footer = footerFor(step, modelView);

  const go = (target: number, finished: boolean) => {
    const to = Math.min(Math.max(target, 0), last);
    const saved = finished
      ? advanceProgress(progress, step, to)
      : { step: to, done: progress?.done ?? [] };
    setProgress(saved);
    writeProgress(userId, saved);
    setStep(to);
  };
  const back = () => go(step - 1, false);
  const next = () => {
    if (footer.blocked) return;
    if (step === last) {
      writeProgress(userId, advanceProgress(progress, step, step));
      onFinish();
    } else go(nextOnboardingStep(step), true);
  };
  const skip = () => {
    if (step === last) {
      onFinish();
    } else go(nextOnboardingStep(step), false);
  };
  const exit = () => {
    writeProgress(userId, { step, done: progress?.done ?? [] });
    (onExit ?? onFinish)();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('button, input, textarea, select')) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        next();
      }
      if (event.key === 'Escape' && step > 0) {
        event.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6 py-8">
      <div className="bg-card relative w-full max-w-2xl rounded-xl border p-8 shadow-lg">
        <IconButton
          className="absolute top-4 right-4"
          label="Thoát, làm tiếp sau"
          icon={<X aria-hidden="true" className="size-4" />}
          onClick={exit}
        />
        <nav aria-label={`Bước ${step + 1} trên ${steps.length}`}>
          <ol className="flex gap-2">
            {steps.map((label, index) => (
              <li key={label} className="grow">
                <span
                  aria-current={index === step ? 'step' : undefined}
                  className={`block h-1.5 rounded-full ${
                    index === step ? 'bg-primary' : index < step ? 'bg-primary/40' : 'bg-muted'
                  }`}
                >
                  <span className="sr-only">
                    {index + 1}/{steps.length} · {label}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </nav>
        <p className="text-muted-foreground text-body-sm mt-3">
          Bước {step + 1} trên {steps.length} · {steps[step]}
        </p>

        <section className="mt-7 min-h-[360px]">
          {step === 0 ? <WelcomeStep /> : null}
          {step === 1 ? (
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Cho phép CueLingo nghe cuộc họp
              </h1>
              <p className="text-muted-foreground mt-2 mb-5 text-sm leading-relaxed">
                Cấp quyền một lần để bấm Bắt đầu họp là nghe ngay. Bạn có thể để sau.
              </p>
              <PermissionsStep />
            </div>
          ) : null}
          {step === MODEL_STEP ? (
            <ModelStep view={modelView} onDownload={() => void models.download(MODEL_LANGUAGE)} />
          ) : null}
          {step === 3 ? <AssistLevelStep /> : null}
          {step === 4 ? <ListeningStep /> : null}
          {step === 5 ? <SampleCaptionStep /> : null}
        </section>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <div>
            {step > 0 ? (
              <Button variant="ghost" onClick={back}>
                <ArrowLeft aria-hidden="true" className="size-4" />
                Quay lại
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {footer.skip ? (
              <Button variant="ghost" className="text-muted-foreground" onClick={skip}>
                {footer.skip}
              </Button>
            ) : null}
            <Button onClick={next} disabled={footer.blocked}>
              {footer.forward}
            </Button>
          </div>
        </footer>
      </div>
    </main>
  );
}
