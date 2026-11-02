import { describe, expect, it } from 'vitest';
import { describeModelProgress } from './model-progress';

describe('describeModelProgress', () => {
  it('says which model is downloading and how far along', () => {
    expect(
      describeModelProgress({ type: 'model', language: 'ja', state: 'downloading', progress: 0.4 }),
    ).toBe('Đang tải mô hình nhận dạng tiếng nhật… 40%');
  });

  it('is silent once the model is ready or on error', () => {
    expect(describeModelProgress({ type: 'model', language: 'ja', state: 'ready' })).toBeNull();
    expect(describeModelProgress(null)).toBeNull();
  });
});
