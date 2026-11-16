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

| Import                                 | Export                                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@cuelingo/ui/globals.css`             | CSS Tailwind và design token sáng/tối                                                                          |
| `@cuelingo/ui/brand.css`               | Màu thương hiệu và thanh cuộn chung cho mọi client: mảnh, rãnh trong suốt, chỉ hiện khi rê chuột vào vùng cuộn |
| `@cuelingo/ui/lib/utils`               | `cn`                                                                                                           |
| `@cuelingo/ui/components/button`       | `Button`, `buttonVariants`                                                                                     |
| `@cuelingo/ui/components/input`        | `Input`                                                                                                        |
| `@cuelingo/ui/components/card`         | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`                |
| `@cuelingo/ui/components/caption-line` | `CaptionLine`, `CaptionLineProps`                                                                              |

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

| Import                               | Export                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `components/landing/landing-view`    | `LandingView({downloads?, link?, paths?, os?})`, `LandingSessionCheck`                                                                |
| `components/landing/download-page`   | `DownloadPage({downloads?, link?, paths?, os?})`                                                                                      |
| `components/landing/detect-os`       | `detectOs(userAgent, platformHint?, touchPoints?)`, `downloadView(os, downloads)`, `useDetectedOs()`, `DownloadLinks`, `NO_DOWNLOADS` |
| `components/landing/public-header`   | `PublicHeader({link?, paths?})`                                                                                                       |
| `components/landing/caption-overlay` | `CaptionOverlay({compact?})`                                                                                                          |
| `components/landing/landing-link`    | `LandingLink`, `LandingPaths`, `PlainLink`, `DEFAULT_LANDING_PATHS`                                                                   |

- `link` mặc định là thẻ `<a>`; web truyền `next/link`. `paths = {home, download, login}`; `login: null` ẩn mọi liên kết đăng nhập (site tĩnh).
- `downloads = {macos, windows}` (`DownloadLinks`, mỗi giá trị là link hoặc `null`). `macos: null` thì nút "Sắp có bản tải" bị khoá. **`windows: null` nghĩa là chưa mở công khai**: không có nút hay link Windows nào, và người dùng Windows thấy "Windows sắp có" thay vì nút Mac.
- Hệ điều hành đoán ở trình duyệt bằng `useDetectedOs()` (`useSyncExternalStore`): lần render đầu và trên máy chủ là `null`, nên HTML gửi đi khớp lúc hydrate. `downloadView(os, downloads)` chọn một trong bốn kiểu: `macos` (như cũ, cũng là kiểu của mọi người khi chưa có link Windows), `windows` (nút Windows trước, kèm link Mac), `both` (chưa biết hệ điều hành mà có link Windows: hai nút) và `windows-soon`. `detectOs` coi iPhone, iPad (kể cả iPad xin bản desktop, nhận ra bằng `maxTouchPoints`), Android, ChromeOS và Linux là `other`. Prop `os` ép hệ điều hành (xem trước, test).
- Trang tải nêu từng bản: macOS 14.2+ Apple Silicon, cách mở bản chưa công chứng, cấp quyền; Windows 10 22H2 / 11 x64, cách vượt SmartScreen ("Windows protected your PC" → More info → Run anyway), quyền micro; và việc app tự kiểm tra bản mới rồi hỏi trước khi cài. Landing và FAQ chỉ nhắc Windows khi `downloads.windows` có link.
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
- **`ServerDialog({open, current, defaultChoice, devMode, signedIn, validate, onCheck, onSave, onClose, saveError?})`**: hộp thoại chọn máy chủ cho desktop, thuần hiển thị (không gọi mạng, không biết `localStorage`; app truyền hàm). Danh sách "CueLingo Beta (mặc định)", "Tuỳ chỉnh…" (ô địa chỉ API và địa chỉ web, lỗi từ `validate`) và mục `localhost` chỉ khi `devMode`; "Kiểm tra kết nối" gọi `onCheck(api)`; kết quả gắn với địa chỉ đã kiểm và bị bỏ khi địa chỉ đổi; cảnh báo nêu tên miền đích; kiểm tra thất bại thì "Lưu" chỉ hỏi lại, phải bấm "Vẫn lưu". Xem [Máy chủ](../01-desktop/server.md).
- Roadmap có mục `assistant` ("Trợ lý AI", nhóm Học); trạng thái từng client ở `lib/roadmap.ts`.

### Khối giao diện HTML/JS (lớp 2, [ADR 0019](../../08-adr/0019-ai-generated-ui.md), sau cờ `AGENT_HTML_BLOCKS`)

`AgentCardView` nhận thêm `renderHtmlBlock?(data)` cho thẻ `html_block`; **không có hàm này thì thẻ không hiện** (chỉ một dòng "chưa được bật"), mã HTML không bao giờ nằm trong DOM của app. `ChatMessage` chuyển tiếp prop này.

