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
- `@cuelingo/shared`: **ngoại lệ có chủ ý, chỉ cho `lib/bridge-host`, `lib/sandbox-controller` và `SandboxFrame`**. Giao thức bridge là một contract nên schema Zod của nó (`agent-bridge.ts`) chỉ viết một lần và dùng cả hai phía; các thành phần còn lại vẫn dùng kiểu khớp cấu trúc.

## Dữ liệu & sự kiện

- (chưa có)

## FollowupComposer

Thành phần soạn tin follow-up dùng chung cho web và desktop: chọn kênh và giọng (giọng mặc định theo kênh cho tới khi người dùng chọn), nút "Soạn", ô tiêu đề (chỉ email) và nội dung sửa được, "Sao chép" có xác nhận, lỗi giữ nguyên phần đã sửa. `FollowupComposerView` là phần hiển thị thuần để kiểm thử. Có kiểu riêng cho kênh, giọng và bản nháp (tương thích cấu trúc với `@cuelingo/shared`) vì `@cuelingo/ui` không phụ thuộc `shared`.

## LanguageSwitcher

Dropdown dựa trên `<select>` gốc (bàn phím và di động có sẵn): nhãn ẩn "Ngôn ngữ" gắn với ô chọn, hiện ngôn ngữ đang chọn, không hiện gì khi có ít hơn hai tuỳ chọn. Dùng chung ở phiên họp (desktop) và các trang học (web, desktop).

## SpeakerTag

Nhãn người nói dùng chung cho overlay và web: `SpeakerTag({label, displayName, source, onRename?})` (`components/speaker-tag`). `speakerDisplayName({label, displayName, source})` (`lib/speaker`) trả “Tôi” (`me`, hoặc không nhãn và `source = mic`), tên người dùng đặt, “Speaker N” (`speaker_N` chưa có tên), hoặc “Người khác”. Màu nhẹ cố định theo N (token `primary`/`accent`/`secondary`/`muted`; “Tôi” và “Người khác” có màu riêng); tên luôn hiện bằng chữ nên không chỉ dựa vào màu. Có `onRename` thì nhãn là nút (`aria-label` “<tên>, đổi tên người nói”), không thì là `span`. `label` là `string` vì `@cuelingo/ui` không phụ thuộc `shared`.

## Trang giới thiệu và tải về

Dùng chung cho web (`apps/web/src/features/landing`) và site tĩnh ([Site công khai](../07-site/README.md)). Thành phần chỉ trình bày: router link, đường dẫn và việc chuyển hướng người đã đăng nhập do app chủ quyết định qua props.

| Import                               | Export                                                              |
| ------------------------------------ | ------------------------------------------------------------------- |
| `components/landing/landing-view`    | `LandingView({link?, paths?})`, `LandingSessionCheck`               |
| `components/landing/download-page`   | `DownloadPage({downloadUrl, link?, paths?})`                        |
| `components/landing/public-header`   | `PublicHeader({link?, paths?})`                                     |
| `components/landing/caption-overlay` | `CaptionOverlay({compact?})`                                        |
| `components/landing/landing-link`    | `LandingLink`, `LandingPaths`, `PlainLink`, `DEFAULT_LANDING_PATHS` |

- `link` mặc định là thẻ `<a>`; web truyền `next/link`. `paths = {home, download, login}`; `login: null` ẩn mọi liên kết đăng nhập (site tĩnh).
- `downloadUrl` null thì nút "Sắp có bản tải" bị khoá. Trang tải nêu macOS 14.2+, Apple Silicon, cách mở bản chưa công chứng, cấp quyền, và việc app tự kiểm tra bản mới rồi hỏi trước khi cài.
- CSS nằm ở `landing/landing.module.css` (CSS module). Cần `src/css-modules.d.ts` để kiểm kiểu.

## Câu hỏi mở

- Bảng màu thương hiệu cuối cùng sẽ thay neutral token ở giai đoạn nào?
- (chưa có)

## FlashcardDeck

`FlashcardDeck({card, position, total, submitting, onRate, loadAudio?})` (`components/flashcard-deck`): thẻ ôn lật 3D và vuốt. `card` là kiểu cấu trúc `ReviewCardLike` (không phụ thuộc `shared`). Logic thuần nằm ở `lib/swipe` (`swipeRating`, `isTap`, `ratingForKey`, `exitOffset`) và có test riêng; `FlashcardFace` là phần markup để test. Ngưỡng vuốt 90px, dưới 10px tính là chạm.

