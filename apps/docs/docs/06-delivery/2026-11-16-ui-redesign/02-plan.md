# Plan — ui-redesign

## 1. Bối cảnh code

- **Nền đã có:** `@cuelingo/ui` dùng shadcn (Radix, `cva`) trên Tailwind 4, `@animate-ui/react` và `motion`. Token ở `packages/ui/src/styles/globals.css` (neutral gốc shadcn, OKLCH) và `brand.css` (ghi đè indigo). Web, desktop và site cùng import hai file này.
- **Lệch so với bản thiết kế:** thiếu `success`, `warning`, `translation`, `sidebar-*`; `primary`, `border`, `muted` khác giá trị; chưa có token bóng và thời lượng chuyển động; phông là phông hệ thống.
- **Điều hướng:** desktop chọn trang bằng `views` (`apps/desktop/src/app/views.ts`) theo `id` trong `packages/ui/src/lib/roadmap.ts`; web dùng route trong `apps/web/src/app/(app)`. Ôn tập, Cụm từ, Tiến độ hiện là ba feature riêng ở cả hai nơi.
- **Trang chủ desktop** (`App.tsx` `CurrentView`) ghép nhiều khối dài 234 dòng; `SessionPanel`, `AssistSettings`, `VoiceSettings`, `RecentSessions` nằm chung một trang.
- **Convention áp dụng:** [shared-ui](../../05-engineering/conventions/shared-ui.md), [web-feature](../../05-engineering/conventions/web-feature.md), [native-desktop](../../05-engineering/conventions/native-desktop.md) (chỉ phần React). Module mẫu: `apps/web/src/features/glossary/` (container + trình bày thuần + hook).
- **Máy kiểm sẵn có:** `shared-ui.test.ts` (không vẽ lại component chung), `globals.test.ts`, test từng trang.

## 2. Phương án

| #   | Phương án                                                                                                                                              | Ưu                                                                                     | Nhược                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A   | **Làm một lần, đổi hết**: sửa token và mọi màn trong một nhánh, một PR                                                                                 | Nhất quán ngay                                                                         | PR cực lớn (hàng trăm file), khó review, mọi lỗi dồn một chỗ, khó dừng giữa chừng       |
| B   | **Theo đợt dọc**: đợt 1 token và component nền (ship riêng), rồi từng nhóm màn (Họp, Học và Ứng dụng, Admin và công khai), mỗi đợt một nhánh và một PR | Mỗi PR review được, chạy thật được; token đổi sớm nên màn chưa làm vẫn đã hợp phối màu | Giữa các đợt app có màn mới lẫn màn cũ (cùng token nên không lệch màu, chỉ lệch bố cục) |
| C   | **Lớp tương thích**: thêm token mới cạnh token cũ, từng màn chuyển dần, cuối cùng xoá token cũ                                                         | Không đụng màn chưa làm                                                                | Hai bộ token cùng tồn tại lâu, dễ quên xoá, vi phạm "một nguồn" của shared-ui           |

**Chọn B.** Token đổi trong đợt 1 nên mọi màn chưa làm lại vẫn lập tức đúng phối màu, bo góc, chữ; các đợt sau chỉ đổi bố cục và trạng thái. Mỗi đợt là một nhánh cắt từ `main` sau khi đợt trước merge, có `03-review.md` riêng trong cùng hồ sơ. Không cần ADR: đây là refactor giao diện, không đổi stack hay luồng dữ liệu.

**Quyết định cho các câu hỏi mở của spec** (ghi vào Decision log; bạn đổi được ở cổng này):

| Câu hỏi                               | Quyết định                                                                                                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thứ tự đợt                            | 1 nền, 2 Họp, 3 Học và Ứng dụng, 4 Admin và công khai                                                                                                                                   |
| Gộp Ôn tập thành 3 tab                | **Có.** Bỏ feature `phrases` và `progress` khỏi `roadmap.ts`; một trang `ReviewPage` có ba tab. Web: `/phrases`, `/progress` chuyển hướng tới `/review?tab=…`                           |
| Onboarding Bài nghe, Phím tắt         | Làm theo màn hiện có, áp token và bố cục thẻ chung; vẽ lại sau nếu bạn muốn                                                                                                             |
| Admin Doanh thu, Hoạt động, Tổng quan | Đợt 4: áp `PageHeader`, `StatCard`, `AnalyticsFrame` mới theo token; không đổi luồng. Vẽ lại sau nếu bạn muốn                                                                           |
| Dark mode                             | Token có đủ hai chế độ từ đợt 1; chạy thật cả hai chế độ ở các màn chính; không vẽ bản dark riêng cho từng màn                                                                          |
| Mobile web                            | Dùng cơ chế `responsive` đã có của `SidebarNav`/`AppFrame`; kiểm 375 px ở mọi màn đã đổi (AC20)                                                                                         |
| Phông                                 | Tải kèm app bằng gói `@fontsource-variable/be-vietnam-pro` và `@fontsource-variable/jetbrains-mono` (OFL, subset latin và vietnamese). **Thêm 2 dependency: cần bạn đồng ý ở cổng này** |

