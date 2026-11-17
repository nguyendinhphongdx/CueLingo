// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, createCode } = vi.hoisted(() => ({ getSession: vi.fn(), createCode: vi.fn() }));
vi.mock('../../lib/auth-client', () => ({ authClient: { getSession } }));
vi.mock('../../lib/client', () => ({ client: { device: { createCode } } }));

import { AppAuthPage } from './AppAuthPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;

const flush = () => act(async () => void (await Promise.resolve()));
const button = (text: string) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent === text);

beforeEach(async () => {
  getSession.mockReset().mockResolvedValue({ data: { user: { id: 'u' } } });
  createCode.mockReset().mockResolvedValue({ code: 'one-time' });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <AppAuthPage />
      </QueryClientProvider>,
    );
  });
  await flush();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('AppAuthPage consent step', () => {
  it('asks first and issues no code before the person decides', () => {
    expect(host.textContent).toContain('Cho CueLingo trên máy này vào tài khoản?');
    expect(button('Cho phép')).toBeDefined();
    expect(button('Không phải tôi, huỷ')).toBeDefined();
    expect(createCode).not.toHaveBeenCalled();
  });

  it('focuses cancel, not allow, when the step opens', () => {
    expect(document.activeElement).toBe(button('Không phải tôi, huỷ'));
  });

  it('cancelling never issues a code', async () => {
    await act(async () => button('Không phải tôi, huỷ')!.click());
    await flush();
    expect(createCode).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Không có mã nào được tạo');
    expect(button('Cho phép')).toBeUndefined();
  });

  it('allowing issues exactly one code', async () => {
    await act(async () => button('Cho phép')!.click());
    await flush();
    expect(createCode).toHaveBeenCalledTimes(1);
  });
});
