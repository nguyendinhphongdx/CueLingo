import nodemailer from 'nodemailer';
import type { Config } from '../../config';
import { magicLinkEmail, type EmailContent } from './auth.email';

export interface Mailer {
  sendMagicLink(email: string, url: string): Promise<void>;
}

type MailConfig = Pick<
  Config,
  'NODE_ENV' | 'MAIL_PROVIDER' | 'MAIL_FROM' | 'RESEND_API_KEY' | 'SMTP_URL'
>;

export interface MailerDeps {
  fetch?: typeof fetch;
  /** Test seam for SMTP: receives the mail instead of a real server. */
  sendSmtp?: (message: { from: string; to: string } & EmailContent) => Promise<void>;
}

async function sendWithResend(
  apiKey: string,
  message: { from: string; to: string } & EmailContent,
  request: typeof fetch,
) {
  const response = await request('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    // The provider's reason (unverified domain, bad key) is what the operator needs; never the key itself.
    throw new Error(`Resend rejected the email (${response.status}): ${detail.slice(0, 300)}`);
  }
}

/**
 * Sends the sign-in email through the configured provider. `console` only prints the link and is for
 * local development: the config refuses to start production with it, so nothing pretends to send.
 */
export function createMailer(config: MailConfig, deps: MailerDeps = {}): Mailer {
  const from = config.MAIL_FROM ?? 'CueLingo <login@localhost>';

  return {
    async sendMagicLink(email, url) {
      const content = magicLinkEmail(url);
      const message = { from, to: email, ...content };

      if (config.MAIL_PROVIDER === 'resend') {
        await sendWithResend(config.RESEND_API_KEY!, message, deps.fetch ?? fetch);
        return;
      }
      if (config.MAIL_PROVIDER === 'smtp') {
        const send =
          deps.sendSmtp ??
          ((mail) =>
            nodemailer
              .createTransport(config.SMTP_URL!)
              .sendMail(mail)
              .then(() => undefined));
        await send(message);
        return;
      }
      if (config.NODE_ENV === 'production') {
        throw new Error('No email provider configured: magic links are disabled in production');
      }
      console.warn(`[dev mailer] magic link for ${email}: ${url}`);
    },
  };
}
