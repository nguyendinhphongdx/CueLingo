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

`FeedbackForm` (`@cuelingo/ui/components/feedback-form`): chọn Báo lỗi/Góp ý, đếm ký tự trên 2000, dòng "Không gửi kèm transcript hay âm thanh". Nhận `send({kind, message})` từ client; component không biết phiên bản app hay OS và không có chỗ đính gì khác. `FeedbackFormView` là bản thuần markup để test.

`CaptionLine` nhận `text`, `translation?`, `hardWords?`, `partial?` và `className?`; component không gọi API.

## Phụ thuộc

- React 19 (peer dependency)
- Tailwind CSS 4
- `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`
- `react-markdown`, `remark-gfm` (MIT; không bật `rehype-raw`) cho `MarkdownView`

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

## FlashcardDeck

`FlashcardDeck({card, position, total, submitting, onRate, loadAudio?})` (`components/flashcard-deck`): thẻ ôn lật 3D và vuốt. `card` là kiểu cấu trúc `ReviewCardLike` (không phụ thuộc `shared`). Logic thuần nằm ở `lib/swipe` (`swipeRating`, `isTap`, `ratingForKey`, `exitOffset`) và có test riêng; `FlashcardFace` là phần markup để test. Ngưỡng vuốt 90px, dưới 10px tính là chạm.

## Trợ lý AI (chat)

Các thành phần chỉ trình bày và nhận callback; không gọi API, không import `@cuelingo/shared` (kiểu `AgentCardLike`, `ChatMessagePart` ở `lib/agent-card.ts`, `components/chat-message.tsx` khớp cấu trúc với contract). Web dùng ở `apps/web/src/features/assistant`; desktop chưa gắn.

| Import                            | Export                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `components/markdown-view`        | `MarkdownView`, `safeUrl`                                                             |
| `components/agent-card-view`      | `AgentCardView({card, loadAudio?})`                                                   |
| `components/word-actions-menu`    | `WordActionsMenu`, `WordLookup`                                                       |
| `components/chat-message`         | `ChatMessage`, `ChatMessagePart`, `isAwaitingText`                                    |
| `components/tool-step`            | `ToolStep`, `toolStepLabel`                                                           |
| `components/thinking-indicator`   | `ThinkingIndicator`                                                                   |
| `lib/agent-card`, `lib/menu-keys` | `AgentCardLike`, `isClozeCorrect`, `splitCloze`; `menuKeyAction`, `clampMenuPosition` |

- **`MarkdownView`** (AC6): bỏ HTML thô (`skipHtml`, không `rehype-raw`), **không bao giờ tải ảnh** (kênh rò dữ liệu qua URL; chỉ hiện chữ `[alt]`), chỉ liên kết `http`, `https`, `mailto` (kiểm bằng `new URL`, nên `javascript:`, `data:`, `java\nscript:`, đường dẫn tương đối đều thành chữ thường), mở tab mới với `rel="noopener noreferrer"`. Có bảng, danh sách, mã nhờ GFM. Test XSS ở `markdown-view.test.tsx`.
- **`AgentCardView`**: `flashcards` dùng lại `FlashcardDeck` (lật, chấm, xem lại), `cloze` (gõ, Enter hoặc "Kiểm tra", bỏ qua hoa thường và dấu chấm cuối), `quiz_choice` (chọn rồi hiện đáp án và giải thích), `compare_table`, `phrase_list` (nút nghe nếu có `loadAudio`). Mọi chữ là text thường, không HTML. Hạn chế đã biết: `FlashcardDeck` nghe phím trên `window`, nên nhiều bộ thẻ trên cùng một trang cùng phản ứng với phím.
- **`WordActionsMenu`**: `role="menu"` với ba mục "Tra nghĩa", "Nghe", "Lưu" (đổi thành "Đã lưu" và `aria-disabled` khi cụm từ đã trong Phrase Bank). Focus vào mục đầu khi mở, mũi tên/Home/End di chuyển, Esc hoặc bấm ra ngoài đóng, tự dịch vào trong khung nhìn. Kết quả tra nghĩa hiện ngay trong menu qua `lookup`.
- **`ChatMessage`**: tin người dùng là chữ thường (không Markdown); tin trợ lý gồm `MarkdownView`, `ToolStep`, `AgentCardView`, dấu "đang suy nghĩ" khi đang stream mà chưa có chữ, và dòng ghi chú khi kết thúc `stopped`/`error`/`limited`. `onDoubleClick` gắn vào khối trợ lý để trang bật `WordActionsMenu`.
- **`ToolStep`**: nhãn tiếng Việt theo công cụ và trạng thái (`lookup_word`, `list_saved_phrases`, `save_phrase`, `show_card`); công cụ lạ (plugin) chỉ hiện nhãn chung, không lộ tên.
- **`ThinkingIndicator`**: chấm nhảy chỉ khi người dùng không tắt chuyển động (`motion-safe:`); `role="status"`.
- Roadmap có mục `assistant` ("Trợ lý AI", nhóm Học); trạng thái từng client ở `lib/roadmap.ts`.
