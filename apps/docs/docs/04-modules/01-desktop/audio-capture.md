# Audio capture

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/native/macos-audio/Sources/AudioCapture/`

Thu audio hệ thống (người khác) và mic (người dùng) thành hai luồng tách biệt, kèm VAD local.

## Trách nhiệm

- Thu audio hệ thống bằng Core Audio Process Tap (macOS 14.4+), dự phòng ScreenCaptureKit (macOS 13+)
- Thu mic bằng AVAudioEngine
- Chuẩn hoá về PCM 16 kHz mono float32, frame 20 ms, gắn timestamp đơn điệu
- VAD bằng Silero VAD (ONNX) để cắt đoạn có tiếng nói, giảm dữ liệu gửi đi
- Loại trừ audio do chính app phát ra (TTS)
- Báo trạng thái quyền (Screen & System Audio Recording, Microphone)

## Phạm vi MVP

- US-01, US-03 (F1, F2)
- Không làm virtual mic (Đợt 4 cùng voice mode, dùng libASPL)

## Interface

- `start(sources: [.system, .mic])` / `stop()`
- Callback `onFrame(stream, pcm, tsMs)` và `onSpeech(stream, .start|.end, tsMs)`
- `permissionStatus() -> {system, mic}`
- **Quyền micro:** sidecar có `--permissions` (đọc), `--request-microphone` (hiện hộp thoại lần đầu rồi in kết quả). Khi họp, trước khi mở `AVAudioEngine` sidecar đọc quyền: `authorized` thì thu; `denied` thì phát `status error "microphone: not authorized (denied)"`; `notDetermined` thì phát `…(undetermined)` rồi xin quyền tại chỗ, được cấp thì phát `status ready "microphone: authorized"` và thu. Ba chuỗi này cố định (app so khớp, xem `micPermissionOf`). Âm thanh hệ thống không phụ thuộc micro.
- **Quyền âm thanh hệ thống:** không có API đọc, nên `--check-system-audio` bật tap, phát `Ping.aiff` mỗi 2 s tối đa 12 s (đủ để người dùng bấm Cho phép lần đầu) và trả `granted` ngay khi nghe được, hết giờ thì `silent`.
- **Entitlements:** hardened runtime cần `com.apple.security.device.audio-input`, nếu thiếu macOS từ chối micro mà không hỏi (ADR [0026](../../08-adr/0026-macos-fixed-signing-certificate.md))
- Được gọi từ `tauri-core` qua FFI (swift-rs) hoặc Tauri plugin

## Bản Windows (`native/windows-audio`)

Cùng giao thức và cùng hợp đồng 16 kHz mono Int16 với bản macOS ([ADR 0020](../../08-adr/0020-windows-capture-stt.md)); lõi Tauri và TypeScript không biết đang nói chuyện với bản nào. Phần thu âm viết bằng Rust, đứng sau trait `Capture` (`src/capture.rs`):

| Phần                                                                            | Trạng thái                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Capture` (`start(sink)`, `stop()`, `available()`)                              | Có. `sink` nhận từng khối 16 kHz mono Int16 từ luồng thu âm; **không được cấp phát, chặn I/O hay log mỗi khối**: bản thật chép vào vòng đệm cấp sẵn, luồng khác lo tách câu và nhận dạng                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Bản thật: loopback hệ thống + micro bằng WASAPI (`src/wasapi.rs`, crate `cpal`) | Có (chỉ `cfg(windows)`). Loopback là input stream dựng trên thiết bị **output** mặc định, micro là thiết bị input mặc định; mỗi luồng một thread vì `Stream` của cpal không `Send`. Callback âm thanh chỉ chép vào hàng đợi cấp sẵn, thread đó mỗi 20 ms lấy ra, resample rồi gọi `sink`. Lỗi mang tiền tố `system audio:` hoặc `microphone:`; micro bị chặn trong Windows (`ConsentStore`) thì `start` báo ngay mà luồng kia vẫn chạy. `--check-system-audio` trả `granted` nếu mở được loopback (Windows không có quyền "ghi âm hệ thống"). **Chưa thử** cuộc họp 10 phút, cắm/rút tai nghe và Bluetooth |
| Mở lại (`src/reopen.rs`)                                                        | Có. Stream lỗi nặng hoặc thiết bị mặc định đổi thì mở lại: chờ 0,3 s, gấp đôi mỗi lần, trần 5 s, bỏ cuộc sau 12 lần (khoảng 44 s) và báo lỗi. `Xrun`, `DeviceChanged`, `RealtimeDenied` của cpal **không** làm hỏng stream nên không mở lại. Loopback không phát gói nào khi hệ thống im lặng, nên "không có dữ liệu" không phải lỗi                                                                                                                                                                                                                                                                       |
| `Pump` (`src/pump.rs`)                                                          | Có. Đẩy f32 xen kẽ qua `Resampler` rồi tới `sink`; tách khỏi WASAPI để test trên mọi nền tảng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `Resampler` (`src/resample.rs`)                                                 | Có. Rate bất kỳ, 1..n kênh xen kẽ → 16 kHz mono Int16; lọc sinc cửa sổ Hann (có low-pass trước khi giảm tần số) nên 48 kHz không bị răng cưa; cho ra cùng kết quả với mọi cỡ khối; không cấp phát khi `out` đủ chỗ. Thay `AVAudioConverter` của bản Swift                                                                                                                                                                                                                                                                                                                                                  |
| `Segmenter`, `LevelMeter`, `UtterancePCM`                                       | Có, port 1-1 từ `UtteranceSegmenter`, `LevelMeter`, `UtterancePCM` (Swift); mỗi luồng một `Pipeline`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Chạy được và kiểm được trên Mac (không cần Windows): `cargo test` trong `native/windows-audio`, và `cuelingo-audio --file a.wav` (WAV 16-bit PCM, rate và số kênh bất kỳ; lặp `--file` để chạy nhiều file trong một phiên).

## Vector kiểm chung Swift và Rust

Hai bản cài đặt, một hành vi: `apps/desktop/native/fixtures/{segmenter,level,pcm,vocabulary}.json` do **cả hai** bộ test đọc (`SharedFixturesTests.swift` cho `swift test`, `tests/fixtures.rs` cho `cargo test`). Đổi hành vi tách câu, đo mức, đóng gói PCM hay sửa thuật ngữ ở một bên mà không đổi bên kia thì một trong hai bộ test đỏ. Muốn đổi hành vi: sửa vector trước, rồi sửa cả hai bên.

## Phụ thuộc

- [AudioCap](https://github.com/insidegui/AudioCap) (mẫu, BSD-2)
- [Silero VAD](https://github.com/snakers4/silero-vad) (MIT)

## Dữ liệu & sự kiện

- Không ghi audio ra đĩa trừ khi người dùng bật lưu audio

## Câu hỏi mở

- Hỗ trợ tối thiểu macOS 13 hay 14.4? (ảnh hưởng lựa chọn Process Tap)
