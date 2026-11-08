import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoginScreen } from '../auth/LoginScreen';
import { ServerLinkView, ServerSettingsView } from './ServerPicker';

describe('server entry points', () => {
  it('shows a small "Máy chủ" link on the sign-in screen (AC2)', () => {
    const markup = renderToStaticMarkup(
      <LoginScreen
        phase="idle"
        onSignIn={() => {}}
        serverSlot={<ServerLinkView onOpen={() => {}} />}
      />,
    );
    expect(markup).toContain('>Máy chủ<');
  });

  it('leaves the sign-in screen as before when no slot is given', () => {
    const markup = renderToStaticMarkup(<LoginScreen phase="idle" onSignIn={() => {}} />);
    expect(markup).not.toContain('Máy chủ');
  });

  it('offers the change in Settings → Nâng cao and names the server in use (AC3)', () => {
    const markup = renderToStaticMarkup(
      <ServerSettingsView host="api.beta.example" custom={false} onOpen={() => {}} />,
    );
    expect(markup).toContain('Nâng cao');
    expect(markup).toContain('Đổi máy chủ');
    expect(markup).toContain('CueLingo Beta (mặc định): api.beta.example');
  });

  it('says when the server is a custom one', () => {
    const markup = renderToStaticMarkup(
      <ServerSettingsView host="api.other.example" custom onOpen={() => {}} />,
    );
    expect(markup).toContain('Tuỳ chỉnh: api.other.example');
  });
});
