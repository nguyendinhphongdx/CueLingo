import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const { prepHook } = vi.hoisted(() => ({ prepHook: vi.fn() }));
vi.mock('./use-calendar-hint', () => ({
  useCalendarHint: () => ({
    enabled: false,
    hint: null,
    dismiss: vi.fn(),
    toggle: vi.fn(),
    language: 'en',
  }),
}));
vi.mock('./use-meeting-prep', () => ({ useMeetingPrep: prepHook }));

import { CalendarHintCard } from './CalendarHintCard';

describe('CalendarHintCard with calendar hints off (AC2)', () => {
  it('draws nothing and never asks for earlier meetings or the API', () => {
    expect(renderToStaticMarkup(<CalendarHintCard onStart={() => {}} />)).toBe('');
    expect(prepHook).not.toHaveBeenCalled();
  });
});
