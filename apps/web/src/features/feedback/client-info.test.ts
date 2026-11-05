import { describe, expect, it } from 'vitest';
import { webClientInfo } from './client-info';

describe('webClientInfo', () => {
  it('reports the platform and no user agent', () => {
    expect(webClientInfo({ platform: 'MacIntel' })).toEqual({ appVersion: 'web', os: 'MacIntel' });
  });

  it('copes with an empty platform and cuts a long one', () => {
    expect(webClientInfo({ platform: '' }).os).toBe('unknown');
    expect(webClientInfo({ platform: 'x'.repeat(200) }).os).toHaveLength(80);
  });
});
