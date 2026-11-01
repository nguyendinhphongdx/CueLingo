/** The only place the web app reads environment variables. NEXT_PUBLIC_* are inlined at build time. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';
export const DOWNLOAD_URL = process.env.NEXT_PUBLIC_DOWNLOAD_URL?.trim() || null;
export const IS_DEV = process.env.NODE_ENV !== 'production';
