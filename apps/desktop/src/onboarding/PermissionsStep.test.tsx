import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  describePermission,
  describeSystemAudioCheck,
  PermissionsStatusView,
  systemAudioIdleText,
} from './PermissionsStep';

describe('PermissionsStep', () => {
  it('describes each permission state in Vietnamese', () => {
    expect(describePermission('microphone', 'denied')).toContain('Cài đặt hệ thống');
    expect(describePermission('microphone', 'undetermined')).toContain('macOS sẽ hỏi');
    expect(describePermission('systemAudio', 'granted')).toContain('đã được cấp quyền');
    expect(describePermission('systemAudio', 'unknown')).toContain('Chưa kiểm tra được');
  });

  it('says Windows needs no system-audio permission and sends the microphone to Windows settings', () => {
    for (const state of ['granted', 'denied', 'undetermined', 'unknown'] as const) {
      expect(describePermission('systemAudio', state, 'windows')).toBe('Không cần cấp quyền.');
    }
    const denied = describePermission('microphone', 'denied', 'windows');
    expect(denied).toContain('Cài đặt Windows');
    expect(denied).not.toContain('macOS');
    expect(describePermission('microphone', 'undetermined', 'windows')).not.toContain('macOS');
    expect(describeSystemAudioCheck('silent', 'windows')).toContain('thiết bị phát âm thanh');
    expect(systemAudioIdleText('windows')).toContain('Windows');
    expect(systemAudioIdleText('macos')).toContain('macOS');
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

  it('describes every result of the system audio check', () => {
    expect(describeSystemAudioCheck('granted')).toContain('nghe được');
    expect(describeSystemAudioCheck('silent')).toContain('Không nghe thấy');
    expect(describeSystemAudioCheck('error')).toContain('Không thử được');
    expect(describeSystemAudioCheck('unknown')).toContain('Chưa kiểm tra được');
  });
});
