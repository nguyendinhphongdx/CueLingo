import { normalizePhrase, type LanguageCode } from '@cuelingo/shared';
import { useSpeaker } from '@cuelingo/ui/components/speak-button';
import type { WordLookup } from '@cuelingo/ui/components/word-actions-menu';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';
import { cleanWord, isSaved, savedSet, sentenceAround } from './word-selection';

export interface WordMenuState {
  word: string;
  /** The sentence the word was read in; kept with the phrase when saved. */
  sentence: string;
  position: { x: number; y: number };
}

const TEXT_BLOCKS = 'p, li, td, th, blockquote, h3, h4, [data-chat-text]';

/** Reads the double-clicked word and its sentence from the browser selection; null when there is none. */
function readSelectedWord(): { word: string; sentence: string } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const raw = selection.toString();
  const word = cleanWord(raw);
  if (!word) return null;

  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const block = element?.closest(TEXT_BLOCKS);
  if (!block) return { word, sentence: '' };

  const before = document.createRange();
  before.selectNodeContents(block);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length + Math.max(0, raw.indexOf(word));
  return { word, sentence: sentenceAround(block.textContent ?? '', start, start + word.length) };
}

/**
 * Double-click a word in the assistant's text: open a menu to look it up, hear it, or save it with the
 * sentence it came from. "Đã lưu" is judged against the Phrase Bank with `normalizePhrase`.
 */
export function useWordActions(language: LanguageCode) {
  const queryClient = useQueryClient();
  const phrases = useQuery({
    queryKey: ['phrases', language],
    queryFn: () => client.phrases.list(language),
  });
  const speaker = useSpeaker(client.tts.speak);
  const [menu, setMenu] = useState<WordMenuState | null>(null);
  const [lookup, setLookup] = useState<WordLookup>({ status: 'idle' });
  const [justSaved, setJustSaved] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);

  const saved = useMemo(() => savedSet(phrases.data?.phrases ?? []), [phrases.data]);

  const close = useCallback(() => {
    run.current += 1;
    speaker.stop();
    setMenu(null);
    setLookup({ status: 'idle' });
  }, [speaker]);

  const onDoubleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    const picked = readSelectedWord();
    if (!picked) return;
    run.current += 1;
    setError(null);
    setLookup({ status: 'idle' });
    setMenu({ ...picked, position: { x: event.clientX, y: event.clientY + 8 } });
  }, []);

  const doLookup = useCallback(async () => {
    if (!menu) return;
    const mine = ++run.current;
    setLookup({ status: 'loading' });
    try {
      const result = await client.assist.lookup({
        term: menu.word,
        context: menu.sentence || undefined,
        language,
      });
      if (run.current !== mine) return;
      setLookup({
        status: 'done',
        meaningVi: result.meaningVi,
        pos: result.pos,
        exampleEn: result.exampleEn,
        reading: result.reading,
        noteVi: result.noteVi,
      });
    } catch {
      if (run.current === mine) setLookup({ status: 'error' });
    }
  }, [menu, language]);

  const doSave = useCallback(async () => {
    if (!menu || saving) return;
    setSaving(true);
    setError(null);
    try {
      await client.phrases.save({
        phrase: menu.word,
        meaningVi: lookup.status === 'done' ? lookup.meaningVi : undefined,
        language,
        context: menu.sentence || undefined,
      });
      // "Đã lưu" shows at once; the Phrase Bank list is refreshed in the background.
      setJustSaved((current) => new Set(current).add(normalizePhrase(menu.word)));
      void queryClient.invalidateQueries({ queryKey: ['phrases'] });
      void client.events
        .record({ type: 'phrase_saved', phrase: menu.word, at: new Date().toISOString() })
        .catch(() => undefined);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }, [menu, saving, lookup, language, queryClient]);

  const wordSaved = menu
    ? isSaved(saved, menu.word) || justSaved.has(normalizePhrase(menu.word))
    : false;

  return {
    menu,
    lookup,
    saved: wordSaved,
    saving,
    speakStatus: speaker.status,
    error,
    clearError: () => setError(null),
    onDoubleClick,
    lookupWord: doLookup,
    speakWord: () => menu && void speaker.play(menu.word),
    saveWord: doSave,
    close,
  };
}
