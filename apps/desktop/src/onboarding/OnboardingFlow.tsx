import { useEffect, useState } from 'react';
import { Button } from '@cuelingo/ui/components/button';
import { Segmented } from '@cuelingo/ui/components/segmented';
import { ArrowLeft, Captions, Languages, MessageSquareText } from 'lucide-react';
import { Logo } from '@cuelingo/ui/components/logo';
import { native } from '../lib/native';
import { CaptionBlock } from '../overlay/CaptionBlock';
import { sampleTranscript } from '../overlay/sample';
import { saveAssistLevel } from '../settings/use-assist-settings';
import type { SelectableAssistLevel } from '../settings/settings-store';
import { PermissionsStep } from './PermissionsStep';

const steps = ['Chào bạn', 'Quyền truy cập', 'Caption mẫu', 'Mức hỗ trợ'] as const;

export const nextOnboardingStep = (step: number) => Math.min(steps.length - 1, step + 1);

const assistOptions = [
  { level: 4, label: 'Đầy đủ', hint: 'Caption tiếng Anh kèm bản dịch tiếng Việt.' },
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
      <h1 className="text-2xl font-semibold tracking-tight">Xem caption trước khi vào họp</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Caption nổi trên các app họp và luôn giữ bản dịch ở dòng dễ đọc nhất.
      </p>
      <div className="bg-foreground text-background mt-6 space-y-5 rounded-xl px-6 py-5 text-[17px] shadow-sm">
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
          Sau này, bấm <kbd className="text-foreground font-medium">⌘⇧L</kbd> để ẩn hoặc hiện.
        </p>
      </div>
      {overlayMessage ? (
        <p role="status" className="text-muted-foreground mt-3 text-sm">
          {overlayMessage}
        </p>
      ) : null}
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

export function OnboardingFlow({
  onFinish,
  initialStep = 0,
}: {
  onFinish(): void;
  initialStep?: number;
}) {
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 0), steps.length - 1));

  const back = () => setStep((current) => Math.max(0, current - 1));
  const next = () => {
    if (step === steps.length - 1) onFinish();
    else setStep(nextOnboardingStep);
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
      <div className="w-full max-w-3xl">
        <nav aria-label="Tiến trình hướng dẫn">
          <ol className="grid grid-cols-4 gap-2">
            {steps.map((label, index) => (
              <li key={label}>
                <span
                  aria-current={index === step ? 'step' : undefined}
                  className={`block border-t-2 pt-2 text-xs ${
                    index === step
                      ? 'border-primary text-foreground font-medium'
                      : index < step
                        ? 'border-foreground/35 text-muted-foreground'
                        : 'border-border text-muted-foreground'
                  }`}
                >
                  {index + 1}/{steps.length} · <span className="hidden sm:inline">{label}</span>
                </span>
              </li>
            ))}
          </ol>
        </nav>

        <section className="mt-7 min-h-[410px]">
          {step === 0 ? <WelcomeStep /> : null}
          {step === 1 ? (
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Cho phép CueLingo nghe cuộc họp
              </h1>
              <p className="text-muted-foreground mt-2 mb-5 text-sm leading-relaxed">
                Bạn có thể cấp quyền bây giờ hoặc để sau. Onboarding không chặn bạn ở bước này.
              </p>
              <PermissionsStep />
            </div>
          ) : null}
          {step === 2 ? <SampleCaptionStep /> : null}
          {step === 3 ? <AssistLevelStep /> : null}
        </section>

        <footer className="mt-6 flex items-center justify-between border-t pt-4">
          {step > 0 ? (
            <Button variant="ghost" onClick={back}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Quay lại
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={next}>
            {step === 0
              ? 'Bắt đầu'
              : step === 1
                ? 'Để sau'
                : step === steps.length - 1
                  ? 'Vào CueLingo'
                  : 'Tiếp tục'}
          </Button>
        </footer>
      </div>
    </main>
  );
}
