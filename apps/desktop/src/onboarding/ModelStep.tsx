import { SUPPORTED_LANGUAGES } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { ModelStatusRow } from '@cuelingo/ui/components/model-status-row';
import { useEffect, useRef } from 'react';
import { MODEL_SIZE_HINT } from '../lib/model-state';
import { modelActionLabel } from '../settings/ModelSetting';
import { useLanguage } from '../settings/use-language';
import { useSpeechModel } from '../settings/use-speech-model';

/**
 * Onboarding step: download and prepare the on-device speech model now, so the first meeting starts with captions.
 * It starts by itself (default on); "Bỏ qua" leaves it for later, and a download already going keeps running.
 */
export function ModelStep({ onSkip }: { onSkip(): void }) {
  const { language } = useLanguage();
  const model = useSpeechModel(language);
  const started = useRef(false);

  // Start once the disk status is known and the model is not ready: missing or downloaded but not yet compiled.
  useEffect(() => {
    if (started.current) return;
    if (model.state !== 'missing' && model.state !== 'cached') return;
    started.current = true;
    void model.start();
    // `start` only reads `language`, which does not change on this screen.
  }, [model.state]);

  const name = SUPPORTED_LANGUAGES[language].name.toLocaleLowerCase('vi');
  const busy = model.state === 'downloading' || model.state === 'compiling';
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mô hình nhận dạng</CardTitle>
        <CardDescription>
          CueLingo nhận dạng giọng nói ngay trên máy bạn. Tải và chuẩn bị mô hình bây giờ để cuộc
          họp đầu tiên có caption ngay.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ModelStatusRow
          title={`Nhận dạng ${name}`}
          state={model.state}
          progress={model.progress}
          sizeLabel={MODEL_SIZE_HINT}
          errorText={model.errorText}
          actionLabel={modelActionLabel(model.state)}
          onAction={() => void model.start()}
          secondary={
            model.state === 'ready' || model.state === 'cloud' ? null : (
              <Button variant="ghost" className="cursor-pointer" onClick={onSkip}>
                Bỏ qua
              </Button>
            )
          }
        />
        {busy ? (
          <p className="text-muted-foreground text-sm">
            Bạn có thể bấm Tiếp tục, mô hình vẫn tải ở nền.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
