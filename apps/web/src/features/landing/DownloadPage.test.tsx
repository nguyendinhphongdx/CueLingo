import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DownloadPage } from './DownloadPage';

describe('DownloadPage', () => {
  it('shows the system requirement, installation path, and disabled release action', () => {
    const markup = renderToStaticMarkup(<DownloadPage downloadUrl={null} />);

    expect(markup).toContain('macOS 14.2 trở lên');
    expect(markup).toContain('Applications');
    expect(markup).toContain('Microphone');
    expect(markup).toContain('Screen &amp; System Audio Recording');
    expect(markup).toContain('Sắp có bản tải');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('min-h-11');
  });

  it('links to the configured release when a URL is available', () => {
    const markup = renderToStaticMarkup(
      <DownloadPage downloadUrl="https://downloads.example.com/CueLingo.dmg" />,
    );

    expect(markup).toContain('href="https://downloads.example.com/CueLingo.dmg"');
    expect(markup).toContain('Tải cho macOS');
    expect(markup).not.toContain('Sắp có bản tải');
  });

  it('explains how to open an app Apple has not notarized, and what to redo after an update', () => {
    const markup = renderToStaticMarkup(<DownloadPage downloadUrl={null} />);

    expect(markup).toContain('Open Anyway');
    expect(markup).toContain('macOS 14');
    expect(markup).toContain('macOS 15');
    expect(markup).toContain('Sau mỗi lần CueLingo tự cập nhật');
  });
});
