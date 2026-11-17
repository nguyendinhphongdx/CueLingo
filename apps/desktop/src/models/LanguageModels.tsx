import { SUPPORTED_LANGUAGES, type LanguageCode } from '@cuelingo/shared';
import { Badge } from '@cuelingo/ui/components/badge';
import { ListCard, Section } from '@cuelingo/ui/components/section';
import { ModelDownloadControl } from './ModelDownloadControl';
import type { ModelView } from './model-state';
import { useLocalModels } from './use-local-models';

export interface LanguageModelRow {
  code: string;
  /** "Tiếng Anh". */
  name: string;
  /** Where it is recognised: on this machine, or in the cloud. */
  where: 'device' | 'cloud';
  view: ModelView;
}

/** Every language CueLingo can listen to, with where it runs and whether its model is on this machine. */
export function LanguageModelsView({
  rows,
  onDownload,
}: {
  rows: readonly LanguageModelRow[];
  onDownload(code: string): void;
}) {
  return (
    <Section
      title="Mô hình nhận dạng"
      description="Ngôn ngữ chạy trên máy cần tải mô hình một lần và âm thanh không rời khỏi máy. Ngôn ngữ chạy đám mây không có mô hình để tải; âm thanh chỉ được gửi đi sau khi bạn đồng ý."
    >
      <ListCard>
        {rows.map((row) => (
          <li
            key={row.code}
            data-language={row.code}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{row.name}</span>
              <Badge variant="outline">{row.where === 'device' ? 'Trên máy' : 'Đám mây'}</Badge>
            </div>
            <ModelDownloadControl
              view={row.view}
              name={row.name.toLowerCase()}
              onDownload={() => onDownload(row.code)}
            />
          </li>
        ))}
      </ListCard>
    </Section>
  );
}

/** The rows from the language registry: nothing here names a language, so a new model gets its row by itself. */
export function languageModelRows(view: (code: string) => ModelView | null): LanguageModelRow[] {
  const rows: LanguageModelRow[] = [];
  for (const code of Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[]) {
    const info = SUPPORTED_LANGUAGES[code];
    const modelView = view(code);
    // A build that cannot manage models shows no list at all (the caller checks), never a half list.
    if (modelView === null) continue;
    rows.push({
      code,
      name: info.name,
      where: info.recognition === 'cloud' ? 'cloud' : 'device',
      view: modelView,
    });
  }
  return rows;
}

/** Settings section: which languages run on this machine and which models are downloaded. */
export function LanguageModels() {
  const models = useLocalModels();
  const rows = languageModelRows(models.view);
  return <LanguageModelsView rows={rows} onDownload={(code) => void models.download(code)} />;
}
