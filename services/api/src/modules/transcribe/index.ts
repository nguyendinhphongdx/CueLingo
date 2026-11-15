/**
 * Transcribe — Nhận dạng đám mây từng câu cho cuộc họp bằng ngôn ngữ chưa có model trên máy (tiếng Việt); không lưu âm thanh.
 * Design: apps/docs/docs/04-modules/03-api/transcribe.md · ADR: apps/docs/docs/08-adr/0014-cloud-stt-for-vietnamese.md
 */
import type { SessionsRepository } from '../sessions';
import type { UsageService } from '../usage';
import { transcribeRoutes } from './transcribe.routes';
import { createTranscribeService, type TranscribeDeps } from './transcribe.service';

export function createTranscribeModule(
  sessions: Pick<SessionsRepository, 'findById'>,
  usage: Pick<UsageService, 'reserve'>,
  deps: TranscribeDeps,
) {
  const service = createTranscribeService(sessions, usage, deps);
  return { service, routes: transcribeRoutes(service) };
}

export type { TranscribeDeps, TranscribeService } from './transcribe.service';
