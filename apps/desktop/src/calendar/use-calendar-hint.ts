import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { native } from '../lib/native';
import { useLanguage } from '../settings';
import { pickUpcoming } from './calendar-hint';
import {
  readCalendarEnabled,
  readDismissed,
  writeCalendarEnabled,
  writeDismissed,
} from './calendar-prefs';

const REFRESH_MS = 2 * 60_000;

/** The next meeting on the calendar (starting within 15 minutes), once the person has turned that on. */
export function useCalendarHint() {
  const { language } = useLanguage();
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

  const hint = enabled
    ? pickUpcoming(query.data?.events ?? [], Date.now(), language, dismissed)
    : null;

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

  return { enabled, hint, dismiss, toggle, language };
}
