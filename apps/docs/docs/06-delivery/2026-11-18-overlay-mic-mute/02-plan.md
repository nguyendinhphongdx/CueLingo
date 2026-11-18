# Plan — overlay-mic-mute

## 1. Bối cảnh code

- **Điểm mở rộng:** UI overlay (`apps/desktop/src/overlay`) + ranh giới native ↔ webview (bảng command/event ở `04-modules/01-desktop/tauri-core.md`). Không đụng contract `@cuelingo/shared`, DB, AI.
- **Convention:** `native-desktop.md` (Swift/Rust), `web-feature.md` (TS). Mẫu cùng loại: lệnh stdin `language` / `vocab` đi từ `session_set_language` (`commands.rs`) → `audio_bridge.rs` → `main.swift` / `session.rs`.
- **Hiện trạng:**
  - Sidecar macOS (`Sidecar/main.swift`): `micCapture.start/stop` có sẵn, vòng lệnh stdin đọc `stop`/`vocab`/`language`. `MicCapture.stop()` gỡ tap + dừng engine (tắt chấm cam).
  - Sidecar Windows (`windows-audio/src/session.rs`): hai `Capture` (`system`, `mic`) có `start(sink)`/`stop()`; vòng lệnh cùng giao thức.
  - Rust: `AppState` giữ trạng thái dùng chung (ví dụ `assist_level`); `route_line` chuyển dòng sidecar thành sự kiện Tauri; `audio-status` đi tới mọi cửa sổ.
  - Overlay là cửa sổ riêng với cửa sổ chính (chạy session-controller), nên trạng thái mic phải do Rust giữ và phát cho cả hai.
  - `audio-level-store.ts` đánh dấu `micSilent` khi im lặng, sẽ báo "Chưa có âm thanh" sai nếu mic tắt có chủ ý.

## 2. Phương án

| #   | Phương án                                                      | Ưu                                                            | Nhược                                                   |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| A   | Sidecar dừng/mở lại luồng micro theo lệnh `mic off` / `mic on` | Tắt thật (chấm cam tắt, không STT, không gửi cloud); đúng AC3 | Sửa 2 sidecar + Rust + TS; phải thử cuộc gọi thật       |
| B   | Micro vẫn mở, sidecar vứt mẫu âm thanh của luồng mic           | Đổi ít, không cần mở lại thiết bị                             | Chấm cam macOS vẫn sáng, người dùng không tin là đã tắt |
| C   | Chỉ TS: controller bỏ qua segment/utterance `stream: 'mic'`    | Nhanh nhất                                                    | Micro vẫn bắt và nhận dạng cục bộ; không đạt AC3        |

**Chọn A** (người dùng đã chọn "tắt thật"). Trạng thái do Rust giữ và sidecar xác nhận bằng dòng `{"type":"mic","muted":bool}`, nên UI luôn theo trạng thái thật (nếu mở lại micro lỗi thì vẫn thấy lỗi hiện có, không giả vờ đã bật).

| Tác động                            | Có?          | Chi tiết                                                                  |
| ----------------------------------- | ------------ | ------------------------------------------------------------------------- |
| DB migration                        | Không        |                                                                           |
| Contract (`@cuelingo/shared`)       | Không        | Chỉ giao thức nội bộ sidecar ↔ Rust ↔ webview (zod trong `lib/native.ts`) |
| Event / Learner Model               | Không        | Không đổi event gửi lên server                                            |
| Prompt / model AI                   | Không        |                                                                           |
| Quyền riêng tư / dữ liệu người dùng | Có, tích cực | Tắt mic dừng hẳn việc thu và gửi giọng người dùng; không log gì mới       |

## 3. Các bước (mỗi bước ≈ 1 commit)

