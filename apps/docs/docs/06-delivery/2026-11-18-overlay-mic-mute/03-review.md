# Review — overlay-mic-mute

## 1. Thay đổi so với plan

| Plan                                                  | Thực tế                                                                                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio-level-store` không báo `micSilent` khi mic tắt | Làm ở `AudioLevelRows` (thẻ Micro ghi "Micro đã tắt"), store không đổi; gọn hơn và cùng kết quả.                                                                |
| `AppState.mic_muted` do Rust giữ                      | Cờ nằm trong `AudioBridge` (cập nhật khi `route_line` thấy dòng `mic`), thêm command `session_mic_muted` để cửa sổ mở giữa họp đọc lại. Sửa sau review độc lập. |
| —                                                     | Thêm `skip` ở segmenter (Swift và Rust) để mốc thời gian câu mic không bị lệch sau khi tắt. Sửa sau review.                                                     |
| —                                                     | Windows: tách `Pipeline::flush` khỏi `finish` (trước đó mic tắt rồi bật thì mất caption mic). Sửa sau review, có test.                                          |
| Nút chỉ hiện khi đang nghe (AC1)                      | Nút luôn hiện trên overlay; bấm khi không có cuộc họp thì bị bỏ qua êm. Overlay không biết chắc có phiên chạy (xem rủi ro).                                     |
| Ngoài spec: màu chữ caption                           | Người dùng yêu cầu giữa chừng: token `--caption-text` (đen/trắng thật), chữ không còn bị xám hoặc mờ; tách commit riêng.                                        |

## 2. Tự review (kèm review độc lập bằng agent `code-reviewer`)

- 🔴 Windows mất caption mic sau khi bật lại: đã sửa (`flush`) và có test `the_microphone_is_recognised_again_after_it_was_switched_off_and_on`.
- 🟡 Swift `micCapture.stop()` lúc dừng họp chạy ngoài `micQueue`: đã đổi thành `micQueue.sync`.
- 🟡 Mốc thời gian lệch sau khi tắt: đã sửa ở cả hai sidecar.
- 🟡 Trạng thái mất khi cửa sổ tải lại: đã sửa bằng `session_mic_muted`.
- 🟡 Nút bị vô hiệu hẳn sau khi mở lại micro lỗi: giờ chỉ vô hiệu khi micro chưa từng mở được; sau khi mở lại lỗi vẫn bấm thử lại được.
- 🟡 Windows `mic_open` ban đầu: đã đúng theo kết quả `start` thật, có test.
- 🟡 CRLF bị đổi ở `commands.rs`, `lib.rs`: đã khôi phục, diff còn vài dòng.
- 🟢 `mic-state` phát trước `audio.start` để không xoá nhầm cờ lỗi; `native.setMicMuted` đã là `async`.

## 3. Đã chạy thật

| Việc                                                      | Kết quả                                                |
| --------------------------------------------------------- | ------------------------------------------------------ |
| `pnpm verify` (format, lint, typecheck, test, check:deps) | Xanh                                                   |
| `pnpm docs:build`                                         | Xanh                                                   |
| `cargo test` (src-tauri) · `cargo test` (windows-audio)   | Xanh (32 · 23 test)                                    |
| `swift build` (macOS sidecar)                             | Biên dịch được; chỉ còn cảnh báo cũ                    |
| Cuộc họp thật trên macOS (bật/tắt nhiều lần)              | Người dùng đã thử bản dev trên cuộc gọi thật và báo ổn |
| Windows (WASAPI) trên máy thật                            | **Chưa chạy** (chỉ test đơn vị)                        |

## 4. Thứ tự đọc cho người review

1. `native/macos-audio/Sources/Sidecar/main.swift` (`micQueue`, `stopMic`, `resumeMic`) và `MicCapture.swift`.
2. `native/windows-audio/src/{session,pipeline,segmenter}.rs` + `tests/session.rs`.
3. `src-tauri/src/{audio_bridge,commands}.rs`.
4. `src/session/use-mic-muted.ts`, `src/overlay/CaptionOverlay.tsx`, `SessionPanel.tsx`.
5. Commit riêng: `packages/ui/src/styles/globals.css`, `CaptionBlock.tsx` (màu chữ).

## 5. Rủi ro còn lại

- Chưa thử thật: toàn bộ WASAPI trên Windows.
- Khi tắt, câu đang nói dở vẫn được nhận dạng (cloud: gửi đi) rồi mới dừng. Người dùng thường tắt mic vì sắp nói chuyện riêng; nếu muốn bỏ hẳn câu dở thì đổi `finish`/`flush` thành bỏ, cần quyết định.
- Mẩu âm thanh còn trong callback tap lúc tắt có thể dính vào câu đầu sau khi bật lại (rủi ro thấp).
- Nút micro hiện cả khi chưa họp (overlay không biết chắc có phiên); bấm lúc đó không làm gì.
