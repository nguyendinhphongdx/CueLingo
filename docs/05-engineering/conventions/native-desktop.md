# Convention · Native desktop (Swift, Rust)

Áp dụng cho `apps/desktop/native/macos-audio` (Swift) và `apps/desktop/src-tauri` (Rust). Chưa có module mẫu chạy thật; module `audio-capture` sẽ là mẫu đầu tiên.

| #   | Luật                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Native chỉ làm việc cần native: audio, STT on-device, cửa sổ, phím tắt, Keychain. Logic sản phẩm ở TypeScript                                                        |
| 2   | Ranh giới Swift ↔ Rust ↔ webview là **danh sách command/event có tên** ghi trong [tauri-core](../../03-parts/desktop/tauri-core.md). Thêm command → cập nhật bảng đó |
| 3   | Payload qua ranh giới là JSON có schema; phía TypeScript parse bằng Zod                                                                                              |
| 4   | Không ghi audio ra đĩa trừ khi người dùng bật lưu audio ([ADR-0006](../../adr/0006-no-audio-by-default.md))                                                          |
| 5   | Thread audio realtime không cấp phát bộ nhớ, không chặn I/O, không log mỗi frame                                                                                     |
| 6   | Token chỉ lưu trong Keychain, không trong file hay `localStorage`                                                                                                    |
| 7   | Mọi thay đổi native phải chạy thật trên máy (một cuộc gọi Zoom/Meet thử), không chỉ build xanh                                                                       |
| 8   | Rust: `cargo fmt`, `cargo clippy -- -D warnings`. Swift: `swift-format`. Không `unwrap()` / `!` ở đường có thể lỗi                                                   |
