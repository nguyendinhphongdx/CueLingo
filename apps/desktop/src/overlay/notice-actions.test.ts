import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openWeb, requestOpenSettings } = vi.hoisted(() => ({
  openWeb: vi.fn(async () => undefined),
  requestOpenSettings: vi.fn(async () => undefined),
}));
vi.mock('../app/open-web', () => ({ openWeb }));
vi.mock('../lib/native', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  native: { requestOpenSettings },
}));

import { NoticeEvent } from '../lib/native';
import { noticeActionFor } from './notice-actions';

const base = { id: 'n', tone: 'error' as const, text: 'x' };

describe('noticeActionFor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has no button for a notice that only informs', () => {
    expect(noticeActionFor(base)).toBeUndefined();
  });

  it('opens the plans page for upgrade', () => {
    const action = noticeActionFor({ ...base, action: 'upgrade' });
    expect(action?.label).toBe('Nâng cấp');
    action?.onSelect();
    expect(openWeb).toHaveBeenCalledWith('/upgrade');
  });

  it('asks the main window for Cài đặt', () => {
    const action = noticeActionFor({ ...base, action: 'open-settings' });
    expect(action?.label).toBe('Mở Cài đặt');
    action?.onSelect();
    expect(requestOpenSettings).toHaveBeenCalled();
  });

  it('keeps the field optional, and rejects an unknown action', () => {
    expect(NoticeEvent.safeParse(base).success).toBe(true);
    expect(NoticeEvent.safeParse({ ...base, action: 'retry' }).success).toBe(false);
  });
});
