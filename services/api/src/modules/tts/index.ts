/**
 * TTS — Giọng đọc tiếng Anh cho bài nghe và phát âm cụm từ; lưu theo mã băm của văn bản để mỗi câu chỉ tạo một lần.
 */
import { ttsRoutes } from './tts.routes';
import { createTtsService, type TtsDeps } from './tts.service';

export function createTtsModule(deps: TtsDeps) {
  const tts = createTtsService(deps);
  return { tts, routes: ttsRoutes(tts) };
}

export type { TtsDeps } from './tts.service';
export type { TtsCache } from './tts.cache';
export { createFileTtsCache, createInMemoryTtsCache } from './tts.cache';
