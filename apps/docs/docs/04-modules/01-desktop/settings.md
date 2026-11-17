# Settings

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src/settings/`

Cài đặt trong app và bản đồng bộ theo tài khoản: Assist mặc định cùng cách hiển thị overlay.

## Trách nhiệm

- Tải cài đặt tài khoản sau khi đăng nhập và áp dụng vào native + hai webview
- Chỉnh mức Assist và cách hiển thị overlay
- Đồng bộ thay đổi lên API sau 800 ms không có thao tác mới
- Mở trang quản lý dữ liệu trên web
- Thẻ Giới thiệu hiện phiên bản đang chạy (`APP_VERSION` đọc từ `tauri.conf.json` lúc build) và mục cập nhật `<UpdateSection />` ([Cập nhật app](./updater.md))
- Mục **Gợi ý từ lịch** (`<CalendarSettings />`) và thẻ gợi ý ở trang chủ chỉ có trên macOS (đọc EventKit); trên Windows ẩn hẳn (`hasCalendar()` ở `src/lib/platform.ts`)
- Khung cửa sổ chỉ chừa chỗ cho đèn giao thông (`dragRegion`) trên macOS; Windows dùng thanh tiêu đề hệ thống
- Mục **Nâng cao → Máy chủ**: hiện máy chủ đang dùng và mở hộp thoại đổi (`<ServerSettings />`, chi tiết ở [Máy chủ](./server.md)); không gửi lên API, chỉ lưu trên máy

## Phạm vi MVP

- US-15 (một phần)

## Interface

- `<SettingsPage />` (`src/app/`): danh sách mục bên trái, mỗi lần một mục bên phải: Tài khoản và gói (`AccountCard`, `UsagePanel`), Họp và caption (`<AssistSettings />`, quyền, bài nghe đánh giá), **Mô hình** (`<LanguageModels />`, chỉ khi app quản lý được model: Windows, macOS khi có bản Swift), Giọng đọc (`VoiceSettings`), Lịch (chỉ macOS), Quyền riêng tư (`PrivacyPanel`), Thiết bị và máy chủ, Cập nhật và giới thiệu (kèm "Xem lại hướng dẫn" và lộ trình)
- `<AssistSettings />`: chọn Assist level `4`, `3`, `1` hoặc `0`
- `<SavedIndicator saved />` và `useSavedFlash()`: chữ "Đã lưu" (vùng `role=status`, `aria-live=polite`, luôn có trong trang) hiện 2,5 giây sau khi một mục tự lưu xong: mức hỗ trợ (sau khi native nhận) và giọng đọc (đã lưu trên máy; đồng bộ lên tài khoản chạy nền sau 800 ms nên chỉ báo không chờ API)
- `<UsagePanel />` (`src/usage/`): mục "Gói và lượng dùng" ở trang Cài đặt, gọi `client.usage.get()` (`GET /v1/me/usage`) và `client.billing.overview()` (`GET /v1/billing`, qua `billing-api.ts`), hiện `UsageSummary` của `@cuelingo/ui` (tên gói + một thanh cho từng hạn mức); lỗi tải hiện "Không tải được lượng dùng"
  - Nút **"Nâng gói"** gọi `openWeb('/upgrade')` → `native.openUrl(webUrl + '/upgrade')` mở trình duyệt mặc định. **Không truyền token** trên URL: nếu chưa đăng nhập trên web thì đăng nhập lại ở đó. Mua và hiện QR đều ở web, desktop không tạo đơn
  - Nút **ẩn** khi `enabled: false`, khi không còn gói nào để nâng (`canUpgrade` trong `upgrade.ts`), hoặc khi đọc `/v1/billing` lỗi
  - Còn ≤ 3 ngày hết hạn thì hiện "Gói Pro hết hạn ngày dd/mm/yyyy" (`planExpiresAt = current.expiresAt`)
- `useSettings`: store `{assistLevel, setAssistLevel()}` trong bộ nhớ của webview
- Gọi `native.setAssistLevel(level)` và `native.publishSettings({assistLevel})` khi người dùng đổi mức
- `settingsApi`: gọi `GET/PATCH /v1/me/settings` bằng device token
- `useSettingsSync()`: tải và áp dụng cài đặt khi thông tin đăng nhập sẵn sàng
- `queueSettingsPatch()`: deep merge thay đổi và debounce 800 ms; lỗi mạng được giữ để thử cùng lần đổi kế

## Phụ thuộc

- Zustand
- TanStack Query
- Cầu nối `apps/desktop/src/lib/native.ts`
- `@cuelingo/core-sdk` (lưu bền, chưa triển khai)

## Dữ liệu & sự kiện

- Cửa sổ `main` giữ Assist level trong bộ nhớ và phát event `settings` để overlay đổi ngay
- Các khoá `cuelingo.overlay.{fontSize,opacity,theme}` nằm trong `localStorage` chung origin
- Khoá `cuelingo.server.v1` (máy chủ đã chọn) cũng nằm trong `localStorage`, thuộc module [Máy chủ](./server.md)
- Nguồn lưu bền là `UserSettings` ở API; mặc định Assist 4, chữ 18 px, nền 88%, giao diện tối, không lưu audio, giọng đọc `Kore`
- **Mô hình** (`<LanguageModels />`, `src/models/`): danh sách mọi ngôn ngữ hỗ trợ, sinh từ `SUPPORTED_LANGUAGES`. Mỗi dòng nêu tên, nơi chạy ("Trên máy" hoặc "Đám mây") và trạng thái: "Đã sẵn sàng", nút "Tải mô hình ngay · 631 MB" (kèm tiến trình có ✕ hủy và ↻ tải lại, lỗi và "Thử lại"), hoặc "Không cần tải mô hình" cho ngôn ngữ chạy đám mây (vẫn theo bước đồng ý gửi âm thanh sẵn có). Dùng chung `useLocalModels` với onboarding và trang Phiên họp nên một lần tải hiện ở cả ba nơi. Mục ẩn khi `model_status` trả `null`
- **Giọng đọc** (`VoiceSettings`, dùng `VoicePicker` của `@cuelingo/ui`): chọn một trong 6 giọng, có nút nghe thử câu mẫu cố định. Đổi giọng thì lưu cùng tài khoản và xoá bộ nhớ âm thanh đã tải, nên Ôn tập, tra từ và Nói giúp đọc bằng giọng mới ngay. Web có cùng mục này trong Tuỳ chọn

## Quyền riêng tư

`saveAudio` mặc định `false`. Web giải thích âm thanh chỉ được giữ đến khi người dùng xoá hoặc tối đa 30 ngày.

## Giao diện và đăng xuất

Cài đặt có mục "Giao diện" (`ThemeSwitch`: Theo hệ thống, Sáng, Tối, lưu trên máy) và thẻ Tài khoản có nút chữ "Đăng xuất" (cả khi chạy bằng token dev).
