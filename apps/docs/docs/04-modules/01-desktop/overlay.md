# Caption overlay

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src/overlay/`

Cửa sổ caption song ngữ nổi trên app họp.

## Trách nhiệm

- Hiển 3–6 câu gần nhất, partial màu nhạt, final màu đậm, bản dịch bên dưới
- Hiển thị theo Assist level 4 / 3 / 1
- Gạch chân từ khó theo Lexicon của người dùng
- Thanh công cụ: Recap, Nói giúp, Assist, Ghim; cỡ chữ 14–24 px, sáng/tối

## Phạm vi MVP

- US-04, US-05, US-10

## Interface

- `<CaptionOverlay level={level} />`: hiện dữ liệu mẫu trước sự kiện transcript đầu tiên; level `0` ẩn nội dung, `1` chỉ hiện bản dịch, `3–4` hiện song ngữ
- `useTranscript()`: đăng ký và dọn listener qua `native.onTranscript`
- `useTranscriptStore`: `push(event)` thay segment cùng `segmentId`, giữ tối đa 6 segment

## Phụ thuộc

- `@cuelingo/ui` (`CaptionLine`)
- Zustand
- Cầu nối `apps/desktop/src/lib/native.ts`

## Dữ liệu & sự kiện

- Nhận `transcript`: `{segmentId, text, translation, partial}` từ Tauri core

## Câu hỏi mở

- Từ khó xác định ở client (cache Lexicon) hay server trả kèm bản dịch?
- Đồng bộ Assist level giữa cửa sổ `main` và `overlay` bằng event hay đọc từ Tauri state?
