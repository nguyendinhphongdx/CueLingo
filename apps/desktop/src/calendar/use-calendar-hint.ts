import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { native } from '../lib/native';
import { useLanguage } from '../settings';
import { pickHint } from './calendar-hint';
import {
  readCalendarEnabled,
  readDismissed,
  writeCalendarEnabled,
  writeDismissed,
} from './calendar-prefs';

const REFRESH_MS = 2 * 60_000;

/** A language suggested by the next meeting on the calendar, once the person has turned that on. */
export function useCalendarHint() {
  const { language, setLanguage } = useLanguage();
  const [enabled, setEnabled] = useState(readCalendarEnabled);
  const [dismissed, setDismissed] = useState(readDismissed);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['calendar', 'events'],
    queryFn: () => native.calendar('events'),
    enabled,
    refetchInterval: REFRESH_MS,
    retry: false,
  });

  const hint = enabled ? pickHint(query.data?.events ?? [], Date.now(), language, dismissed) : null;

  const accept = useCallback(() => {
    if (hint) setLanguage(hint.language);
  }, [hint, setLanguage]);

  const dismiss = useCallback(() => {
    if (!hint) return;
    const next = new Set(dismissed).add(hint.key);
    setDismissed(next);
    writeDismissed(next);
  }, [hint, dismissed]);

  /** Turns suggestions on or off; turning on asks macOS for calendar access the first time. */
  const toggle = useCallback(
    async (on: boolean) => {
      if (on) {
        const result = await native.calendar('request');
        if (result?.state !== 'granted') {
          queryClient.setQueryData(['calendar', 'status'], result);
          return result?.state ?? null;
        }
      }
      writeCalendarEnabled(on);
      setEnabled(on);
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
      return on ? 'granted' : null;
    },
    [queryClient],
  );

  return { enabled, hint, accept, dismiss, toggle, language };
}
