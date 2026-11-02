import { Button } from '@cuelingo/ui/components/button';
import { LanguageSwitcher } from '@cuelingo/ui/components/language-switcher';
import { PlacementTest } from '@cuelingo/ui/components/placement-test';
import { Section } from '@cuelingo/ui/components/section';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLanguage } from '../settings';
import { studyApi } from './study-api';

/** The listening placement test, in Settings: a few minutes, can be redone any time. */
export function PlacementSection() {
  const { language, setLanguage, options } = useLanguage();
  const queryClient = useQueryClient();
  const [started, setStarted] = useState(false);
  const test = useQuery({
    queryKey: ['study', 'placement', language],
    queryFn: () => studyApi.getPlacement(language),
    enabled: started,
    staleTime: Infinity,
    retry: false,
  });

  async function submit(answers: Array<{ passageId: string; choice: number }>) {
    const result = await studyApi.submitPlacement({ language, answers });
    // The result changes the assist default; reload what the app shows for it.
    void queryClient.invalidateQueries({ queryKey: ['assist-suggestion'] });
    return result;
  }

  return (
    <Section
      title="Bài nghe đánh giá"
      description="Sáu đoạn nghe ngắn để chọn mức hỗ trợ mặc định phù hợp. Làm lại được bất cứ lúc nào."
    >
      {started && test.data ? (
        <PlacementTest
          passages={test.data.passages}
          loadAudio={studyApi.speak}
          onSubmit={submit}
          onDone={() => setStarted(false)}
        />
      ) : (
        <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
          <p className="text-sm">
            Bạn cần tai nghe hoặc loa. Mỗi đoạn được đọc một lần, bạn có thể nghe lại.
          </p>
          <div className="flex items-center gap-2">
            <LanguageSwitcher options={options} value={language} onChange={setLanguage} />
            <Button className="cursor-pointer" onClick={() => setStarted(true)}>
              {started && test.isPending ? 'Đang tải…' : 'Bắt đầu'}
            </Button>
          </div>
        </div>
      )}
      {started && test.isError ? (
        <p role="alert" className="text-destructive text-sm">
          Không tải được bài. Vui lòng thử lại.
        </p>
      ) : null}
    </Section>
  );
}