| Tác động                            | Có?   | Chi tiết                                                                                                    |
| ----------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| DB migration                        | Không |                                                                                                             |
| Contract (`@cuelingo/shared`)       | Không | Không đổi DTO; chỉ đọc `ttsVoice`, hạn mức, v.v. như hiện tại                                               |
| Event / Learner Model               | Không | Giữ nguyên event; vẫn ghi `phrase_saved`, `lookup`                                                          |
| Prompt / model AI                   | Không |                                                                                                             |
| Quyền riêng tư / dữ liệu người dùng | Không | Phông tải kèm, không gọi Google Fonts; thẻ nhắc lịch đọc giờ và tên như hiện tại; không thêm dữ liệu gửi đi |

## 3. Các bước (mỗi bước ≈ 1 commit)

**Đợt 1: nền** (nhánh `feat/ui-redesign`)

| #   | Bước                                                                                                                                                                                                                        | File                                                                                         | Điểm mở rộng |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------ |
| 1   | Token: viết lại `globals.css` và `brand.css` theo `tokens.json` (sáng và tối), thêm `success`, `warning`, `translation`, `sidebar-*`, bóng, thời lượng, đường cong, khối `prefers-reduced-motion`; map vào `@theme inline`  | `packages/ui/src/styles/*`, `globals.test.ts`                                                | Shared UI    |
| 2   | Phông: thêm 2 gói fontsource, import trong `globals.css`, đặt `--font-sans`, `--font-mono`; bỏ phông hệ thống ở `apps/desktop/src/styles.css`                                                                               | `packages/ui/package.json`, `globals.css`, `apps/desktop/src/styles.css`, `apps/web/src/app` | Shared UI    |
| 3   | Component nền: căn `Button`, `Input`, `Card`, `Badge` (thêm), `Segmented`, `Tabs` (thêm), `Skeleton` (thêm), `Dialog`/`ConfirmDialog`, `StatCard`, `UsageMeter`, `Kbd`, `Logo` theo card thiết kế; bỏ hex và `dark:` tự đặt | `packages/ui/src/components/*`, `ui.test.tsx`, `shared-ui.test.ts` (thêm quét hex)           | Shared UI    |
| 4   | Thành phần mới dùng chung: `StatusRow` (✓, cảnh báo, lỗi kèm nút sửa), `NoticeStrip` (vàng, đỏ), `EmptyState`, `PageHeader` chuẩn, `FilterCard`                                                                             | `packages/ui/src/components/*`                                                               | Shared UI    |
| 5   | Docs: sửa `05-packages/ui.md`, `shared-ui.md`, thêm phần token; `pnpm docs:build`                                                                                                                                           | `apps/docs/docs/04-modules/05-packages/ui.md`, `05-engineering/conventions/shared-ui.md`     | (docs)       |

Sau bước 5: chạy thật web và desktop (cả hai chế độ), `03-review.md` đợt 1, **cổng RESULT**, commit, merge.

**Đợt 2: Họp** (nhánh `feat/ui-redesign-meeting`, sau khi đợt 1 merge)

| #   | Bước                                                                                                                                                                              | File                                                                                            | Điểm mở rộng   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------- |
| 6   | `SidebarNav`, `AppShell` theo thiết kế (logo, nhóm, chân trang tài khoản và phiên bản); desktop và web dùng chung                                                                 | `packages/ui/.../sidebar-nav.tsx`, `apps/desktop/src/app/AppShell.tsx`, `apps/web/.../AppShell` | Shared UI      |
| 7   | Trang Phiên họp: tách `HomePage` khỏi `App.tsx`; danh sách sẵn sàng, mức hỗ trợ 4 nấc, thanh hạn mức, thẻ lịch (AC6 đến AC8); chuyển `AssistSettings`, `VoiceSettings` về Cài đặt | `apps/desktop/src/app/`, `session/SessionPanel.tsx`, `settings/`, `calendar/`, `usage/`         | Desktop module |
| 8   | Đang họp: hai luồng có trạng thái riêng, lỗi một luồng không dừng luồng kia (AC9)                                                                                                 | `session/SessionPanel.tsx`, `session/use-session.ts`, `capture-problems.ts`                     | Desktop module |
| 9   | Overlay: áp token, `NoticeBar`, drawer Nói giúp, `SpeakableOption`, màn chữ lớn                                                                                                   | `apps/desktop/src/overlay/*`, `quick-assist/*`                                                  | Desktop module |
| 10  | Cuộc họp và Debrief (web và desktop): tìm trong bản ghi, lọc, tab bản ghi song ngữ (AC10)                                                                                         | `apps/web/src/features/library`, `debrief`; `apps/desktop/src/session/RecentSessions.tsx`       | Web feature    |
| 11  | Thuật ngữ: dòng thêm nhanh, dán hàng loạt                                                                                                                                         | `apps/web/src/features/glossary`, `apps/desktop/src/insights/GlossaryPage.tsx`                  | Web feature    |