- **`SandboxFrame({html, title?, runnerOrigin, onListPhrases, onSavePhrase, onSpeak})`**: một `<iframe>` trỏ tới `{runnerOrigin}/runner.html` với `sandbox="allow-scripts"` (đúng một cờ, **không** `allow-same-origin`, `allow-forms`, `allow-popups`, `allow-modals`, `allow-top-navigation*`, `allow-downloads`), `allow=""` (tắt camera, mic, vị trí, clipboard), `referrerPolicy="no-referrer"`, `loading="lazy"`. Hộp thoại của host (`ConfirmDialog` với `initialFocus="cancel"`, `confirmDelayMs=600`) hỏi trước khi `onSavePhrase` và trước khi `onListPhrases` (một lần mỗi khối); chữ AI viết được cắt và đặt trong ngoặc kép; từ chối 2 lần thì khối bị dừng (`refused`). Hằng số ở `lib/sandbox-attrs.ts` (không import gì, e2e dùng lại). `runnerOrigin` không phải http(s) thì không vẽ iframe. Khi iframe tải xong, host gửi `render {html}` rồi bật watchdog; `html` cố định suốt đời khối (HTML khác là khối khác, component remount theo `key`).
- **Watchdog** (`lib/sandbox-watchdog`): trang phải gửi `ui.ready` trong 3 giây sau khi runner tải; sau đó host ping 2 giây một lần và pong của lần trước phải về trước lần ping kế tiếp. Quá hạn, hoặc trang gửi `ui.error` (cũng là cách báo `securitypolicyviolation`), thì **gỡ iframe**, hiện "Khối giao diện đã bị dừng", lý do, và nút "Xem mã nguồn" (hiện mã dạng chữ trong `<pre>`, không bao giờ chạy). Khối đã dừng thì mọi tin đến sau bị bỏ.
- **Bridge** (`lib/bridge-host`), thứ tự kiểm cho mỗi tin: (1) `event.source === iframe.contentWindow`; (2) `event.origin` thuộc danh sách chấp nhận, mặc định **chỉ `"null"`**; (3) tối đa 300 tin/phút; (4) ≤ 16 KB tính theo byte, JSON hoá được; (5) `pong` hoặc request `{v:1,id,op,args}` hợp lệ theo Zod của `@cuelingo/shared`, `op` nằm trong allowlist sáu thao tác; (6) tần suất: 20 thao tác dữ liệu và 120 thao tác `ui.*` mỗi phút mỗi khối. Tin bị từ chối chỉ ghi `console.warn` lý do và tên thao tác nếu nằm trong allowlist, không ghi nội dung. Tin có `id` hợp lệ được trả lời `ok:false` với mã cố định (`op_not_allowed`, `invalid`, `too_large`, `rate_limited`, `declined`, `busy`, `failed`), không bao giờ là chữ của lỗi gốc.
- **`phrases.save` luôn qua `ConfirmDialog`** do `SandboxFrame` vẽ trong DOM của host ("Lưu cụm từ này?"), không có đường nào gọi `onSavePhrase` mà bỏ qua nó; mỗi lúc chỉ một câu hỏi (`busy`), khối bị gỡ giữa chừng thì huỷ câu hỏi và không lưu. `phrases.list` chỉ trả `{phrase, meaningVi}` (tối đa 50). `tts.speak`: host tự phát, không trả âm thanh vào trang.
- **Vì sao origin là `"null"`**: iframe không có `allow-same-origin` có origin mờ nên trình duyệt báo `event.origin === "null"` (không phải origin của runner), và `postMessage` vào nó phải dùng target `"*"`. Vì vậy ranh giới là **danh tính cửa sổ** (`source`), không phải chuỗi origin. Plan ghi `event.origin === RUNNER_ORIGIN`; cách đó sẽ từ chối mọi tin thật.
- Test: `bridge-host.test.ts` (giả mạo nguồn/origin, thao tác lạ, tin quá cỡ, không serialise được, tần suất, xác nhận lưu), `sandbox-watchdog.test.ts` (đồng hồ giả), `sandbox-controller.test.ts` (dây nối), `sandbox-frame.test.tsx` (thuộc tính iframe, gỡ khối, xem mã nguồn dạng chữ).

## UsageMeter

`UsageMeter({metric, used, limit, state, resetsAt?})` (`components/usage-meter`): một hạn mức của gói là nhãn tiếng Việt, thanh tiến độ (`role="progressbar"`) và phần còn lại. `state` là `ok | low | exhausted` do server tính; `low` màu hổ phách, `exhausted` màu `destructive`, chữ vẫn nói rõ nên không chỉ dựa vào màu. `limit = null` hiện "Không giới hạn" và không có thanh; `limit = 0` hiện "Không có trong gói này". `metric` là `string` vì `@cuelingo/ui` không phụ thuộc kiểu của `shared`.

