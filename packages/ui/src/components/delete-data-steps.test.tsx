// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canConfirmDeleteData,
  DELETE_DATA_ITEMS,
  DELETE_DATA_PHRASE,
  DeleteDataSteps,
} from './delete-data-steps';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (label: string) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent === label) as HTMLButtonElement;

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function mount(props: Partial<Parameters<typeof DeleteDataSteps>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  act(() =>
    root.render(
      <DeleteDataSteps
        items={['Một', 'Hai']}
        pending={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />,
    ),
  );
  return { onConfirm, onCancel };
}

describe('DeleteDataSteps', () => {
  it('step 1 lists what is lost and has no input yet', () => {
    mount();
    expect(host.textContent).toContain('Bước 1 trên 2');
    expect(host.textContent).toContain('Một');
    expect(host.textContent).toContain('Hai');
    expect(host.querySelector('input')).toBeNull();
  });

  it('the shared list mentions AI conversations and not learning settings', () => {
    const text = DELETE_DATA_ITEMS.join(' ');
    expect(text).toContain('trợ lý AI');
    expect(text).not.toContain('cài đặt');
  });

  it('step 2 starts with the focus on Huỷ and keeps the delete button off', () => {
    mount();
    act(() => button('Tiếp tục').click());
    expect(host.textContent).toContain('Bước 2 trên 2');
    expect(host.textContent).toContain(DELETE_DATA_PHRASE);
    expect(document.activeElement).toBe(button('Huỷ'));
    expect(button('Xác nhận xoá').disabled).toBe(true);
  });

  it('turns the delete button on only for the exact phrase', () => {
    const { onConfirm } = mount();
    act(() => button('Tiếp tục').click());
    const input = host.querySelector('input')!;
    type(input, 'xoa du lieu');
    expect(button('Xác nhận xoá').disabled).toBe(true);
    type(input, 'XOA DU LIEU ');
    expect(button('Xác nhận xoá').disabled).toBe(true);
    type(input, 'XOA DU LIEU');
    expect(button('Xác nhận xoá').disabled).toBe(false);
    expect(canConfirmDeleteData('XOA DU LIEU ')).toBe(false);
    act(() => button('Xác nhận xoá').click());
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('cancels from either step without deleting', () => {
    const { onConfirm, onCancel } = mount();
    act(() => button('Huỷ').click());
    act(() => button('Tiếp tục').click());
    act(() => button('Huỷ').click());
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables everything while deleting', () => {
    mount({ pending: true });
    act(() => button('Tiếp tục').click());
    expect(host.querySelector('input')!.disabled).toBe(true);
    expect(button('Huỷ').disabled).toBe(true);
    expect(host.textContent).toContain('Đang xoá…');
  });
});
