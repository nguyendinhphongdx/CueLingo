# Plan — vi-cloud-stt

## 1. Bối cảnh code

| Chỗ                                 | Hiện trạng                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `packages/shared/src/languages.ts`  | Registry có `en` (bật) và `ja` (tắt); mỗi ngôn ngữ có `recognizer`. Cột `language` trong DB là chuỗi, không có ràng buộc CHECK |
| Sidecar Swift                       | Tách câu bằng VAD (`Pipeline`), nhận dạng bằng `Transcriber.recognize` (model Parakeet). `SpeechModels` chỉ biết `en`, `ja`    |
| `src-tauri/src/audio_bridge.rs`     | `route_line` chuyển dòng sidecar thành sự kiện Tauri (`segment`, `audio-status`, `audio-model`)                                |
| `session-controller.ts`             | Nhận `segment` từ native, gửi `segment.final` (luồng `system`) lên API qua WebSocket                                           |
| `services/api/src/modules/realtime` | Đọc ngôn ngữ của cuộc họp từ phiên, dịch từng câu final                                                                        |
| `services/workers/.../debrief`      | Tạo debrief theo `session.language`                                                                                            |
| `packages/ai-gateway`               | Task theo tên; `speech.ts` đã gọi Gemini REST cho TTS, có key `GEMINI_API_KEY`                                                 |
| ADR                                 | 0003 nói STT on-device mặc định, có cloud dự phòng; 0006 mặc định không lưu audio; 0013 đa ngôn ngữ                            |

## 2. Phương án

| #   | Phương án                                                                                                                                             | Ưu                                                                                                                        | Nhược                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| A   | Sidecar tách câu rồi gửi PCM của **từng câu** tới API; API gọi Gemini qua ai-gateway (`stt.transcribe`); văn bản trả về đi đúng đường segment hiện có | Dùng key và nhà cung cấp đã có; không cần model mới trên máy; transcript lưu sẵn, debrief chạy như cũ; xong trong ~1 ngày | Âm thanh rời máy (cần đồng ý và ADR); trễ vài giây mỗi câu; chất lượng tiếng Việt phụ thuộc Gemini                                   |
| B   | Nhận dạng trên máy bằng Cohere Transcribe (FluidAudio, beta, có `vi`)                                                                                 | Âm thanh không rời máy                                                                                                    | Beta; encoder 1,8 GB và khoảng 7 GB RAM; xử lý theo cửa sổ 35 giây, không hợp caption trực tiếp; cần tích hợp mới, không kịp hôm nay |
| C   | Chỉ ghi file âm thanh rồi nhận dạng sau họp                                                                                                           | Đơn giản về độ trễ                                                                                                        | Bạn đã nói chưa cần ghi âm; vẫn cần STT; không có transcript trong họp                                                               |

**Chọn A.** Hợp thời hạn, không cần lưu audio, và đúng luật 5 (mọi lời gọi AI qua `@cuelingo/ai-gateway`). B là hướng dài hạn nếu cần giữ âm thanh trên máy; mở lại sau.

**ADR cần viết (luật 8):** gửi âm thanh tới một nhà cung cấp (Gemini) cho ngôn ngữ chưa có model trên máy, kèm điều kiện đồng ý và không lưu. Đề xuất số 0014.

| Tác động                            | Có?         | Chi tiết                                                                                       |
| ----------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| DB migration                        | Không       | `language` là chuỗi; không lưu audio                                                           |
| Contract (`@cuelingo/shared`)       | Có          | `vi` trong registry; schema `TranscribeRequest`/`TranscribeResponse`; mã lỗi                   |
| Event / Learner Model               | Không       | Họp tiếng Việt không cập nhật Learner Model                                                    |
| Prompt / model AI                   | Có          | Task `stt.transcribe` (Gemini, âm thanh vào); prompt debrief cho tiếng Việt                    |
| Quyền riêng tư / dữ liệu người dùng | **Có, lớn** | Âm thanh cuộc họp rời máy. Đồng ý trước, biểu tượng đang gửi, không lưu server, không log, ADR |

## 3. Các bước

| #   | Bước                                                                                                                                                                                                                                   | Điểm mở rộng         | Ai làm               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------- |
| 1   | ADR 0014 + cập nhật `privacy-security`/ADR liên quan                                                                                                                                                                                   | ADR                  | Claude               |
| 2   | Contract: `vi` trong registry (nhận dạng đám mây), `TranscribeRequest/Response`, test registry                                                                                                                                         | Contract             | `ts-engineer`        |
| 3   | ai-gateway: task `stt.transcribe@v1` (Gemini âm thanh vào), ghi `ai_call`; API `POST /v1/sessions/:id/transcribe` (copy `glossary`, kiểm quyền sở hữu, giới hạn kích thước/tần suất); realtime bỏ qua dịch khi `vi`; client `core-sdk` | AI task + API module | `ts-engineer`        |
| 4   | Sidecar Swift: ngôn ngữ `vi` không tải model, mỗi câu phát sự kiện `utterance` (PCM 16 kHz base64); Rust chuyển tiếp                                                                                                                   | Desktop (native)     | `native-engineer`    |
| 5   | Desktop TS: xử lý `utterance` (tải lên API, thử lại một lần, tạo segment và gửi `segment.final`), hộp thoại đồng ý và biểu tượng đang gửi, thêm tiếng Việt vào bộ chọn                                                                 | Desktop module       | `ts-engineer`        |
| 6   | Debrief tiếng Việt: prompt (`debrief/v2` nếu v1 không đủ) và worker; khối học để trống                                                                                                                                                 | AI task + worker job | `ts-engineer`        |
| 7   | Docs module (`local-stt`, `tauri-core`, `session-controller`, `api/realtime`)                                                                                                                                                          | Docs                 | Claude               |
| 8   | Chạy thật: bạn nói tiếng Việt khoảng 2 phút, xem transcript, kết thúc họp, xem debrief                                                                                                                                                 | —                    | Bạn chạy, Claude ghi |

Thứ tự: 2 trước; 3, 4 chạy song song sau 2; 5 sau khi có hợp đồng của 2 và sự kiện của 4; 6 độc lập sau 2. Review độc lập (Claude `code-reviewer` và Codex) trước khi commit, như P2-04.

## 4. Rủi ro

| Rủi ro                                                            | Giảm thiểu                                                                                                                          |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Gemini nhận dạng tiếng Việt kém với tiếng ồn hoặc nhiều người nói | Thử 2 phút ở bước 8 trước họp thật; giữ nguyên transcript thô để bạn tự chỉnh khi làm brief                                         |
| Độ trễ mỗi câu vượt 4 giây                                        | Gửi theo câu, song song nhiều câu, thử lại một lần; đo ở bước 8                                                                     |
| Âm thanh người dự họp rời máy                                     | Đồng ý trước, biểu tượng đang gửi, bạn báo người dự họp; không lưu; ADR                                                             |
| Chi phí                                                           | Gemini tính theo giây âm thanh; đo `ai_call` ở bước 8 và ghi chi phí mỗi giờ họp                                                    |
| Kịp thời hạn hôm nay hoặc ngày mai                                | Nếu bước 8 chưa đạt trước giờ họp thì nói thẳng; dự phòng: bật phụ đề/transcript có sẵn của nền tảng họp (nếu có hỗ trợ tiếng Việt) |
| VAD tách câu cho họp tiếng Việt chưa thử                          | Bước 8 kiểm; chỉnh ngưỡng nếu cần                                                                                                   |
