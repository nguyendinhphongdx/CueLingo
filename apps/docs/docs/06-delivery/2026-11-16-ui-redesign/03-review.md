# Review — ui-redesign, đợt 1 (nền)

## Thay đổi so với plan

| Dấu         | File / hành vi                                                                                                                | Chi tiết (lý do nếu khác plan)                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 ADDED    | `badge`, `tabs`, `skeleton`, `status-row`, `notice-strip`, `empty-state`                                                      | `Tabs` có phím mũi tên, Home, End, `aria-controls`                                                                                                                   |
| 🟢 ADDED    | token `--scrim`, `--elev-*`, `--motion-*`; test `contrast.test.ts`, `tabs.test.tsx`, `states.test.tsx`                        | `--elev-*` ánh xạ sang `--shadow-*` trong `@theme inline`; `--motion-*` thay `--ease-*` để không đè `ease-out` của Tailwind                                          |
| 🟡 MODIFIED | `globals.css`, `brand.css`, base component                                                                                    | Bỏ hex, `dark:`, `text-white`, `bg-black`; `--success`, `--warning`, `--destructive` sáng đậm hơn bản vẽ để chữ trên nền nhạt đạt 4.5:1 (đo bằng `contrast.test.ts`) |
| 🟡 MODIFIED | `--brand` giữ `#4f46e5` ở cả tối                                                                                              | Chữ trắng trên `surface-live` giữ tương phản                                                                                                                         |
| 🟡 DEVIATED | phông `@fontsource/be-vietnam-pro` (tĩnh 400–700), không phải bản variable                                                    | Be Vietnam Pro không có gói variable trên npm (404); JetBrains Mono dùng variable                                                                                    |
| ⏭ DEFERRED  | `FilterCard`, căn `Card`/`StatCard`/`Kbd`, AC5 (quét logo chép tay), AC2 (test không client nào khai lại token), token cỡ chữ | Làm cùng đợt 2 khi có màn dùng tới                                                                                                                                   |

**Docs đã cập nhật:** `04-modules/05-packages/ui.md`, `05-engineering/conventions/shared-ui.md`.

## Tự review

Đã chạy agent `code-reviewer`; sửa: lớp phủ dialog ở chế độ tối, bàn phím cho Tabs, tương phản Badge, token bóng không có tác dụng, ghi đè `--ease-out`, focus ring cũ, `h-9` lệch, site chưa nhận phông, `--brand` tối.

```bash
pnpm verify   # format, lint, typecheck, 2134 test xanh; check:deps xanh khi chạy ngoài sandbox
pnpm docs:build
```

Đã chạy thật: mở desktop UI (`localhost:1420`) sáng và tối, token và phông nạp đúng, không cuộn ngang. Chưa chạy: web, ba khổ 375/768/1280 (AC20), dialog ở chế độ tối.

## Cho người review — đọc theo thứ tự

| #   | File                                                 | Soi gì                       |
| --- | ---------------------------------------------------- | ---------------------------- |
| 1   | `packages/ui/src/styles/globals.css`                 | giá trị token sáng/tối       |
| 2   | `packages/ui/src/styles/contrast.test.ts`            | cặp tương phản được kiểm     |
| 3   | `packages/ui/src/components/tabs.tsx`                | phím tắt và id               |
| 4   | `packages/ui/src/components/button.tsx`, `input.tsx` | chiều cao 40, focus ring 2px |

# Review — ui-redesign, đợt 2 đến 4 (màn hình)

## Thay đổi so với plan

