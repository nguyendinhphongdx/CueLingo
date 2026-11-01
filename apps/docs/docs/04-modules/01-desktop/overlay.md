# Caption overlay

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src/overlay/`

Cửa sổ caption song ngữ nổi trên app họp.

## Trách nhiệm

- Hiển 3–6 câu gần nhất, partial màu nhạt, final màu đậm, bản dịch bên dưới
- Hiển thị theo Assist level: `4` đầy đủ, `3` bản dịch nổi bật, `1` chỉ bản dịch, `0` ẩn caption
- Gạch chân từ khó theo Lexicon của người dùng
- Thanh công cụ: cỡ chữ 14–24 px lưu trong `localStorage`, nền sáng/tối và dải kéo cửa sổ

## Phạm vi MVP

- US-04, US-05, US-10

## Interface

- `<CaptionOverlay level={level} />`: hiện dữ liệu mẫu trước transcript đầu tiên; level prop dùng cho test, khi chạy thật nhận level từ event `settings`
- `useTranscript()`: đăng ký và dọn listener qua `native.onTranscript`
- `useOverlayAssistLevel()`: đăng ký và dọn listener qua `native.onSettings`
- `useTranscriptStore`: `push(event)` thay segment cùng `segmentId`, giữ tối đa 6 segment

## Phụ thuộc

- `@cuelingo/ui` (`CaptionLine`)
- Zustand
- Cầu nối `apps/desktop/src/lib/native.ts`

## Dữ liệu & sự kiện

- Nhận `transcript`: `{segmentId, text, translation, partial}` từ Tauri core
- Nhận `settings`: `{assistLevel}` từ cửa sổ chính

## Câu hỏi mở

- Từ khó xác định ở client (cache Lexicon) hay server trả kèm bản dịch?
