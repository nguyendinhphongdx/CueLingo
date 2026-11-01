import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { describePermission, PermissionsStatusView } from './PermissionsStep';

describe('PermissionsStep', () => {
  it('describes denied and unknown permissions in Vietnamese', () => {
    expect(describePermission('microphone', 'denied')).toContain('Cài đặt hệ thống');
    expect(describePermission('screenCapture', 'unknown')).toContain('Chưa xác định');
  });

  it('shows guidance for each permission that is not granted', () => {
    const markup = renderToStaticMarkup(
      <PermissionsStatusView status={{ microphone: 'denied', screenCapture: 'unknown' }} />,
    );

    expect(markup).toContain('Micrô đang bị từ chối');
    expect(markup).toContain('Chưa xác định quyền ghi màn hình');
  });

  it('shows ready state when both permissions are granted', () => {
    const markup = renderToStaticMarkup(
      <PermissionsStatusView status={{ microphone: 'granted', screenCapture: 'granted' }} />,
    );

    expect(markup).toContain('đã sẵn sàng');
    expect(markup).not.toContain('Cài đặt hệ thống');
  });
});
