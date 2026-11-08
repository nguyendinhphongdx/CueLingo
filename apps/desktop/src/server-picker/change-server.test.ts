import { describe, expect, it, vi } from 'vitest';
import { changeServer, MEETING_BLOCK_TEXT, type ChangeServerDeps } from './change-server';

const CHOICE = { api: 'https://api.other.example', web: 'https://other.example' };

function setup(overrides: Partial<ChangeServerDeps> = {}) {
  const calls: string[] = [];
  const deps: ChangeServerDeps = {
    meetingActive: () => false,
    token: () => 'cld_device',
    revoke: vi.fn(async () => void calls.push('revoke')),
    clearToken: vi.fn(async () => void calls.push('clear')),
    persist: vi.fn(() => void calls.push('persist')),
    relaunch: vi.fn(async () => void calls.push('relaunch')),
    ...overrides,
  };
  return { deps, calls };
}

describe('changeServer (AC8)', () => {
  it('signs the old session out on the old server, clears the token, saves, then restarts', async () => {
    const { deps, calls } = setup();
    expect(await changeServer(CHOICE, deps)).toEqual({ status: 'relaunching' });
    expect(calls).toEqual(['revoke', 'clear', 'persist', 'relaunch']);
    expect(deps.revoke).toHaveBeenCalledWith('cld_device');
    expect(deps.persist).toHaveBeenCalledWith(CHOICE);
  });

  it('does not wait on a server that cannot be reached', async () => {
    const { deps, calls } = setup({
      revoke: async () => {
        throw new Error('offline');
      },
    });
    expect((await changeServer(CHOICE, deps)).status).toBe('relaunching');
    expect(calls).toEqual(['clear', 'persist', 'relaunch']);
  });

  it('skips the sign-out when nobody is signed in', async () => {
    const { deps, calls } = setup({ token: () => null });
    await changeServer(CHOICE, deps);
    expect(deps.revoke).not.toHaveBeenCalled();
    expect(calls).toEqual(['clear', 'persist', 'relaunch']);
  });

  it('asks the person to reopen the app when it cannot restart itself', async () => {
    const { deps } = setup({
      relaunch: async () => {
        throw new Error('not allowed');
      },
    });
    expect(await changeServer(CHOICE, deps)).toEqual({ status: 'reopen' });
    expect(deps.persist).toHaveBeenCalled();
  });

  it('reports a choice that could not be saved and does not restart', async () => {
    const { deps } = setup({
      persist: () => {
        throw new Error('no storage');
      },
    });
    expect((await changeServer(CHOICE, deps)).status).toBe('failed');
    expect(deps.relaunch).not.toHaveBeenCalled();
  });
});

describe('changeServer during a meeting (AC9)', () => {
  it('changes nothing', async () => {
    const { deps, calls } = setup({ meetingActive: () => true });
    expect(await changeServer(CHOICE, deps)).toEqual({
      status: 'blocked',
      reason: MEETING_BLOCK_TEXT,
    });
    expect(calls).toEqual([]);
  });
});
