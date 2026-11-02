import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../config';
import { magicLinkEmail } from './auth.email';
import { createMailer } from './auth.mailer';

const URL_WITH_QUERY = 'http://localhost:4000/api/auth/magic-link/verify?token=abc&callbackURL=x';

describe('sign-in email', () => {
  it('is in Vietnamese, carries the link and says when it expires', () => {
    const mail = magicLinkEmail(URL_WITH_QUERY);
    expect(mail.subject).toBe('Đăng nhập CueLingo');
    expect(mail.text).toContain(URL_WITH_QUERY);
    expect(mail.text).toContain('5 phút');
    expect(mail.html).toContain('lang="vi"');
  });

  it('escapes the link so it cannot break out of the HTML', () => {
    const mail = magicLinkEmail('https://x.test/?a=1&b="><script>alert(1)</script>');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&amp;b=&quot;&gt;&lt;script&gt;');
  });
});

describe('mailer', () => {
  const base = { NODE_ENV: 'development' as const };

  it('sends through Resend with the key in the header and the link in the body', async () => {
    const fetcher = vi.fn(async () => Response.json({ id: 'email_1' }));
    const mailer = createMailer(
      {
        ...base,
        MAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_secret',
        MAIL_FROM: 'CueLingo <login@cuelingo.app>',
      },
      { fetch: fetcher as unknown as typeof fetch },
    );
    await mailer.sendMagicLink('a@example.com', URL_WITH_QUERY);

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_secret');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ from: 'CueLingo <login@cuelingo.app>', to: ['a@example.com'] });
    expect(body.text).toContain(URL_WITH_QUERY);
  });

  it("reports the provider's reason when Resend refuses, without leaking the key", async () => {
    const fetcher = vi.fn(
      async () => new Response('{"message":"domain not verified"}', { status: 403 }),
    );
    const mailer = createMailer(
      { ...base, MAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_secret', MAIL_FROM: 'x <x@y.z>' },
      { fetch: fetcher as unknown as typeof fetch },
    );
    const failure = await mailer
      .sendMagicLink('a@example.com', URL_WITH_QUERY)
      .catch((e: Error) => e);
    expect((failure as Error).message).toContain('403');
    expect((failure as Error).message).toContain('domain not verified');
    expect((failure as Error).message).not.toContain('re_secret');
  });

  it('sends through SMTP', async () => {
    const sendSmtp = vi.fn(async () => undefined);
    const mailer = createMailer(
      {
        ...base,
        MAIL_PROVIDER: 'smtp',
        SMTP_URL: 'smtp://u:p@host:587',
        MAIL_FROM: 'CueLingo <a@b.c>',
      },
      { sendSmtp },
    );
    await mailer.sendMagicLink('a@example.com', URL_WITH_QUERY);
    expect(sendSmtp).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@example.com',
        from: 'CueLingo <a@b.c>',
        subject: 'Đăng nhập CueLingo',
      }),
    );
  });

  it('only prints the link in development with the console provider, and refuses in production', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await createMailer({ ...base, MAIL_PROVIDER: 'console' }).sendMagicLink(
      'a@example.com',
      URL_WITH_QUERY,
    );
    expect(warn).toHaveBeenCalledOnce();
    await expect(
      createMailer({ NODE_ENV: 'production', MAIL_PROVIDER: 'console' }).sendMagicLink(
        'a@example.com',
        URL_WITH_QUERY,
      ),
    ).rejects.toThrow('No email provider');
    warn.mockRestore();
  });
});

describe('mail config', () => {
  const env = { DATABASE_URL: 'postgres://u:p@h/db', BETTER_AUTH_SECRET: 'x'.repeat(32) };

  it('defaults to the console provider in development', () => {
    expect(loadConfig({ ...env, NODE_ENV: 'development' }).MAIL_PROVIDER).toBe('console');
  });

  it('names what is missing for each provider', () => {
    expect(() => loadConfig({ ...env, MAIL_PROVIDER: 'resend' })).toThrow('RESEND_API_KEY');
    expect(() => loadConfig({ ...env, MAIL_PROVIDER: 'smtp', MAIL_FROM: 'a <a@b.c>' })).toThrow(
      'SMTP_URL',
    );
  });

  it('refuses to start production with the console provider', () => {
    expect(() => loadConfig({ ...env, NODE_ENV: 'production' })).toThrow('MAIL_PROVIDER');
    expect(
      loadConfig({
        ...env,
        NODE_ENV: 'production',
        MAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_x',
        MAIL_FROM: 'CueLingo <a@b.c>',
      }).MAIL_PROVIDER,
    ).toBe('resend');
  });
});
