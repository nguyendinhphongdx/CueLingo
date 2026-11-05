import { describe, expect, it, vi } from 'vitest';
import type { UpdateOffer } from '../lib/native';
import { createUpdateController } from './update-controller';

const offer = (install: () => Promise<void> = async () => {}): UpdateOffer => ({
  version: '0.2.0',
  notes: null,
  install: vi.fn(install),
});

describe('update controller', () => {
  it('stays quiet when there is no newer build', async () => {
    const controller = createUpdateController({
      check: async () => null,
      meetingActive: () => false,
    });
    await controller.check();
    expect(controller.getState()).toEqual({ phase: 'none' });
  });

  it('stays quiet when the check itself fails', async () => {
    const controller = createUpdateController({
      check: async () => {
        throw new Error('offline');
      },
      meetingActive: () => false,
    });
    await controller.check();
    expect(controller.getState()).toEqual({ phase: 'none' });
  });

  it('offers the new version and installs only when asked', async () => {
    const found = offer();
    const controller = createUpdateController({
      check: async () => found,
      meetingActive: () => false,
    });
    await controller.check();
    expect(controller.getState()).toMatchObject({ phase: 'available', version: '0.2.0' });
    expect(found.install).not.toHaveBeenCalled();
    await controller.install();
    expect(found.install).toHaveBeenCalledOnce();
  });

  it('does not install while a meeting runs', async () => {
    const found = offer();
    const controller = createUpdateController({
      check: async () => found,
      meetingActive: () => true,
    });
    await controller.check();
    await controller.install();
    expect(found.install).not.toHaveBeenCalled();
    expect(controller.getState().phase).toBe('available');
  });

  it('refuses a package whose signature does not match, and says so', async () => {
    const found = offer(async () => {
      throw new Error('The signature verification failed');
    });
    const controller = createUpdateController({
      check: async () => found,
      meetingActive: () => false,
    });
    await controller.check();
    await controller.install();
    expect(controller.getState()).toEqual({
      phase: 'failed',
      version: '0.2.0',
      reason: 'signature',
    });
    controller.dismiss();
    expect(controller.getState()).toEqual({ phase: 'none' });
  });
});
