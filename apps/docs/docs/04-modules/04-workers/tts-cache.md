# TTS cache

> Phần: [Workers](./README.md) · Code: `services/workers/src/jobs/tts-cache/`

Sinh và cache audio TTS cho cụm từ mới trong Phrase Bank.

## Trách nhiệm

- TTS tiếng Anh cho cụm và câu ví dụ
- Lưu object storage, khoá theo hash văn bản + giọng

## Phạm vi MVP

- F5

## Interface

- Job `tts.render {text, voice}`

## Phụ thuộc

- `@cuelingo/ai-gateway` (TtsProvider)

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- TTS cloud hay Kokoro self-host?
