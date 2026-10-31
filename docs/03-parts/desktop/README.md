# Desktop app

> Code: `apps/desktop/` · Stack: Tauri 2 (Rust) + React/TypeScript + module Swift cho audio trên macOS · Giai đoạn: MVP (macOS) · Windows ở giai đoạn Learn

App người dùng dùng trong cuộc họp: thu âm, STT on-device, overlay caption song ngữ, Quick Assist. Đây là bề mặt chính của MVP.

## Modules

| Module                                      | Code                                      | Trách nhiệm                                                                                                          |
| ------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [Audio capture](audio-capture.md)           | `native/macos-audio/Sources/AudioCapture` | Thu audio hệ thống (người khác) và mic (người dùng) thành hai luồng tách biệt, kèm VAD local.                        |
| [Local STT](local-stt.md)                   | `native/macos-audio/Sources/LocalSTT`     | Nhận dạng giọng nói tiếng Anh ngay trên máy bằng Parakeet-TDT 0.6B v3 (CoreML/Neural Engine), phát partial và final. |
| [Tauri core](tauri-core.md)                 | `src-tauri/src`                           | Lớp Rust của app: cửa sổ, phím tắt toàn cục, cầu nối native ↔ webview, bảo mật token, cập nhật.                      |
| [Session controller](session-controller.md) | `src/session`                             | Máy trạng thái của một cuộc họp phía client: kết nối backend, giữ danh sách câu, áp dụng Assist level.               |
| [Caption overlay](overlay.md)               | `src/overlay`                             | Cửa sổ caption song ngữ nổi trên app họp.                                                                            |
| [Quick Assist](quick-assist.md)             | `src/quick-assist`                        | Tra từ theo ngữ cảnh, "Họ vừa nói gì?", "Nói giúp tôi" + teleprompter.                                               |
| [Onboarding](onboarding.md)                 | `src/onboarding`                          | Đăng nhập, cấp quyền, khai báo mục tiêu và bài nghe đánh giá ban đầu.                                                |
| [Settings](settings.md)                     | `src/settings`                            | Cài đặt trong app: phím tắt, Assist mặc định, lưu audio, nguồn STT.                                                  |

## Quan hệ với phần khác

Xem [sơ đồ hệ thống](../../00-overview/system-overview.md).