## Trợ lý AI (chat)

Các thành phần chỉ trình bày và nhận callback; không gọi API, không import `@cuelingo/shared` trừ nhóm sandbox bên dưới (kiểu `AgentCardLike`, `ChatMessagePart` ở `lib/agent-card.ts`, `components/chat-message.tsx` khớp cấu trúc với contract). Web dùng ở `apps/web/src/features/assistant`; desktop chưa gắn.

| Import                             | Export                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `components/markdown-view`         | `MarkdownView`, `safeUrl`                                                                      |
| `components/agent-card-view`       | `AgentCardView({card, loadAudio?})`                                                            |
| `components/word-actions-menu`     | `WordActionsMenu`, `WordLookup`                                                                |
| `components/chat-message`          | `ChatMessage`, `ChatMessagePart`, `isAwaitingText`                                             |
| `components/tool-step`             | `ToolStep`, `toolStepLabel`                                                                    |
| `components/thinking-indicator`    | `ThinkingIndicator`                                                                            |
| `components/sandbox-frame`         | `SandboxFrame`, `SandboxFrameView` (lớp 2, sau cờ)                                             |
| `lib/bridge-host`, `lib/sandbox-*` | `createBridgeHost`, `createSandboxController`, `createWatchdog`, `sandboxReducer`, `runnerUrl` |
| `lib/agent-card`, `lib/menu-keys`  | `AgentCardLike`, `isClozeCorrect`, `splitCloze`; `menuKeyAction`, `clampMenuPosition`          |

- **`MarkdownView`** (AC6): bỏ HTML thô (`skipHtml`, không `rehype-raw`), **không bao giờ tải ảnh** (kênh rò dữ liệu qua URL; chỉ hiện chữ `[alt]`), chỉ liên kết `http`, `https`, `mailto` (kiểm bằng `new URL`, nên `javascript:`, `data:`, `java\nscript:`, đường dẫn tương đối đều thành chữ thường), mở tab mới với `rel="noopener noreferrer"`. Có bảng, danh sách, mã nhờ GFM. Test XSS ở `markdown-view.test.tsx`.
- **`AgentCardView`**: `flashcards` dùng lại `FlashcardDeck` (lật, chấm, xem lại), `cloze` (gõ, Enter hoặc "Kiểm tra", bỏ qua hoa thường và dấu chấm cuối), `quiz_choice` (chọn rồi hiện đáp án và giải thích), `compare_table`, `phrase_list` (nút nghe nếu có `loadAudio`). Mọi chữ là text thường, không HTML. Hạn chế đã biết: `FlashcardDeck` nghe phím trên `window`, nên nhiều bộ thẻ trên cùng một trang cùng phản ứng với phím.
- **`WordActionsMenu`**: `role="menu"` với ba mục "Tra nghĩa", "Nghe", "Lưu" (đổi thành "Đã lưu" và `aria-disabled` khi cụm từ đã trong Phrase Bank). Focus vào mục đầu khi mở, mũi tên/Home/End di chuyển, Esc hoặc bấm ra ngoài đóng, tự dịch vào trong khung nhìn. Kết quả tra nghĩa hiện ngay trong menu qua `lookup`.
- **`ChatMessage`**: tin người dùng là chữ thường (không Markdown); tin trợ lý gồm `MarkdownView`, `ToolStep`, `AgentCardView`, dấu "đang suy nghĩ" khi đang stream mà chưa có chữ, và dòng ghi chú khi kết thúc `stopped`/`error`/`limited`. `onDoubleClick` gắn vào khối trợ lý để trang bật `WordActionsMenu`.
- **`ToolStep`**: nhãn tiếng Việt theo công cụ và trạng thái (`lookup_word`, `list_saved_phrases`, `save_phrase`, `show_card`); công cụ lạ (plugin) chỉ hiện nhãn chung, không lộ tên.
- **`ThinkingIndicator`**: chấm nhảy chỉ khi người dùng không tắt chuyển động (`motion-safe:`); `role="status"`.
- Roadmap có mục `assistant` ("Trợ lý AI", nhóm Học); trạng thái từng client ở `lib/roadmap.ts`.

