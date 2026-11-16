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
- Được gọi từ `tauri-core` qua FFI (swift-rs) hoặc Tauri plugin

## Bản Windows (`native/windows-audio`)

Cùng giao thức và cùng hợp đồng 16 kHz mono Int16 với bản macOS ([ADR 0020](../../08-adr/0020-windows-capture-stt.md)); lõi Tauri và TypeScript không biết đang nói chuyện với bản nào. Phần thu âm viết bằng Rust, đứng sau trait `Capture` (`src/capture.rs`):

| Phần                                               | Trạng thái                                                                                                                                                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Capture` (`start(sink)`, `stop()`, `available()`) | Có. `sink` nhận từng khối 16 kHz mono Int16 từ luồng thu âm; **không được cấp phát, chặn I/O hay log mỗi khối**: bản thật chép vào vòng đệm cấp sẵn, luồng khác lo tách câu và nhận dạng                                                                  |
| Bản thật: loopback hệ thống + micro bằng WASAPI    | **Chưa** (bước 7 của hồ sơ windows-desktop, cần máy Windows thật). Mọi bản dựng hiện dùng `Unavailable`: họp báo `windows: capture and captions are not available in this Windows build yet` và **không tải model**                                       |
| `Resampler` (`src/resample.rs`)                    | Có. Rate bất kỳ, 1..n kênh xen kẽ → 16 kHz mono Int16; lọc sinc cửa sổ Hann (có low-pass trước khi giảm tần số) nên 48 kHz không bị răng cưa; cho ra cùng kết quả với mọi cỡ khối; không cấp phát khi `out` đủ chỗ. Thay `AVAudioConverter` của bản Swift |
| `Segmenter`, `LevelMeter`, `UtterancePCM`          | Có, port 1-1 từ `UtteranceSegmenter`, `LevelMeter`, `UtterancePCM` (Swift); mỗi luồng một `Pipeline`                                                                                                                                                      |

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
