import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../app/brand';
import tauriConfig from '../../src-tauri/tauri.conf.json';
import { UpdateSectionView, type UpdateSectionViewProps } from './UpdateSection';

const noop = () => {};
const view = (over: Partial<UpdateSectionViewProps>) =>
  renderToStaticMarkup(
    <UpdateSectionView
      version="0.1.3"
      state={{ phase: 'none' }}
      manual={{ status: 'idle' }}
      locked={false}
      onCheck={noop}
      onInstall={noop}
      {...over}
    />,
  );

describe('UpdateSection', () => {
  it('shows the version of the running build, not a hard-coded one', () => {
    expect(APP_VERSION).toBe(tauriConfig.version);
    expect(view({})).toContain('Phiên bản 0.1.3');
    expect(view({})).toContain('Kiểm tra cập nhật');
  });

  it('shows each check outcome', () => {
    expect(view({ manual: { status: 'checking' } })).toContain('Đang kiểm tra');
    expect(view({ manual: { status: 'checking' } })).toContain('disabled=""');
    expect(
      view({ manual: { status: 'upToDate', at: new Date('2026-11-15T03:05:00Z') } }),
    ).toContain('bản mới nhất');
    expect(view({ manual: { status: 'error' } })).toContain('Không kiểm tra được');
    expect(view({ manual: { status: 'unsupported' } })).toContain('không tự cập nhật');
  });

  it('offers the update and locks it during a meeting', () => {
    const available = { phase: 'available' as const, version: '0.2.0', notes: null };
    expect(view({ state: available })).toContain('Có bản mới 0.2.0');
    expect(view({ state: available })).not.toContain('disabled=""');
    const locked = view({ state: available, locked: true });
    expect(locked).toContain('disabled=""');
    expect(locked).toContain('sau khi họp xong');
  });

  it('shows the install in progress', () => {
    expect(view({ state: { phase: 'installing', version: '0.2.0' } })).toContain(
      'Đang cập nhật lên 0.2.0',
    );
  });
});
