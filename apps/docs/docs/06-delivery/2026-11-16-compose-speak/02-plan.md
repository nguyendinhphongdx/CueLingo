# compose-speak — Plan

| Trạng thái | Người làm                             |
| ---------- | ------------------------------------- |
| Plan       | `ts-engineer` (toàn bộ là TypeScript) |

## 1. Phát hiện khi đọc code

- Cài đặt người dùng lưu trong cột JSONB `learner_profiles.settings` (`settings.repository.ts`), nên thêm `ttsVoice` **không cần migration**. Dữ liệu cũ thiếu khoá thì rơi về mặc định `Kore`.
- `tts.service.ts` hiện dùng hằng `VOICE = 'Kore'`; khoá cache là hash của `v1|voice|text`, sẵn chỗ để thêm giọng.
- `POST /v1/tts` nhận `{text}` (strict), trả WAV, có header `x-tts-cache`.

## 2. Phương án

|       | A. Máy chủ đọc giọng từ cài đặt, request có thêm `voice` tuỳ chọn để nghe thử                                           | B. Client luôn gửi `voice` trong mỗi request                 |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Cách  | `tts` nhận hàm `getVoice(userId)` từ nơi ghép module (`app.ts`); thứ tự: `voice` trong request, rồi cài đặt, rồi `Kore` | Client đọc cài đặt và gửi kèm                                |
| Ưu    | Mọi chỗ phát tiếng (Ôn tập, tra từ, Nói giúp, web, desktop) tự dùng đúng giọng, không client nào phải nhớ gửi           | Máy chủ đơn giản                                             |
| Nhược | Thêm một phụ thuộc vào module `settings`                                                                                | Quên gửi ở một client là sai giọng; mỗi client lặp lại logic |

**Chọn A.** Hợp với luật `userId` chỉ từ auth và "một chỗ làm một việc".

## 3. Các bước

| #   | Việc                                                                                                                                                                          | Chỗ                                             | Test                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | `TTS_VOICES` (6 giọng) + `TtsVoiceSchema`; `ttsVoice` vào `UserSettingsSchema`, `DEFAULT_USER_SETTINGS`, `UpdateUserSettingsSchema`; `TtsRequestSchema` thêm `voice` tuỳ chọn | `packages/shared/src/dto/{tts,settings}.dto.ts` | `settings.dto.test.ts` (mặc định `Kore`, giọng lạ bị từ chối)                                     |
| 2   | Repository đọc/ghi `ttsVoice` trong JSON, thiếu khoá thì `Kore`                                                                                                               | `settings.repository.ts`                        | `settings.test.ts` (dữ liệu cũ, ranh giới người dùng)                                             |
| 3   | `tts.service` nhận `getVoice`, khoá cache thêm giọng, truyền giọng vào gateway                                                                                                | `tts.service.ts`, `app.ts`                      | `tts.test.ts`: AC4, AC5, cache không lẫn giọng, 429 (AC6), 400 giọng lạ (AC7), không log nội dung |
| 4   | Client: `core-sdk` gửi `voice` tuỳ chọn; kiểu cài đặt theo `@cuelingo/shared`                                                                                                 | `packages/core-sdk/src/`                        | test client                                                                                       |
| 5   | Component hàng phương án: `SpeakableOption` (nút Nghe dùng `useSpeaker`, nút Sao chép, trạng thái), viết ở `@cuelingo/ui`; `shared-ui.test.ts` pass                           | `packages/ui/src/components/`                   | AC2, AC3                                                                                          |
| 6   | Bảng Nói giúp dùng `SpeakableOption`, bỏ bước "chọn rồi sao chép"                                                                                                             | `apps/desktop/src/quick-assist/`                | `QuickAssistPanel.test.tsx` (AC1)                                                                 |
| 7   | Cài đặt có mục "Giọng đọc" + nút Nghe thử câu mẫu cố định (gửi `voice` để thử trước khi lưu); desktop và web cùng dùng một component                                          | `apps/desktop/src/settings/`, `apps/web`        | test màn hình                                                                                     |
| 8   | Docs: trang module `tts` và `settings`, `quick-assist.md`, `ui.md`; `pnpm docs:build`                                                                                         | `apps/docs/docs/04-modules/`                    | build link                                                                                        |

## 4. Rủi ro và giả định

| #   |                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Giọng Gemini nghe khác nhau theo model (flash-lite và dự phòng flash). Chưa nghe thử cả 6 giọng trên bản lite; sẽ nghe thật ở bước 7 và bỏ giọng nào lỗi hoặc kém khỏi danh sách |
| R2  | Đổi giọng làm cache cũ thành "miss" một lần cho người đổi; tốn vài lượt tạo, nằm trong hạn mức 20/phút                                                                           |
| R3  | Cache là chung giữa người dùng cho cùng giọng và văn bản (hiện đã vậy). Không thêm dữ liệu cá nhân vào khoá                                                                      |
| G1  | Hạn mức 20 lượt/phút giữ nguyên, không phân gói (đã duyệt)                                                                                                                       |
| G2  | Danh sách giọng: Kore, Puck, Charon, Aoede, Fenrir, Leda (đã duyệt)                                                                                                              |
| G3  | Không migration, không nhà cung cấp mới, không breaking API (`voice` chỉ thêm tuỳ chọn)                                                                                          |

## 5. Kiểm khi xong

`pnpm verify`, `pnpm docs:build`, và chạy thật: soạn câu trong họp tiếng Anh, bấm Nghe (thấy vòng quay rồi tiếng), Sao chép, đổi giọng trong Cài đặt rồi nghe lại.