### Khối giao diện HTML/JS (lớp 2, [ADR 0019](../../08-adr/0019-ai-generated-ui.md), sau cờ `AGENT_HTML_BLOCKS`)

`AgentCardView` nhận thêm `renderHtmlBlock?(data)` cho thẻ `html_block`; **không có hàm này thì thẻ không hiện** (chỉ một dòng "chưa được bật"), mã HTML không bao giờ nằm trong DOM của app. `ChatMessage` chuyển tiếp prop này.

- **`SandboxFrame({html, title?, runnerOrigin, onListPhrases, onSavePhrase, onSpeak})`**: một `<iframe>` trỏ tới `{runnerOrigin}/runner.html` với `sandbox="allow-scripts"` (đúng một cờ, **không** `allow-same-origin`, `allow-forms`, `allow-popups`, `allow-modals`, `allow-top-navigation*`, `allow-downloads`), `allow=""` (tắt camera, mic, vị trí, clipboard), `referrerPolicy="no-referrer"`, `loading="lazy"`. Hằng số ở `lib/sandbox-attrs.ts` (không import gì, e2e dùng lại). `runnerOrigin` không phải http(s) thì không vẽ iframe. Khi iframe tải xong, host gửi `render {html}` rồi bật watchdog; `html` cố định suốt đời khối (HTML khác là khối khác, component remount theo `key`).
- **Watchdog** (`lib/sandbox-watchdog`): trang phải gửi `ui.ready` trong 3 giây sau khi runner tải; sau đó host ping 2 giây một lần và pong của lần trước phải về trước lần ping kế tiếp. Quá hạn, hoặc trang gửi `ui.error` (cũng là cách báo `securitypolicyviolation`), thì **gỡ iframe**, hiện "Khối giao diện đã bị dừng", lý do, và nút "Xem mã nguồn" (hiện mã dạng chữ trong `<pre>`, không bao giờ chạy). Khối đã dừng thì mọi tin đến sau bị bỏ.
- **Bridge** (`lib/bridge-host`), thứ tự kiểm cho mỗi tin: (1) `event.source === iframe.contentWindow`; (2) `event.origin` thuộc danh sách chấp nhận, mặc định **chỉ `"null"`**; (3) tối đa 300 tin/phút; (4) ≤ 16 KB tính theo byte, JSON hoá được; (5) `pong` hoặc request `{v:1,id,op,args}` hợp lệ theo Zod của `@cuelingo/shared`, `op` nằm trong allowlist sáu thao tác; (6) tần suất: 20 thao tác dữ liệu và 120 thao tác `ui.*` mỗi phút mỗi khối. Tin bị từ chối chỉ ghi `console.warn` lý do và tên thao tác nếu nằm trong allowlist, không ghi nội dung. Tin có `id` hợp lệ được trả lời `ok:false` với mã cố định (`op_not_allowed`, `invalid`, `too_large`, `rate_limited`, `declined`, `busy`, `failed`), không bao giờ là chữ của lỗi gốc.
- **`phrases.save` luôn qua `ConfirmDialog`** do `SandboxFrame` vẽ trong DOM của host ("Lưu cụm từ này?"), không có đường nào gọi `onSavePhrase` mà bỏ qua nó; mỗi lúc chỉ một câu hỏi (`busy`), khối bị gỡ giữa chừng thì huỷ câu hỏi và không lưu. `phrases.list` chỉ trả `{phrase, meaningVi}` (tối đa 50). `tts.speak`: host tự phát, không trả âm thanh vào trang.
- **Vì sao origin là `"null"`**: iframe không có `allow-same-origin` có origin mờ nên trình duyệt báo `event.origin === "null"` (không phải origin của runner), và `postMessage` vào nó phải dùng target `"*"`. Vì vậy ranh giới là **danh tính cửa sổ** (`source`), không phải chuỗi origin. Plan ghi `event.origin === RUNNER_ORIGIN`; cách đó sẽ từ chối mọi tin thật.
- Test: `bridge-host.test.ts` (giả mạo nguồn/origin, thao tác lạ, tin quá cỡ, không serialise được, tần suất, xác nhận lưu), `sandbox-watchdog.test.ts` (đồng hồ giả), `sandbox-controller.test.ts` (dây nối), `sandbox-frame.test.tsx` (thuộc tính iframe, gỡ khối, xem mã nguồn dạng chữ).
