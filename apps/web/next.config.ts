import type { NextConfig } from 'next';
import { assistantCsp, sandboxOriginOf } from './src/lib/csp';

const config: NextConfig = {
  // Workspace packages ship TypeScript source (no build step), so Next must compile them.
  transpilePackages: ['@cuelingo/ui', '@cuelingo/shared', '@cuelingo/core-sdk'],
  async headers() {
    return [
      {
        // The chat can show blocks the assistant wrote (ADR 0019): only the sandbox runner may be framed. On every
        // route, not just /assistant: a client-side navigation to /assistant keeps the policy of the page the person
        // landed on, so a policy limited to one route would not apply to them.
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            // Build-time config, the one place besides `src/lib/config.ts` that reads this variable.
            value: assistantCsp(
              sandboxOriginOf(process.env.NEXT_PUBLIC_SANDBOX_ORIGIN, [
                process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
              ]),
            ),
          },
        ],
      },
    ];
  },
};

export default config;
