'use client';

import { Button } from '@cuelingo/ui/components/button';
import { LanguageSwitcher } from '@cuelingo/ui/components/language-switcher';
import { PlacementTest } from '@cuelingo/ui/components/placement-test';
import { Section } from '@cuelingo/ui/components/section';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';
import { useLanguage } from '../../lib/language';

/** The listening placement test, on the settings page: takes a few minutes, can be redone any time. */
export function PlacementCard() {
  const { language, setLanguage, options } = useLanguage();
  const queryClient = useQueryClient();
  const [started, setStarted] = useState(false);
  const test = useQuery({
    queryKey: ['placement', language],
    queryFn: () => client.placement.get(language),
    enabled: started,
    staleTime: Infinity,
    retry: false,
  });

  async function submit(answers: Array<{ passageId: string; choice: number }>) {
    const result = await client.placement.submit({ language, answers });
    // The result sets the assist default, so what the settings form shows has changed.
    void queryClient.invalidateQueries({ queryKey: ['settings'] });
    return result;
  }

  return (
    <Section
      title="Bài nghe đánh giá"
      description="Sáu đoạn nghe ngắn để chọn mức hỗ trợ mặc định phù hợp. Làm lại được bất cứ lúc nào."
    >
      <div className="max-w-3xl space-y-4">
        {started && test.data ? (
          <PlacementTest
            passages={test.data.passages}
            loadAudio={client.tts.speak}
            onSubmit={submit}
            onDone={() => setStarted(false)}
          />
        ) : (
          <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 sm:p-5">
            <p className="text-sm">
              Bạn cần tai nghe hoặc loa. Mỗi đoạn được đọc một lần, bạn có thể nghe lại.
            </p>
            <div className="flex items-center gap-2">
              <LanguageSwitcher options={options} value={language} onChange={setLanguage} />
              <Button
                className="cursor-pointer"
                disabled={started && test.isPending}
                onClick={() => setStarted(true)}
              >
                {started && test.isPending ? 'Đang tải…' : 'Bắt đầu'}
              </Button>
            </div>
          </div>
        )}
        {started && test.isError ? (
          <p role="alert" className="text-destructive text-sm">
            {describeError(test.error) ?? 'Không tải được bài.'}
          </p>
        ) : null}
      </div>
    </Section>
  );
}
