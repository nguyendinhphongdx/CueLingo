import { describe, expect, it } from 'vitest';
import { checkEnv } from './check-env.mjs';

const prod = { production: true };
const good = { NEXT_PUBLIC_API_URL: 'https://api.example.com' };

describe('checkEnv', () => {
  it('passes a production build with a public https API address', () => {
    expect(checkEnv(good, prod)).toEqual([]);
  });

  it('fails a production build without the API address, or with one that is not public', () => {
    expect(checkEnv({}, prod).join()).toContain('NEXT_PUBLIC_API_URL is not set');
    expect(checkEnv({ NEXT_PUBLIC_API_URL: '  ' }, prod)).toHaveLength(1);
    expect(checkEnv({ NEXT_PUBLIC_API_URL: 'nonsense' }, prod)).toHaveLength(1);
    expect(checkEnv({ NEXT_PUBLIC_API_URL: 'http://localhost:4000' }, prod).join()).toContain(
      'this machine',
    );
    expect(checkEnv({ NEXT_PUBLIC_API_URL: 'http://api.example.com' }, prod).join()).toContain(
      'https',
    );
  });

  it('asks for nothing outside production', () => {
    expect(checkEnv({}, { production: false })).toEqual([]);
    expect(
      checkEnv({ NEXT_PUBLIC_API_URL: 'http://localhost:4000' }, { production: false }),
    ).toEqual([]);
  });

  it('checks the optional variables only when they are set', () => {
    expect(
      checkEnv(
        {
          ...good,
          NEXT_PUBLIC_SANDBOX_ORIGIN: 'https://runner.example.net',
          NEXT_PUBLIC_AGENT_HTML_BLOCKS: 'true',
        },
        prod,
      ),
    ).toEqual([]);
    expect(checkEnv({ ...good, NEXT_PUBLIC_SANDBOX_ORIGIN: 'x' }, prod)).toHaveLength(1);
    expect(
      checkEnv({ ...good, NEXT_PUBLIC_SANDBOX_ORIGIN: 'https://api.example.com/run' }, prod),
    ).toHaveLength(1);
    expect(checkEnv({ ...good, NEXT_PUBLIC_AGENT_HTML_BLOCKS: 'true' }, prod).join()).toContain(
      'SANDBOX_ORIGIN',
    );
    expect(checkEnv({ ...good, NEXT_PUBLIC_GOOGLE_ENABLED: 'yes' }, prod)).toHaveLength(1);
    expect(checkEnv({ ...good, NEXT_PUBLIC_DOWNLOAD_URL: 'ftp://x' }, prod)).toHaveLength(1);
  });
});
