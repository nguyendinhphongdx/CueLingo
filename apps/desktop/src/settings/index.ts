/**
 * Settings — Cài đặt trong app: phím tắt, Assist mặc định, lưu audio, nguồn STT.
 * Design: apps/docs/docs/04-modules/01-desktop/settings.md
 */
export { AssistSettings } from './AssistSettings';
export { useSettings, type SelectableAssistLevel } from './settings-store';
export { useSettingsSync } from './use-settings-sync';
export { AssistSuggestionBanner } from './AssistSuggestionBanner';
export { useLanguage, useLearnLanguage } from './use-language';
