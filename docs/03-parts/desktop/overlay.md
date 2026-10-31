# Caption overlay

> Phần: [Desktop app](README.md) · Code: `apps/desktop/src/overlay/`

Cửa sổ caption song ngữ nổi trên app họp.

## Trách nhiệm

- Hiển 3–6 câu gần nhất, partial màu nhạt, final màu đậm, bản dịch bên dưới
- Hiển thị theo Assist level 4 / 3 / 1
- Gạch chân từ khó theo Lexicon của người dùng
- Thanh công cụ: Recap, Nói giúp, Assist, Ghim; cỡ chữ 14–24 px, sáng/tối

## Phạm vi MVP

- US-04, US-05, US-10

## Interface

- Component `<CaptionOverlay />` đọc `useSession()`

## Phụ thuộc

- `@cuelingo/ui` (CaptionLine)

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- Từ khó xác định ở client (cache Lexicon) hay server trả kèm bản dịch?
