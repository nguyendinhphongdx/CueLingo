import { SUPPORTED_LANGUAGES } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { ModelStatusRow } from '@cuelingo/ui/components/model-status-row';
import { Section } from '@cuelingo/ui/components/section';
import { MODEL_SIZE_HINT, type SpeechModelState } from '../lib/model-state';
import { useLocalModels } from '../models/use-local-models';
import { useLanguage } from './use-language';
import { useSpeechModel } from './use-speech-model';

/** The action that fits a state: what the row's main button says. */
export const modelActionLabel = (state: SpeechModelState): string | undefined =>
  state === 'missing'
    ? 'Tải về'
    : state === 'cached'
      ? 'Chuẩn bị'
      : state === 'error'
        ? 'Thử lại'
        : undefined;

/**
 * Settings: is the on-device speech model here, and a button to fetch or prepare it again. Only for a build
 * without the model manager (macOS); with it, `LanguageModels` already lists every model.
 */
export function ModelSetting() {
  const models = useLocalModels();
  if (models.loading || models.supported) return null;
  return <PrewarmModelSetting />;
}

function PrewarmModelSetting() {
  const { language } = useLanguage();
  const model = useSpeechModel(language);
  const name = SUPPORTED_LANGUAGES[language].name.toLocaleLowerCase('vi');
  return (
    <Section
      title="Mô hình nhận dạng"
      description="Chạy ngay trên máy này, nên cuộc họp không phải chờ tải hay gửi âm thanh đi."
    >
      <div className="bg-card rounded-xl border px-4 py-3">
        <ModelStatusRow
          title={`Nhận dạng ${name}`}
          state={model.state}
          progress={model.progress}
          sizeLabel={MODEL_SIZE_HINT}
          errorText={model.errorText}
          actionLabel={modelActionLabel(model.state)}
          onAction={() => void model.start()}
          secondary={
            model.state === 'ready' ? (
              <Button variant="ghost" className="cursor-pointer" onClick={() => void model.start()}>
                Chuẩn bị lại
              </Button>
            ) : null
          }
        />
      </div>
    </Section>
  );
}
