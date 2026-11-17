import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ModelStatus } from '../lib/native';
import { LanguageModelsView, languageModelRows } from './LanguageModels';
import { viewOf } from './model-state';

const status = (state: 'ready' | 'missing'): ModelStatus => ({
  type: 'models',
  models: [{ language: 'en', state, sizeBytes: 661_288_526 }],
});

const render = (state: 'ready' | 'missing', transient?: Parameters<typeof viewOf>[2]) =>
  renderToStaticMarkup(
    <LanguageModelsView
      rows={languageModelRows((code) =>
        viewOf(code, status(state), code === 'en' ? transient : undefined),
      )}
      onDownload={() => undefined}
    />,
  );

describe('LanguageModels', () => {
  it('lists every supported language, built from the registry', () => {
    const out = render('missing');
    for (const code of ['en', 'ja', 'ko', 'zh', 'vi']) {
      expect(out).toContain(`data-language="${code}"`);
    }
  });

  it('says where each runs: English on this machine, the rest in the cloud', () => {
    const rows = languageModelRows((code) => viewOf(code, status('ready')));
    expect(rows.find((row) => row.code === 'en')?.where).toBe('device');
    for (const code of ['ja', 'ko', 'zh', 'vi']) {
      expect(rows.find((row) => row.code === code)?.where).toBe('cloud');
    }
  });

  it('offers the download only for the on-device language that is missing', () => {
    const out = render('missing');
    expect(out).toContain('Tải mô hình ngay');
    expect(out).toContain('631 MB');
    expect(out.match(/Tải mô hình ngay/g)).toHaveLength(1);
  });

  it('has no download button once the model is ready', () => {
    const out = render('ready');
    expect(out).toContain('Đã sẵn sàng');
    expect(out).not.toContain('Tải mô hình ngay');
  });

  it('shows a running download as progress, not as a button', () => {
    const out = render('missing', { state: 'downloading', progress: 0.25 });
    expect(out).toContain('role="progressbar"');
    expect(out).toContain('25%');
    expect(out).not.toContain('Tải mô hình ngay');
  });

  it('says the cloud languages need no model', () => {
    expect(render('missing')).toContain('Không cần tải mô hình');
  });

  it('leaves out the on-device rows when the build cannot manage models (the section is hidden then)', () => {
    expect(languageModelRows((code) => viewOf(code, null)).map((row) => row.code)).toEqual([
      'ja',
      'ko',
      'zh',
      'vi',
    ]);
  });
});
