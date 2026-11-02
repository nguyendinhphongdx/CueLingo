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

## Kết luận spike (2026-11-01)

- **Thu âm hệ thống:** Core Audio Process Tap (`CATapDescription` + aggregate device + IOProc) chạy tốt trên macOS 26; tối thiểu macOS 14.2. Mic dùng `AVAudioEngine`. Cả hai qua `Resampler` về 16 kHz mono Int16. Frame đầu tới sau ~110 ms (hệ thống) và ~280 ms (mic).
- **Quyền:** macOS gắn quyền với **app bundle** chạy tiến trình. CLI trần (hoặc chạy dưới terminal/agent khác) không được hỏi quyền và nhận toàn số 0 (không có lỗi). Cần `Info.plist` có `NSAudioCaptureUsageDescription` và `NSMicrophoneUsageDescription`; app Tauri nhúng `src-tauri/Info.plist`. Để thử nhanh: gói binary thành `.app` ký ad-hoc và mở bằng `open -W -n --stdout <file> App.app --args …`.
- **Cầu Swift↔Rust:** chọn sidecar (Swift CLI trong bundle, Rust spawn và đọc stdout) thay cho FFI: tách crash, dễ test; chi tiết ở M1-02.

## Sidecar `cuelingo-audio` (M1)

- stdout: mỗi dòng một JSON: `{"type":"status","state":"loading|ready|error|stopped"}` và `{"type":"segment","segmentId","stream","startMs","endMs","text","words":[],"partial"}`. stdin: dòng `stop` kết thúc phiên. Nhiều ngôn ngữ (ADR 0013): biến môi trường `CUELINGO_LANGUAGE` (mặc định `en`) chọn model nhận dạng lúc khởi động (`en` → Parakeet TDT v2, `ja` → Parakeet TDT Japanese). Dòng stdin `language <mã>` đổi model giữa chừng: model cũ vẫn nhận dạng cho đến khi model mới nạp xong, nên caption không dừng. Sidecar phát thêm `{"type":"model","language","state":"downloading|ready|error","progress"}` khi tải/nạp model và `{"type":"stats","language","count","p50Ms","p95Ms"}` một lần lúc kết thúc (thời gian nhận dạng mỗi câu). Lõi Rust chuyển hai loại này thành sự kiện `audio-model`, lệnh `session_set_language` ghi dòng `language` vào stdin. Lịch (gợi ý ngôn ngữ trước giờ họp): chế độ một lần `--calendar-status`, `--calendar-request` (hiện hộp thoại quyền của macOS lần đầu) và `--calendar-events` (cuộc họp đang diễn ra hoặc bắt đầu trong 2 giờ tới, bỏ sự kiện cả ngày) in `{"type":"calendar","state":"granted|denied|undetermined","events":[{"title","startMs","endMs","location","attendeeDomains"}]}`. Người dự chỉ còn tên miền email; không lưu, không gửi lên máy chủ. Cần khoá `NSCalendarsFullAccessUsageDescription` trong `Info.plist`; khi ký với hardened runtime (P2-09) phải thêm entitlement `com.apple.security.personal-information.calendars`. App chỉ đọc lịch sau khi người dùng bật ở Cài đặt > Gợi ý từ lịch. Ngôn ngữ đoán từ tiêu đề/địa điểm/tên miền theo `calendarHints` của từng ngôn ngữ trong `SUPPORTED_LANGUAGES`.

Tự nhận ngôn ngữ: biến môi trường `CUELINGO_DETECT` (danh sách mã, ví dụ `ja`) cho sidecar nhận dạng vài giây đầu bằng cả model hiện tại lẫn model ứng viên (chỉ model đã có sẵn trên máy, không tải thêm) rồi so độ tự tin của chính model: nghe đúng ngôn ngữ thì model chắc chắn ≥ 0,99, nghe sai chỉ khoảng 0,77 đến 0,80 (đo với en/ja); văn bản phải đọc ra đúng ngôn ngữ ứng viên (NaturalLanguage). Nếu một ứng viên ≥ 0,95 và hơn model hiện tại ≥ 0,15, sidecar phát một lần `{"type":"language-suggestion","language","confidence"}`; không bao giờ tự đổi. Lần đầu nạp model ứng viên trong tiến trình mất tới vài chục giây đến hai phút nên gợi ý đến muộn hơn "vài giây". Người dùng đồng ý thì app gọi `PATCH /v1/sessions/:id` (đổi `language`), gửi `language.set` qua WebSocket (server đọc lại ngôn ngữ từ phiên) rồi gửi `language <mã>` cho sidecar.

Đo thực tế trên máy phát triển: tiếng Anh p50 182 ms, p95 249 ms (5 câu); tiếng Nhật (giọng tổng hợp `say`, 2 câu dài): đọc đúng toàn bộ câu, p50 116 ms, p95 189 ms; cần đo lại trên giọng người thật trước khi bật `ja`.

`--file x.wav` (16 kHz mono Int16) chạy một file qua cùng đường xử lý (test/demo, không cần quyền).

- Tách câu: VAD năng lượng (`UtteranceSegmenter`, im lặng 600 ms hoặc 15 s thì chốt câu), partial mỗi 0,7 s bằng cách nhận dạng lại đoạn đang nói. Model: Parakeet TDT v2 (tiếng Anh) của FluidAudio, tải ~500 MB lần đầu vào `~/Library/Application Support/FluidAudio`. Câu < 1 s được đệm im lặng (model lỗi "zero shape" nếu ngắn hơn).
- Mic khởi động ở luồng riêng vì có thể treo chờ quyền; system audio không phụ thuộc mic.
- Lỗi đã gặp: ký lại app ad-hoc mỗi lần build làm macOS hỏi lại quyền, và chờ hộp thoại làm treo tiến trình. Cần chứng chỉ ký ổn định (M5-05) để hết.
