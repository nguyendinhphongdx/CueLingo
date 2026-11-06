import type { NextConfig } from 'next';
import { assistantCsp } from './src/lib/csp';

const config: NextConfig = {
  // Workspace packages ship TypeScript source (no build step), so Next must compile them.
  transpilePackages: ['@cuelingo/ui', '@cuelingo/shared', '@cuelingo/core-sdk'],
  async headers() {
    return [
      {
        // The chat can show blocks the assistant wrote (ADR 0019): only the sandbox runner may be framed here.
        source: '/assistant/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            // Build-time config, the one place besides `src/lib/config.ts` that reads this variable.
            value: assistantCsp(process.env.NEXT_PUBLIC_SANDBOX_ORIGIN),
          },
        ],
      },
    ];
  },
};

export default config;
