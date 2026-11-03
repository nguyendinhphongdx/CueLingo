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

## Phụ thuộc

- [AudioCap](https://github.com/insidegui/AudioCap) (mẫu, BSD-2)
- [Silero VAD](https://github.com/snakers4/silero-vad) (MIT)

## Dữ liệu & sự kiện

- Không ghi audio ra đĩa trừ khi người dùng bật lưu audio

## Câu hỏi mở

- Hỗ trợ tối thiểu macOS 13 hay 14.4? (ảnh hưởng lựa chọn Process Tap)
