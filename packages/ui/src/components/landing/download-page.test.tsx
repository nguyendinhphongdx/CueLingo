import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DownloadPage } from './download-page';
import type { LandingLinkProps } from './landing-link';
import { LandingView } from './landing-view';

function MarkedLink({ href, className, children, ...rest }: LandingLinkProps) {
  return (
    <a href={href} className={className} data-host-link="" {...rest}>
      {children}
    </a>
  );
}

describe('landing components in @cuelingo/ui', () => {
  it('draw every link through the host link component and host paths', () => {
    const paths = { home: '/site/', download: '/site/download/', login: null };
    const download = renderToStaticMarkup(
      <DownloadPage downloadUrl={null} link={MarkedLink} paths={paths} />,
    );
    const landing = renderToStaticMarkup(<LandingView link={MarkedLink} paths={paths} />);

    expect(download).toContain('data-host-link');
    expect(download).toContain('href="/site/"');
    expect(landing).toContain('href="/site/download/"');
  });

  it('hide every sign-in link when the host has no login path', () => {
    const paths = { home: '/', download: '/download/', login: null };
    const markup =
      renderToStaticMarkup(<DownloadPage downloadUrl={null} paths={paths} />) +
      renderToStaticMarkup(<LandingView paths={paths} />);

    expect(markup).not.toContain('Đăng nhập');
    expect(markup).not.toContain('/login');
  });

  it('fall back to plain anchors and the web paths when the host passes nothing', () => {
    const markup = renderToStaticMarkup(<LandingView />);

    expect(markup).toContain('href="/download"');
    expect(markup).toContain('href="/login"');
  });
});
