import type { LanguageCode } from '@cuelingo/shared';
import { SandboxFrame } from '@cuelingo/ui/components/sandbox-frame';
import { useSpeaker } from '@cuelingo/ui/components/speak-button';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, type ReactNode } from 'react';
import { client } from '../../lib/client';
import { HTML_BLOCKS_ENABLED, SANDBOX_ORIGIN } from '../../lib/config';

export type RenderHtmlBlock = (data: { title?: string; html: string }) => ReactNode;

/**
 * How the chat draws a block the assistant wrote (ADR 0019, layer 2). `undefined` while the flag or the runner
 * origin is missing, so the chat shows "chưa được bật" and never a frame. The block reaches the user's data only
 * through these three callbacks, which use this app's own `client`: the block never sees a token or a URL.
 */
export function useHtmlBlocks(language: LanguageCode): RenderHtmlBlock | undefined {
  const queryClient = useQueryClient();
  const speaker = useSpeaker(client.tts.speak);
  const { play } = speaker;

  const listPhrases = useCallback(async () => {
    const { phrases } = await client.phrases.list(language);
    return phrases.map(({ phrase, meaningVi }) => ({ phrase, meaningVi }));
  }, [language]);

  // Called by the frame only after the person agreed in its dialog.
  const savePhrase = useCallback(
    async (input: { phrase: string; meaningVi?: string }) => {
      await client.phrases.save({ ...input, language });
      void queryClient.invalidateQueries({ queryKey: ['phrases'] });
      void client.events
        .record({ type: 'phrase_saved', phrase: input.phrase, at: new Date().toISOString() })
        .catch(() => undefined);
    },
    [language, queryClient],
  );

  const speak = useCallback((text: string) => play(text), [play]);

  const render = useCallback<RenderHtmlBlock>(
    (data) =>
      SANDBOX_ORIGIN ? (
        <SandboxFrame
          html={data.html}
          title={data.title}
          runnerOrigin={SANDBOX_ORIGIN}
          onListPhrases={listPhrases}
          onSavePhrase={savePhrase}
          onSpeak={speak}
        />
      ) : null,
    [listPhrases, savePhrase, speak],
  );
  return HTML_BLOCKS_ENABLED ? render : undefined;
}