| Dấu         | File / hành vi                                                                                                                                                                                          | Chi tiết (lý do nếu khác plan)                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟡 DEVIATED | Tìm trong "Cuộc họp" trên web chạy ở trình duyệt, đọc 30 cuộc họp gần nhất                                                                                                                              | API chưa có endpoint tìm; cuộc họp cũ hơn chỉ khớp theo tiêu đề. Có debounce 300 ms trước khi đọc nội dung                                                        |
| 🟡 DEVIATED | Bước "Mức hỗ trợ" của onboarding dùng lại mức hỗ trợ sẵn có                                                                                                                                             | Chưa có API hồ sơ (nghề, mục tiêu)                                                                                                                                |
| 🟡 DEVIATED | Đăng nhập là màn riêng trước onboarding, không phải một bước                                                                                                                                            | Onboarding có 6 bước, không tính đăng nhập                                                                                                                        |
| 🟡 MODIFIED | Lọc theo gói ở trang người dùng admin dùng `FilterCard` chung và còn dùng được khi dashboard đang tải hoặc lỗi (không có số)                                                                            | Thanh đo ở từng hàng dùng `DEFAULT_PLAN_LIMITS` vì DTO không có hạn mức riêng                                                                                     |
| 🟢 ADDED    | `DeleteDataSteps` và `ReviewTabsFrame` trong `@cuelingo/ui`                                                                                                                                             | Hai bản xoá dữ liệu (web, desktop) và hai khung tab Ôn tập gộp thành một; danh sách "sẽ bị xoá" khớp `deleteMyData` ở API (có hội thoại AI, không có cài đặt học) |
| 🟡 MODIFIED | Thẻ lịch ẩn khi đang họp; ngôn ngữ chỉ đổi khi cuộc họp thật sự bắt đầu (trong `useMeetingControls`)                                                                                                    | Trước đây đổi ngôn ngữ cả khi lệnh bắt đầu bị bỏ qua                                                                                                              |
| 🟡 MODIFIED | Nút sửa model lỗi đổi thành "Bắt đầu lại để tải model"                                                                                                                                                  | Nút đó bắt đầu một cuộc họp; chưa có lệnh tải model riêng                                                                                                         |
| 🟡 MODIFIED | Onboarding: đặt lại bước khi đổi người dùng, hiện chữ "Bước N trên 6", nhiều hơn 2 bước chưa xong gộp thành một thẻ "Còn N bước"                                                                        |                                                                                                                                                                   |
| 🟢 ADDED    | Overlay: `NoticeBar` thẻ đặc có icon, ngăn kéo Nói giúp (Esc, nút chữ lớn), màn chữ lớn `Teleprompter`, nút sửa trong `NoticeBar` (sự kiện `notice` có `action` tuỳ chọn), dòng "Họ vừa hỏi" ở ngăn kéo | Màn chữ lớn là lớp phủ trong cửa sổ overlay, không phải cửa sổ riêng; ngăn kéo giữ 320px (không đổi cơ chế cửa sổ)                                                |
| 🟢 ADDED    | Desktop: tìm trong Cuộc họp (logic chung `@cuelingo/ui/lib/meeting-search`), trang Góp ý, thẻ "Câu mới nhất", chỉ báo "Đã lưu", mục "Nâng cấp" ở thanh điều hướng, bảng màu landing theo token          | Tìm chạy ở client trên 30 cuộc họp gần nhất                                                                                                                       |

**Docs đã cập nhật:** `04-modules/01-desktop/session-controller.md`, `04-modules/01-desktop/onboarding.md`, `04-modules/02-web/account-privacy.md`, `04-modules/02-web/admin-users.md`, `04-modules/02-web/library.md`, `04-modules/05-packages/ui.md`.

## Sửa sau review độc lập

Danh sách xoá dữ liệu khớp API; lọc gói khi dashboard lỗi; thẻ lịch ẩn khi đang họp và không đổi ngôn ngữ khi lệnh bắt đầu bị bỏ qua; nhãn nút model; `ReviewTabs` desktop dùng chung hằng số với web; `details` của tìm kiếm ổn định giữa các lần render; thêm test cho `useMeetingControls`, thẻ onboarding, `UsageNotice`, `AdminUsersPage`, `DeleteDataSteps`.

## Chưa chạy

AC20 (ba khổ 375/768/1280 trên trình duyệt) chưa chạy cho đợt 2 đến 4. Chưa có test cho `HomePage` ghép trang (chỉ có test cho `isMeetingLive` và `useMeetingControls`) và cho việc đặt lại `onboardingStep` khi đổi người dùng ở `App.tsx`.
