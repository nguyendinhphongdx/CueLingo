import tauriConfig from '../../src-tauri/tauri.conf.json';

export const APP_NAME = 'CueLingo';
export const APP_TAGLINE = 'Trợ lý caption song ngữ cho cuộc họp đa ngôn ngữ';
/** The bundle's own version: read from `tauri.conf.json` at build time so it can never drift. */
export const APP_VERSION: string = tauriConfig.version;