`UsageSummary({plan, usage, planExpiresAt?, now?, action?})` (cùng file) là khối "Gói hiện tại: X" kèm một meter cho mỗi hạn mức, dùng chung cho Cài đặt của web và desktop. `action` là chỗ cho nút "Nâng gói" (client quyết định có hiện không, ẩn khi `GET /v1/billing` trả `enabled: false`); `planExpiresAt` lấy từ `GET /v1/billing`, còn ≤ 3 ngày thì hiện "Gói Pro hết hạn ngày dd/mm/yyyy" (`now` chỉ để test); `usage` là bản đồ metric → `{used, limit, resetsAt, state}` đúng như `GET /v1/me/usage`.

Hàm định dạng ở `lib/usage` để web và desktop dùng chung câu chữ: `usageLabel`, `planName`, `formatDurationMs` ("2 giờ 5 phút", làm tròn xuống), `formatUsageAmount`, `formatRemaining`, `usageFraction`, `formatResetDate` (ngày làm mới, giờ Việt Nam), `quotaExceededMessage` (lời nhắn khi `QUOTA_EXCEEDED`), `formatVnd` ("99.000 ₫"), `formatDateVn` (dd/mm/yyyy, giờ Việt Nam), `planExpiryNotice(plan, expiresAt, now)` (null nếu không hết hạn trong ≤ 3 ngày), `USAGE_METRIC_ORDER`. `*_ms` là mili giây, các metric còn lại là số lần.

## Thanh bên chia nhóm thu gọn được

Code: `components/sidebar-nav.tsx`, `hooks/use-collapsed-groups.ts`, `components/app-frame.tsx`. Spec: `06-delivery/2026-11-16-admin-console`.

| Import                       | Export                                                     |
| ---------------------------- | ---------------------------------------------------------- |
| `components/sidebar-nav`     | `SidebarNav`, `NavItem`, `NavGroup`, `SidebarNavProps`     |
| `hooks/use-collapsed-groups` | `useCollapsedGroups`, `COLLAPSED_GROUPS_KEY`               |
| `components/feature-icon`    | `FeatureIcon`, `NavIconName` (thêm icon cho nhóm Quản trị) |
| `components/app-frame`       | `AppFrame({nav, footer?, dragRegion?, wide?, children})`   |

- Mỗi nhóm có một nút tiêu đề (`<button>` thật nên Enter và Space chạy sẵn) với `aria-expanded` và `aria-controls` trỏ tới danh sách. Danh sách thu gọn dùng `hidden`, nên rời khỏi cây truy cập nhưng id vẫn còn. Desktop và web dùng chung nên cùng có thu gọn.
- **Lưu theo thiết bị:** khoá `cuelingo.sidebar.collapsed.v1`, giá trị là mảng JSON các id nhóm đang thu gọn. Đọc ghi bọc `try/catch` (storage bị chặn thì vẫn thu gọn được trong lần xem đó); giá trị hỏng hay id lạ thì bỏ qua; id của nhóm không hiện (ví dụ Quản trị với người thường) giữ nguyên trong storage. Mặc định mọi nhóm mở.
- Khi trang đang mở thuộc một nhóm đang thu gọn (mở app, bấm link, nút back) thì nhóm đó tự mở. Người dùng vẫn thu gọn lại được bằng tay.
- `extraGroups?: NavGroup[]` thêm nhóm sau các nhóm roadmap, thu gọn và lưu như chúng. Chỉ web truyền nhóm Quản trị (Q1); desktop không truyền nên không đổi. `renderItem` khai báo dạng method nên desktop vẫn gõ tham số là `Feature`.
- `AppFrame` `wide` đổi chiều rộng nội dung từ 640px sang `max-w-6xl` (bảng, biểu đồ).
- Test: `sidebar-nav.test.tsx` (collapse, persist, admin group).

## Biểu đồ và thẻ số liệu

Dùng cho các trang admin. Code: `components/chart-card.tsx`, `components/stat-card.tsx`. Phụ thuộc mới: `recharts@^3` (MIT, chạy trong trình duyệt, không nhận dữ liệu người dùng; đã duyệt ở Q2 của spec admin-console).

| Import                  | Export                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/chart-card` | `LineChartCard`, `BarChartCard`, `ChartCardProps` (`title`, `description?`, `data`, `xKey`, `xLabel?`, `series`, `formatX?`, `formatValue?`) |
| `components/stat-card`  | `StatCard({label, value, hint?})`, `StatGrid`, `NO_DATA_TEXT`                                                                                |

- Mỗi biểu đồ có một bảng `sr-only` chứa cùng dữ liệu (cho trình đọc màn hình và để test), phần SVG là `aria-hidden`. Màu lấy từ token `--chart-1`, `--chart-2` trong `globals.css`.
- `StatCard` `value={null}` hiện "Chưa đủ dữ liệu"; số 0 thật vẫn hiện 0.
- Chỉ trang admin import `chart-card`, nên Next tách Recharts vào chunk của route admin; desktop không import file này.
