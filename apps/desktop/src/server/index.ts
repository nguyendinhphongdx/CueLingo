/**
 * Server — which API and web app the desktop talks to (build value, or the one the person chose).
 * Design: apps/docs/docs/04-modules/01-desktop/server.md
 */
export { checkServer, type ServerCheck } from './check-server';
export {
  defaultServer,
  resetServer,
  saveServer,
  serverConfig,
  validateServerUrl,
  type ServerChoice,
  type ServerConfig,
  type UrlCheck,
} from './server-config';
