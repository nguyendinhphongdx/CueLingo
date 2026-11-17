# ui-redesign — Thiết kế lại giao diện desktop và web

| Trạng thái | Loại               | Nhánh / PR                | Ước lượng → thực tế |
| ---------- | ------------------ | ------------------------- | ------------------- |
| Plan       | feature (refactor) | `feat/ui-redesign` / _PR_ | XL → ?              |

**Phạm vi:**

- **Trong:** giao diện của `apps/desktop` (cửa sổ chính, overlay, onboarding) và `apps/web` (khu `(app)`, `(auth)`, `(public)`, admin) theo bản thiết kế đã duyệt; token màu, chữ, bo góc, chuyển động trong `@cuelingo/ui`; sửa logic hiển thị đi kèm khi cần cho gọn (hook, trạng thái, tách container và trình bày).
- **Ngoài:** API, DB, contract `@cuelingo/shared`, prompt và AI; native Swift/Rust; Windows capture (đợt B); `apps/site` ngoài việc nhận token mới; thiết kế mobile và `apps/extension`.

**Nguồn thiết kế (đã duyệt 2026-11-16):**

- Design system: https://claude.ai/artifact/VWmGNA1F8rg1MZLBYVBfoW (token, 13 component, logo, `ux.md`, `screens.md`).
- 37 màn: https://claude.ai/artifact/CYRGzN9Mj1vpeBivy3Rivj.
- Số liệu, giá, tên người trên bản vẽ là dữ liệu mẫu (`[GIÁ]`, `[SỐ]`), không đưa vào code.

## 1. Vấn đề

Giao diện hiện tại được dựng theo từng tính năng, mỗi màn một kiểu, chưa có một hệ thiết kế thống nhất và chưa có thiết kế UX cho trạng thái: hết hạn mức, thiếu quyền, đang tải model, lỗi có nút sửa, rỗng.

Người dùng thấy:

- Trang chủ app là một danh sách việc, không nói việc tiếp theo là gì (sửa quyền, bắt đầu họp, hay cuộc họp sắp tới trong lịch).
- Lỗi và giới hạn hiện rời rạc, nhiều chỗ không kèm hành động sửa.
- Ôn tập, Kho cụm từ và Tiến độ là ba mục riêng trong thanh bên dù cùng một việc học.
- Admin chỉ có số tổng và bảng, không có luồng "tìm người, xem lượng dùng, đổi gói an toàn".

Người làm code thấy: màu và bo góc lệch giữa web, desktop và overlay; token trong `globals.css` và `brand.css` khác bản thiết kế (ví dụ `--success`, `--warning`, `--translation`, `--sidebar-*` chưa có; `primary` còn là OKLCH khác `#4f46e5`).

- **Spec liên quan:** [Phạm vi MVP](../../02-product/03-mvp-scope.md), [shared-ui](../../05-engineering/conventions/shared-ui.md), [web-feature](../../05-engineering/conventions/web-feature.md).
- **Module chạm tới:** `04-modules/01-desktop/*` (overlay, onboarding, quick-assist, settings), `04-modules/02-web/*` (mọi trang), `04-modules/05-packages/ui.md`.

## 2. Tiêu chí chấp nhận (EARS)

Chia làm các đợt có thể ship riêng; mỗi AC thuộc một đợt.

**Đợt 1: nền (token và component)**

| #   | AC                                                                                                                                                                                                                                           | Test                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| AC1 | THE SYSTEM SHALL định nghĩa mọi token của bản thiết kế (`background` … `sidebar-accent`, `success`, `warning`, `translation`, `brand`, cỡ chữ, bo góc, bóng, thời lượng và đường cong chuyển động) một lần trong `@cuelingo/ui`, sáng và tối | `globals.test.ts` › so khớp danh sách token với bản thiết kế |
| AC2 | WHILE bất kỳ client nào (web, desktop, overlay, site) tải CSS chung THE SYSTEM SHALL cho cùng giá trị token                                                                                                                                  | `shared-ui.test.ts` › không client nào khai lại token        |
| AC3 | THE SYSTEM SHALL không còn màu hex hoặc `dark:` tự đặt trong component dùng chung, trừ logo                                                                                                                                                  | `shared-ui.test.ts` › quét `packages/ui/src/components`      |
| AC4 | WHEN bật giảm chuyển động của hệ điều hành THE SYSTEM SHALL tắt mọi animation và transition của component dùng chung                                                                                                                         | `globals.test.ts` › có khối `prefers-reduced-motion`         |
| AC5 | THE SYSTEM SHALL có component `Logo` dùng đúng logo thật ở mọi nơi hiện thương hiệu (thanh bên, auth, onboarding, trang chủ)                                                                                                                 | `ui.test.tsx` › Logo; quét không còn SVG logo chép tay       |

**Đợt 2: nhóm Họp**

| #    | AC                                                                                                                                                                                                | Test                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| AC6  | WHEN mở Phiên họp THE SYSTEM SHALL hiện danh sách sẵn sàng (micro, âm thanh hệ thống, model) với trạng thái từng mục; mục thiếu có nút sửa riêng và Bắt đầu họp vẫn dùng được khi chỉ thiếu micro | `HomePage.test.tsx` (desktop)         |
| AC7  | IF một cuộc họp trong lịch bắt đầu trong 15 phút tới THEN THE SYSTEM SHALL hiện thẻ nhắc có nút Bắt đầu cho cuộc họp đó và nút Bỏ qua                                                             | `CalendarHintCard.test.tsx`           |
| AC8  | WHEN hạn mức giờ dịch hoặc debrief từ 80% trở lên THE SYSTEM SHALL hiện thanh vàng với số còn lại; ở 100% THE SYSTEM SHALL nói cái gì vẫn chạy và hiện nút Nâng cấp                               | `usage` › test hiển thị theo ngưỡng   |
| AC9  | WHILE đang họp THE SYSTEM SHALL hiện trạng thái riêng của micro và âm thanh hệ thống, và khi một luồng lỗi luồng kia vẫn chạy                                                                     | `capture-problems.test.tsx` (desktop) |
| AC10 | WHEN tìm trong Cuộc họp THE SYSTEM SHALL hiện đoạn khớp có đánh dấu và có bộ lọc người nói, tháng                                                                                                 | `LibraryPage.test.tsx`                |

