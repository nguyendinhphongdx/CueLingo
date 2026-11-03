import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KeepMounted, keepMountedMode } from './keep-mounted';

describe('KeepMounted', () => {
  it('renders nothing until opened, shows when open, and hides rather than unmounts after', () => {
    expect(keepMountedMode(false, false)).toBe('unmounted');
    expect(keepMountedMode(true, false)).toBe('hidden');
    expect(keepMountedMode(true, true)).toBe('visible');
    expect(keepMountedMode(false, true)).toBe('visible');
  });

  it('renders markup by mode', () => {
    expect(renderToStaticMarkup(<KeepMounted open={false}>x</KeepMounted>)).toBe('');
    expect(renderToStaticMarkup(<KeepMounted open>x</KeepMounted>)).toBe('<div>x</div>');
  });
});