| #   | Bước                                                                                                                                                                                        | File                                                                                                           | Điểm mở rộng                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Sidecar macOS: lệnh `mic off`/`mic on` dừng/mở lại `micCapture` (xả câu đang dở bằng `mic.finish()` khi tắt), in `{"type":"mic","muted":…}`; cập nhật chú thích giao thức đầu file          | `native/macos-audio/Sources/Sidecar/main.swift` (+ `AudioCapture/MicCapture.swift` nếu cần mở lại engine)      | Native                                               |
| 2   | Sidecar Windows: cùng lệnh qua `Capture::stop/start` của `mic`; thêm hàm dựng dòng `mic` ở `protocol.rs` + test                                                                             | `native/windows-audio/src/{session,protocol}.rs`                                                               | Native                                               |
| 3   | Rust core: `AppState.mic_muted`, command `session_set_mic_muted(muted)` ghi stdin `mic off                                                                                                  | on`; `route_line`đưa dòng`mic`thành sự kiện`mic-state`(mọi cửa sổ);`session_start`/`stop` đặt lại về bật; test | `src-tauri/src/{audio_bridge,commands,lib,state}.rs` | tauri-core |
| 4   | TS client: `native.setMicMuted`, `native.onMicState` (zod); hook `useMicMuted` (nghe `mic-state`, về `false` khi hết phiên)                                                                 | `src/lib/native.ts`, `src/session/use-mic-muted.ts` (+ test)                                                   | Client                                               |
| 5   | Overlay: nút micro cạnh nút "Ẩn overlay" (`Mic`/`MicOff`, `aria-pressed`, tooltip, vô hiệu khi `micFailed`) + chỉ báo "Micro đã tắt"; `audio-level-store` không báo `micSilent` khi mic tắt | `src/overlay/CaptionOverlay.tsx` (+ test), `src/session/audio-level-store.ts`                                  | UI overlay                                           |
| 6   | Cửa sổ chính: hàng "Micro" trong `SessionPanel` hiện "Đã tắt" khi mic tắt                                                                                                                   | `src/session/SessionPanel.tsx` (+ test)                                                                        | UI                                                   |
| 7   | Docs cùng commit cuối: bảng command/event ở `tauri-core.md`, mục overlay và session-panel trong `04-modules/01-desktop/`; `pnpm verify` + `pnpm docs:build`                                 | `apps/docs/docs/04-modules/01-desktop/*.md`                                                                    | Docs                                                 |

Thứ tự code: 1 → 3 → 4 → 5 → 6 → 2 (Windows làm sau vì không thử được trên máy Mac này; giao thức đã cố định ở bước 1 và 3). Bước 1 và 2 giao `native-engineer`, còn lại `ts-engineer` hoặc luồng chính.

## 4. Rủi ro

| Rủi ro                                                                  | Giảm thiểu                                                                                                              |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `AVAudioEngine` mở lại sau khi dừng không ổn, hoặc `installTap` hai lần | `stop()` luôn `removeTap`; `start()` dựng lại `Resampler`; thử bật/tắt nhiều lần trong một cuộc gọi thật                |
| Mở lại micro lỗi (mất quyền, thiết bị rút) mà UI tưởng đã bật           | Sidecar chỉ in `muted:false` khi `start` thành công; lỗi in `status error "microphone: …"` như hiện có                  |
| Câu đang nói dở bị mất khi bấm tắt                                      | Gọi `mic.finish()` để xả; kiểm bằng test pipeline/thử thật                                                              |
| Windows chưa thử trên máy thật                                          | Test đơn vị cho dòng giao thức + vòng lệnh; ghi rõ "chưa thử WASAPI thật" ở `03-review.md`, giao phiên Windows kiểm lại |
| Trạng thái lệch giữa overlay và cửa sổ chính                            | Một nguồn sự thật (Rust + xác nhận từ sidecar), cả hai cửa sổ chỉ nghe `mic-state`                                      |
| Người dùng quên đã tắt mic                                              | Chỉ báo "Micro đã tắt" luôn hiện trên overlay và cửa sổ chính (AC4); tự bật lại khi sang cuộc họp mới (AC5)             |
