import type { Config } from '../../config';

export interface Mailer {
  sendMagicLink(email: string, url: string): Promise<void>;
}

/**
 * Development mailer: prints the link, nothing leaves the machine.
 * Production has no email provider yet (chosen before beta), so it refuses loudly
 * instead of pretending a link was sent.
 */
export function createMailer(config: Pick<Config, 'NODE_ENV'>): Mailer {
  return {
    async sendMagicLink(email, url) {
      if (config.NODE_ENV === 'production') {
        throw new Error('No email provider configured: magic links are disabled in production');
      }
      console.warn(`[dev mailer] magic link for ${email}: ${url}`);
    },
  };
}
