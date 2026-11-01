import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages ship TypeScript source (no build step), so Next must compile them.
  transpilePackages: ['@cuelingo/ui', '@cuelingo/shared', '@cuelingo/core-sdk'],
};

export default config;
