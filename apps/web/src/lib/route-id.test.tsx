import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { idsAfter, PLACEHOLDER_ID } from './route-id';
import { useRouteId } from './use-route-id';

let pathname: string | null = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

describe('idsAfter', () => {
  it('reads the id of /sessions/<id>', () => {
    expect(idsAfter('/sessions/abc-123', '/sessions')).toEqual(['abc-123']);
    expect(idsAfter('/sessions/abc-123/', '/sessions')).toEqual(['abc-123']);
  });

  it('reads no id for /assistant and the id for /assistant/<id>', () => {
    expect(idsAfter('/assistant', '/assistant')).toEqual([]);
    expect(idsAfter('/assistant/', '/assistant')).toEqual([]);
    expect(idsAfter('/assistant/c1', '/assistant')).toEqual(['c1']);
  });

  it('never returns the placeholder the static build prerenders', () => {
    expect(idsAfter(`/sessions/${PLACEHOLDER_ID}`, '/sessions')).toEqual([]);
    expect(idsAfter(`/assistant/${PLACEHOLDER_ID}`, '/assistant')).toEqual([]);
  });

  it('decodes percent-encoding and survives a broken one', () => {
    expect(idsAfter('/sessions/a%20b', '/sessions')).toEqual(['a b']);
    expect(idsAfter('/sessions/%E0%A4%A', '/sessions')).toEqual(['%E0%A4%A']);
  });

  it('ignores other paths and a missing pathname', () => {
    expect(idsAfter('/sessionsX/abc', '/sessions')).toEqual([]);
    expect(idsAfter('/glossary', '/sessions')).toEqual([]);
    expect(idsAfter(null, '/sessions')).toEqual([]);
  });
});

describe('useRouteId', () => {
  beforeEach(() => {
    pathname = '/';
  });

  const render = (base: string) => {
    function Probe() {
      return <span>{useRouteId(base) ?? 'none'}</span>;
    }
    return renderToStaticMarkup(<Probe />);
  };

  it('gives the id from the current URL', () => {
    pathname = '/sessions/s1';
    expect(render('/sessions')).toBe('<span>s1</span>');
    pathname = '/assistant/c9';
    expect(render('/assistant')).toBe('<span>c9</span>');
  });

  it('gives none on /assistant and on the placeholder page', () => {
    pathname = '/assistant';
    expect(render('/assistant')).toBe('<span>none</span>');
    pathname = `/sessions/${PLACEHOLDER_ID}`;
    expect(render('/sessions')).toBe('<span>none</span>');
  });
});
