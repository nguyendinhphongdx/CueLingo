---
title: Native Swift
---

# Scaffold · Native Swift (`apps/desktop/native/macos-audio`)

**Kết quả:** một Swift package thu audio hệ thống + mic thành hai luồng PCM 16 kHz, chạy VAD, và (bước sau) STT on-device bằng FluidAudio. Rust gọi được package này và đẩy sự kiện lên webview. Đây là phần rủi ro kỹ thuật cao nhất, nên **bắt đầu bằng một spike** rồi mới dựng chính thức.

Thiết kế: [audio-capture](../../04-modules/01-desktop/audio-capture.md), [local-stt](../../04-modules/01-desktop/local-stt.md), [Luồng realtime](../../03-architecture/04-realtime-pipeline.md). Quyết định: [ADR-0003](../../08-adr/0003-stt-on-device-first.md), [ADR-0006](../../08-adr/0006-no-audio-by-default.md).

## Bước 0 — Spike (bắt buộc, 1–2 ngày)

Trả lời ba câu hỏi, ghi kết quả vào hồ sơ task và sửa trang này:

| Câu hỏi                                  | Cách thử                                                                         | Phương án                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Rust gọi Swift thế nào?                  | Hàm Swift `@_cdecl` trả số, gọi từ Rust                                          | **swift-rs** (Swift package build cùng `cargo` qua `build.rs`) hoặc static lib + `extern "C"` tự viết |
| Swift đẩy frame/sự kiện về Rust thế nào? | Callback C (`@convention(c)`) gọi 50 lần/giây                                    | Callback C con trỏ hàm; Rust chuyển sang channel → Tauri event                                        |
| Thu audio hệ thống trên máy dev          | Process Tap (macOS 14.4+) với mẫu AudioCap; dự phòng ScreenCaptureKit audio-only | Chốt macOS tối thiểu — mở câu hỏi trong [roadmap](../../02-product/04-roadmap.md)                     |

Kết luận spike → nếu đổi hướng (ví dụ không dùng swift-rs), viết ADR.

## Cây thư mục

```text
native/macos-audio/
├── Package.swift                 library product "MacOSAudio", macOS ≥ (theo spike)
├── Sources/
│   ├── AudioCapture/             Process Tap / SCK + AVAudioEngine → PCM 16 kHz mono, frame 20 ms
│   ├── LocalSTT/                 FluidAudio + Parakeet-TDT 0.6B v3 (sau)
│   └── Bridge/                   API C duy nhất mà Rust thấy (@_cdecl): start, stop, permissions, set callbacks
└── Tests/                        test chuyển đổi định dạng, VAD trên file mẫu
```

Phía Rust: `src-tauri/src/audio_bridge.rs` khai báo các hàm của `Bridge`, nhận callback, phát Tauri event `transcript` / `speech`.

## Quyền và cấu hình macOS

- `Info.plist` của app: mô tả quyền micro (`NSMicrophoneUsageDescription`) và quyền thu audio hệ thống (khoá tương ứng của Core Audio tap / Screen Recording — xác nhận trong spike).
- Hardened runtime + entitlement audio input khi ký/notarize.
- Onboarding hướng dẫn cấp quyền ([onboarding](../../04-modules/01-desktop/onboarding.md)).

## Luật

Theo [native-desktop](../conventions/native-desktop.md): thread audio không cấp phát, không chặn, không log mỗi frame; không ghi audio ra đĩa nếu người dùng chưa bật lưu; không có logic sản phẩm trong Swift.

## Definition of Done

- [ ] Spike có kết luận ghi trong hồ sơ; trang này đã sửa theo thực tế.
- [ ] Trong một cuộc gọi Zoom/Meet thử: log phía Rust đếm frame của cả hai luồng (`system`, `mic`), VAD báo `start/end` đúng lúc có người nói.
- [ ] Từ chối quyền → app báo trạng thái rõ ràng, không crash.
- [ ] `swift test` xanh; `cargo clippy` sạch.