**Đợt 3: nhóm Học và Ứng dụng**

| #    | AC                                                                                                                                                                         | Test                              |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| AC11 | THE SYSTEM SHALL gộp Hôm nay, Kho cụm từ và Tiến độ thành một mục Ôn tập có ba tab; địa chỉ cũ `/phrases` và `/progress` chuyển hướng tới tab tương ứng                    | `ReviewTabs.test.tsx`; route test |
| AC12 | WHEN xoá toàn bộ dữ liệu THE SYSTEM SHALL yêu cầu gõ `XOA DU LIEU` ở bước 2 và nút xoá chỉ bật khi khớp, focus đầu vào nút Huỷ                                             | `AccountPage.test.tsx`            |
| AC13 | WHEN thanh toán đang chờ THE SYSTEM SHALL hiện QR, số tiền, đếm ngược và tự cập nhật khi đơn đổi trạng thái (đã trả, hết hạn có nút tạo mã mới)                            | `Checkout.test.tsx`               |
| AC14 | THE SYSTEM SHALL hiện onboarding đủ bước (đăng nhập, quyền, model, hồ sơ, bài nghe, phím tắt), mỗi bước thoát và tiếp lại được; bước bỏ qua quay lại thành thẻ ở trang chủ | `Onboarding.test.tsx`             |

**Đợt 4: Admin, công khai, auth**

| #    | AC                                                                                                                                          | Test                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| AC15 | WHEN bấm một ô thống kê trên Người dùng THE SYSTEM SHALL lọc danh sách theo nhóm đó và đánh dấu ô đang chọn                                 | `AdminUsersPage.test.tsx`  |
| AC16 | WHEN đổi gói THE SYSTEM SHALL xác nhận có tên gói cũ và mới, ngày hết hạn dự kiến, đơn 0đ, và cảnh báo khi hạ gói đã trả tiền (đã có logic) | `AdminUserDetail.test.tsx` |
| AC17 | THE SYSTEM SHALL dùng chung component với desktop cho mọi thứ xuất hiện ở hơn một client                                                    | `shared-ui.test.ts`        |

**Toàn bộ các đợt**

| #    | AC                                                                                                                                    | Test                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| AC18 | THE SYSTEM SHALL giữ nguyên hành vi và API của mọi tính năng hiện có; mọi test hiện có vẫn xanh hoặc được sửa cùng thay đổi tương ứng | `pnpm verify`                      |
| AC19 | THE SYSTEM SHALL đạt tương phản chữ 4.5:1 và viền điều khiển 3:1 ở cả sáng và tối, có focus ring 2px, nút icon có `aria-label`        | kiểm tương phản; quét `aria-label` |
| AC20 | WHEN mở từng màn đã đổi ở 375, 768 và 1280 px THE SYSTEM SHALL không cuộn ngang trang                                                 | chạy thật trong trình duyệt/app    |
| AC21 | WHEN sửa component dùng chung THE SYSTEM SHALL sửa trang module tương ứng trong `04-modules` trong cùng commit                        | `pnpm docs:build`                  |

## 3. Câu hỏi mở

- [ ] **Đợt nào làm trước?** Đề xuất: 1 nền, 2 Họp (màn dùng nhiều nhất), 3 Học và Ứng dụng, 4 Admin và công khai; mỗi đợt một PR.
- [ ] **Gộp Ôn tập thành 3 tab** đổi cấu trúc điều hướng và địa chỉ (AC11). Đồng ý đổi, hay giữ ba mục riêng?
- [ ] **Bước Bài nghe đánh giá và Phím tắt** của onboarding chưa có bản vẽ; làm sau bản vẽ hay theo màn hiện có?
- [ ] **Doanh thu, Hoạt động, Tổng quan admin** chưa vẽ lại theo UX mới; làm theo bản vẽ cũ hay vẽ trước?
- [ ] **Dark mode** đã thiết kế token nhưng ít màn vẽ tối; làm đủ cả hai ở đợt nào?
- [ ] **Mobile** (web dưới 768 px): thanh bên thu thành sheet theo `screens.md`, có nằm trong phạm vi?
- [ ] **Cấp phép bản quyền phông** Be Vietnam Pro và JetBrains Mono (OFL): tải kèm app (không gọi Google Fonts) để giữ nguyên tắc "không gửi dữ liệu ra ngoài". Đồng ý?

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                                                                                  |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-16 | Spec | Mở hồ sơ sau khi chủ sản phẩm duyệt design system và 37 màn. Phạm vi chỉ UI và logic hiển thị; không đổi API, DB hay contract.                                                                                                 |
| 2026-11-16 | Spec | Chủ sản phẩm duyệt spec. Các câu hỏi mở được trả lời bằng đề xuất trong plan (thứ tự đợt, gộp Ôn tập, onboarding và admin theo màn hiện có, dark theo token, mobile theo cơ chế sẵn có, phông tải kèm), chờ duyệt ở cổng PLAN. |
