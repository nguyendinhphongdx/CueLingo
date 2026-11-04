# @cuelingo/ui

> Phần: [Shared packages](./README.md) · Code: `packages/ui/src/`

Component React dùng chung cho desktop và web.

## Trách nhiệm

- Cung cấp primitive dùng chung: Button, Input, Card
- Hiển thị caption song ngữ bằng CaptionLine
- Cung cấp design token sáng/tối và CSS Tailwind toàn cục

## Phạm vi MVP

- Toàn bộ

## Interface

| Import                                 | Export                                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `@cuelingo/ui/globals.css`             | CSS Tailwind và design token sáng/tối                                                           |
| `@cuelingo/ui/lib/utils`               | `cn`                                                                                            |
| `@cuelingo/ui/components/button`       | `Button`, `buttonVariants`                                                                      |
| `@cuelingo/ui/components/input`        | `Input`                                                                                         |
| `@cuelingo/ui/components/card`         | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` |
| `@cuelingo/ui/components/caption-line` | `CaptionLine`, `CaptionLineProps`                                                               |

`CaptionLine` nhận `text`, `translation?`, `hardWords?`, `partial?` và `className?`; component không gọi API.

## Phụ thuộc

- React 19 (peer dependency)
- Tailwind CSS 4
- `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`

## Dữ liệu & sự kiện

- (chưa có)

## FollowupComposer

Thành phần soạn tin follow-up dùng chung cho web và desktop: chọn kênh và giọng (giọng mặc định theo kênh cho tới khi người dùng chọn), nút "Soạn", ô tiêu đề (chỉ email) và nội dung sửa được, "Sao chép" có xác nhận, lỗi giữ nguyên phần đã sửa. `FollowupComposerView` là phần hiển thị thuần để kiểm thử. Có kiểu riêng cho kênh, giọng và bản nháp (tương thích cấu trúc với `@cuelingo/shared`) vì `@cuelingo/ui` không phụ thuộc `shared`.

## LanguageSwitcher

Dropdown dựa trên `<select>` gốc (bàn phím và di động có sẵn): nhãn ẩn "Ngôn ngữ" gắn với ô chọn, hiện ngôn ngữ đang chọn, không hiện gì khi có ít hơn hai tuỳ chọn. Dùng chung ở phiên họp (desktop) và các trang học (web, desktop).

## SpeakerTag

Nhãn người nói dùng chung cho overlay và web: `SpeakerTag({label, displayName, source, onRename?})` (`components/speaker-tag`). `speakerDisplayName({label, displayName, source})` (`lib/speaker`) trả “Tôi” (`me`, hoặc không nhãn và `source = mic`), tên người dùng đặt, “Speaker N” (`speaker_N` chưa có tên), hoặc “Người khác”. Màu nhẹ cố định theo N (token `primary`/`accent`/`secondary`/`muted`; “Tôi” và “Người khác” có màu riêng); tên luôn hiện bằng chữ nên không chỉ dựa vào màu. Có `onRename` thì nhãn là nút (`aria-label` “<tên>, đổi tên người nói”), không thì là `span`. `label` là `string` vì `@cuelingo/ui` không phụ thuộc `shared`.

## Câu hỏi mở

- Bảng màu thương hiệu cuối cùng sẽ thay neutral token ở giai đoạn nào?
- (chưa có)
