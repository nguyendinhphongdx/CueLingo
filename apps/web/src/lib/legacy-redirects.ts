/**
 * Addresses from before Hôm nay, Kho cụm từ and Tiến độ became the three tabs of `/review`. One list feeds
 * `next.config.ts` (server build) and `public/_redirects` (static build); a test keeps them equal.
 */
export const LEGACY_REDIRECTS = [
  { source: '/phrases', destination: '/review?tab=phrases' },
  { source: '/progress', destination: '/review?tab=progress' },
] as const;
