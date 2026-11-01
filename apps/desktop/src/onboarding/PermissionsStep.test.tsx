import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { describePermission, PermissionsStatusView } from './PermissionsStep';

describe('PermissionsStep', () => {
  it('describes each permission state in Vietnamese', () => {
    expect(describePermission('microphone', 'denied')).toContain('Cài đặt hệ thống');
    expect(describePermission('microphone', 'undetermined')).toContain('macOS sẽ hỏi');
    expect(describePermission('systemAudio', 'granted')).toContain('đã được cấp quyền');
    expect(describePermission('systemAudio', 'unknown')).toContain('Chưa kiểm tra được');
  });

  it('lists both permissions with their own guidance', () => {
    const markup = renderToStaticMarkup(
      <PermissionsStatusView status={{ microphone: 'denied', systemAudio: 'unknown' }} />,
    );

    expect(markup).toContain('Micrô đang bị từ chối');
    expect(markup).toContain('Chưa kiểm tra được quyền âm thanh hệ thống');
  });

  it('marks granted permissions as ready', () => {
    const markup = renderToStaticMarkup(
      <PermissionsStatusView status={{ microphone: 'granted', systemAudio: 'granted' }} />,
    );

    expect(markup).toContain('Micrô đã được cấp quyền');
    expect(markup).toContain('Âm thanh hệ thống đã được cấp quyền');
    expect(markup).not.toContain('Mở Cài đặt hệ thống');
  });
});
