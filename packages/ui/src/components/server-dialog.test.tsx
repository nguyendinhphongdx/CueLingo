// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SERVER_CHECK_FAILED_CONFIRM_TEXT,
  SERVER_SIGNOUT_TEXT,
  ServerDialog,
  serverWarningText,
  type ServerDialogProps,
} from './server-dialog';

afterEach(cleanup);

const DEFAULT = { api: 'https://api.beta.example', web: 'https://beta.example' };

function validate(url: string) {
  const text = url.trim();
  if (text === '') return { ok: false as const, reason: 'Hãy nhập địa chỉ máy chủ.' };
  if (!text.startsWith('https://')) {
    return { ok: false as const, reason: 'Chỉ chấp nhận địa chỉ bắt đầu bằng https://.' };
  }
  return { ok: true as const, url: text.replace(/\/+$/, '') };
}

function setup(overrides: Partial<ServerDialogProps> = {}) {
  const props: ServerDialogProps = {
    open: true,
    current: DEFAULT,
    defaultChoice: DEFAULT,
    devMode: false,
    signedIn: false,
    validate,
    onCheck: vi.fn(async () => ({ ok: true as const })),
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<ServerDialog {...props} />);
  return props;
}

const typeCustom = (api: string, web: string) => {
  fireEvent.click(screen.getByLabelText(/Tuỳ chỉnh/));
  fireEvent.change(screen.getByLabelText('Địa chỉ API'), { target: { value: api } });
  fireEvent.change(screen.getByLabelText('Địa chỉ web'), { target: { value: web } });
};

describe('ServerDialog presets (AC4)', () => {
  it('lists the default and custom choices, and hides localhost in a release build', () => {
    setup();
    expect(screen.getByLabelText(/CueLingo Beta \(mặc định\)/)).toBeTruthy();
    expect(screen.getByLabelText(/Tuỳ chỉnh…/)).toBeTruthy();
    expect(screen.queryByLabelText(/localhost/)).toBeNull();
  });

  it('shows localhost only in a development build', () => {
    setup({ devMode: true });
    expect(screen.getByLabelText(/localhost/)).toBeTruthy();
  });

  it('renders nothing while closed', () => {
    const { container } = render(
      <ServerDialog
        open={false}
        current={DEFAULT}
        defaultChoice={DEFAULT}
        devMode={false}
        signedIn={false}
        validate={validate}
        onCheck={async () => ({ ok: true })}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('ServerDialog custom address (AC5)', () => {
  it('explains why an address is refused and does not allow saving it', () => {
    const props = setup();
    typeCustom('http://evil.example', 'https://web.example');
    expect(screen.getByText('Chỉ chấp nhận địa chỉ bắt đầu bằng https://.')).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Lưu' });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(save);
    expect(props.onSave).not.toHaveBeenCalled();
  });
});

describe('ServerDialog test connection (AC6)', () => {
  it('reports success for the chosen address', async () => {
    const props = setup();
    typeCustom('https://api.other.example/', 'https://other.example');
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết nối' }));
    await screen.findByText('Kết nối được.');
    expect(props.onCheck).toHaveBeenCalledWith('https://api.other.example');
  });

  it('reports a failure with its cause', async () => {
    setup({ onCheck: async () => ({ ok: false, cause: 'Máy chủ không phản hồi.' }) });
    typeCustom('https://api.other.example', 'https://other.example');
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết nối' }));
    expect(await screen.findByText(/Không kết nối được\. Máy chủ không phản hồi\./)).toBeTruthy();
  });

  it('drops the old result when the address changes', async () => {
    setup();
    typeCustom('https://api.other.example', 'https://other.example');
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết nối' }));
    await screen.findByText('Kết nối được.');
    fireEvent.change(screen.getByLabelText('Địa chỉ API'), {
      target: { value: 'https://api.third.example' },
    });
    expect(screen.queryByText('Kết nối được.')).toBeNull();
  });
});

describe('ServerDialog saving after a failed check (AC7)', () => {
  it('asks again after a failed check and saves only on the explicit second step', async () => {
    const props = setup({ onCheck: async () => ({ ok: false, cause: 'Không phản hồi.' }) });
    typeCustom('https://api.other.example', 'https://other.example');
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết nối' }));
    await screen.findByText(/Không kết nối được\./);

    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(SERVER_CHECK_FAILED_CONFIRM_TEXT)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Vẫn lưu' }));
    await waitFor(() =>
      expect(props.onSave).toHaveBeenCalledWith({
        api: 'https://api.other.example',
        web: 'https://other.example',
      }),
    );
  });

  it('saves in one step when the check passed or was not run', async () => {
    const props = setup();
    typeCustom('https://api.other.example', 'https://other.example');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
  });
});

describe('ServerDialog warning (AC8)', () => {
  it('names the destination and says the session ends when signed in', () => {
    setup({ signedIn: true });
    typeCustom('https://api.other.example', 'https://other.example');
    expect(screen.getByText(serverWarningText('api.other.example'))).toBeTruthy();
    expect(screen.getByText(new RegExp(SERVER_SIGNOUT_TEXT))).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lưu và đăng xuất' })).toBeTruthy();
  });

  it('has nothing to save while the current server is selected', () => {
    setup();
    expect((screen.getByRole('button', { name: 'Lưu' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/Tài khoản và nội dung cuộc họp/)).toBeNull();
  });
});

describe('ServerDialog reset (AC10)', () => {
  it('goes back to the default choice, which then saves like any other', async () => {
    const props = setup({
      current: { api: 'https://api.other.example', web: 'https://other.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại mặc định' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(DEFAULT));
  });

  it('does not offer a reset when already on the default', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Đặt lại mặc định' })).toBeNull();
  });

  it('closes with Escape and the cancel button', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});