**Đợt 3: Học và Ứng dụng** (nhánh `feat/ui-redesign-learn`)

| #   | Bước                                                                                                                         | File                                                                                                                          | Điểm mở rộng                |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 12  | Ôn tập 3 tab, chuyển hướng `/phrases` và `/progress`, sửa `roadmap.ts` và `views.ts` (AC11)                                  | `packages/ui/src/lib/roadmap.ts`, `apps/web/src/features/{review,phrase-bank,progress}`, `apps/desktop/src/study`, `insights` | Web feature, Desktop module |
| 13  | Trợ lý AI: danh sách hội thoại, khung chat, menu từ                                                                          | `apps/web/src/features/assistant`, `packages/ui/.../chat-message.tsx`                                                         | Web feature                 |
| 14  | Cài đặt: mục bên trái, "Đã lưu", các mục Họp và caption, Giọng đọc, Mô hình, Lịch, Quyền riêng tư (AC12), Thiết bị, Cập nhật | `apps/web/src/features/{preferences,account}`, `apps/desktop/src/settings`, `privacy`, `server-picker`, `updater`             | Web feature, Desktop module |
| 15  | Nâng cấp, Thanh toán (AC13), Góp ý                                                                                           | `apps/web/src/features/{billing,feedback}`, `apps/desktop/src/{usage,feedback}`                                               | Web feature                 |
| 16  | Onboarding đủ bước, tiếp lại được, bước bỏ qua thành thẻ ở trang chủ (AC14)                                                  | `apps/desktop/src/onboarding/*`                                                                                               | Desktop module              |

**Đợt 4: Admin và công khai** (nhánh `feat/ui-redesign-admin`)

| #   | Bước                                                                                     | File                                                                                          | Điểm mở rộng |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------ |
| 17  | Người dùng: ô thống kê làm bộ lọc, thanh đo lượng dùng, chi tiết và đổi gói (AC15, AC16) | `apps/web/src/features/admin/AdminUsersPage.tsx`, `AdminUserDetail.tsx`                       | Web feature  |
| 18  | Tổng quan, Doanh thu, Lượng dùng, Hoạt động, Mã mời, Trợ lý AI: áp component mới         | `apps/web/src/features/{admin,invites}`                                                       | Web feature  |
| 19  | Trang chủ, Tải về, Đăng nhập, Liên kết app (và `apps/site` nhận token)                   | `packages/ui/src/components/landing`, `apps/web/src/features/{landing,auth}`, `apps/site/src` | Shared UI    |
| 20  | Docs trang module, quét tương phản và `aria-label` (AC19), kiểm 375/768/1280 (AC20)      | `apps/docs/docs/04-modules/*`                                                                 | (docs)       |

Mỗi bước: `pnpm verify` xanh trước khi sang bước sau; sửa docs thì thêm `pnpm docs:build`. Chạy thật cuối mỗi đợt, rồi `03-review.md`, rồi cổng RESULT của đợt đó.

**Giao việc:** code TypeScript do `ts-engineer` hoặc luồng chính làm theo từng đợt; review độc lập bằng `code-reviewer` (hoặc Codex nếu bạn muốn review chéo). Không có việc cho `native-engineer`. Không viết `04-brief.md` trừ khi bạn muốn giao Codex một đợt.

## 4. Rủi ro

| Rủi ro                                                                          | Giảm thiểu                                                                                           |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Đổi token làm vỡ tương phản hoặc layout ở màn chưa làm lại                      | Đợt 1 chạy thật mọi màn chính ở cả hai chế độ; test tương phản cho cặp token; chưa merge khi còn lỗi |
| Test hiện có gắn chặt chữ hoặc cấu trúc cũ, vỡ hàng loạt khi đổi bố cục         | Sửa test cùng bước đổi; không xoá test mà không thay bằng test AC tương ứng                          |
| Gộp Ôn tập làm mất link cũ (`/phrases`, `/progress`, link trong email, debrief) | Chuyển hướng cố định; test route; tìm mọi link nội bộ trước khi xoá feature                          |
| Phông tải kèm tăng dung lượng app và web                                        | Chỉ subset latin và vietnamese, dạng biến thiên; đo kích thước trước và sau; báo ở `03-review.md`    |
| Desktop nhạy cảm với cửa sổ overlay (trong suốt, kéo, chọn chữ)                 | Mọi thay đổi overlay thử thật với một cuộc gọi Zoom/Meet; không đổi cơ chế cửa sổ                    |
| Bản vẽ dùng dữ liệu mẫu, dễ bị sao nguyên vào code                              | Giá và số liệu luôn lấy từ API; quét code không có chuỗi `[GIÁ]` hay email mẫu                       |
| Phạm vi quá lớn, kéo dài                                                        | Mỗi đợt ship được độc lập; dừng sau bất kỳ đợt nào mà không để lại trạng thái dở                     |
| `shared-ui.test.ts` chặn trùng tên component khi di chuyển giữa client          | Chuyển component vào `@cuelingo/ui` trong cùng bước; xoá bản ở client                                |
