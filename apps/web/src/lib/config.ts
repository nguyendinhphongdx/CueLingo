import { originOf } from './csp';

/** The only place the web app reads environment variables. NEXT_PUBLIC_* are inlined at build time. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';
export const DOWNLOAD_URL = process.env.NEXT_PUBLIC_DOWNLOAD_URL?.trim() || null;
export const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Interactive blocks written by the assistant (ADR 0019, layer 2). Both must be set: the flag mirrors the API's
 * `AGENT_HTML_BLOCKS`, the origin is the sandbox runner (never this app's own origin). Without them a block is
 * not drawn at all.
 */
export const SANDBOX_ORIGIN = originOf(process.env.NEXT_PUBLIC_SANDBOX_ORIGIN);
export const HTML_BLOCKS_ENABLED =
  process.env.NEXT_PUBLIC_AGENT_HTML_BLOCKS === 'true' && SANDBOX_ORIGIN !== null;
