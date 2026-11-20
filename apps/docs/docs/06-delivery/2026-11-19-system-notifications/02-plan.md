# Plan — system-notifications

## 1. Bối cảnh code

- **Điểm mở rộng:** ranh giới native ↔ webview (`04-modules/01-desktop/tauri-core.md`) + UI Cài đặt. Không đụng contract `@cuelingo/shared`, DB, AI.
- **Convention:** `web-feature.md` (TS), `native-desktop.md` (Rust). Mẫu cùng loại: nút/ gói native trong `src/lib/native.ts`; cờ cục bộ lưu `localStorage` như `settings-store.ts` (`cuelingo.language`) và `overlay-prefs.ts`.
- **Hiện trạng:**
  - Lỗi thu âm do `session-controller.ts` (`handleAudioStatus`) biết: đặt `micFailed`/`systemFailed` trong snapshot và gửi `notice` cho overlay. Controller chạy ở cửa sổ chính, luôn sống kể cả khi cửa sổ ẩn.
  - Debrief: `useDebriefBrief(sessionId)` poll `GET debrief` và trả `ready/denied/skipped/timeout`; hiện chỉ chạy trong `SessionPanel`, tức chỉ khi đang ở màn Họp. Muốn báo khi người dùng ở màn khác hoặc đã thu nhỏ thì phải chạy ở cấp `App`.
  - Debrief mở bằng `openDebrief(sessionId)` → trình duyệt `webUrl/sessions/:id`.
  - Cửa sổ có `main` và `overlay`; capabilities hiện chưa có plugin thông báo. `core:default` đã có `is-focused`.
  - Chưa có plugin thông báo (`tauri-plugin-notification`) trong `Cargo.toml` và `package.json`.

## 2. Phương án

| #   | Phương án                                                                                      | Ưu                                                                                  | Nhược                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| A   | `tauri-plugin-notification` (chính thức), gửi từ webview qua `@tauri-apps/plugin-notification` | Ít code, một API cho macOS và Windows, có `isPermissionGranted`/`requestPermission` | Trên desktop plugin **không có callback khi bấm** (chỉ mobile có `onAction`); nhà cung cấp là OS, không có dịch vụ mới |
| B   | Tự gọi `notify-rust` trong Rust, chờ click                                                     | Có thể bắt click                                                                    | Phải tự xử lý hai OS, thêm phụ thuộc, khó test, nhiều rủi ro hơn nhu cầu                                               |
| C   | Chỉ thông báo trong giao diện (như hiện nay)                                                   | Không đổi gì                                                                        | Không giải quyết vấn đề: app bị che thì không thấy                                                                     |

**Chọn A.** Vì plugin không bắt được click trên desktop, **AC4 đổi lại** (xin bạn duyệt): bấm vào thông báo thì hệ điều hành đưa CueLingo lên trước (hành vi mặc định của thông báo app đã đóng gói). Để vẫn "mở đúng chỗ", app ghi nhớ đích của thông báo vừa hiện; lần đầu cửa sổ chính được focus trong vòng **2 phút** sau đó thì app tự chuyển tới đích (debrief → màn Họp có thẻ "Cuộc họp vừa xong" và nút xem debrief; lỗi thu âm → Cài đặt, mục quyền). Quá 2 phút thì bỏ đích.

| Tác động                            | Có?           | Chi tiết                                                                                                                      |
| ----------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| DB migration                        | Không         |                                                                                                                               |
| Contract (`@cuelingo/shared`)       | Không         | Công tắc chỉ trên máy này (`localStorage`)                                                                                    |
| Event / Learner Model               | Không         |                                                                                                                               |
| Prompt / model AI                   | Không         |                                                                                                                               |
| Quyền riêng tư / dữ liệu người dùng | Có, kiểm soát | Chỉ chữ cố định; không transcript/tên/tiêu đề trong thông báo và log. Dịch vụ mới: không (thông báo do hệ điều hành hiển thị) |
| Quyền của hệ điều hành              | Có            | Xin quyền thông báo (macOS) khi bật lần đầu; thêm `notification:default` vào capabilities                                     |

## 3. Các bước (mỗi bước ≈ 1 commit)

| #   | Bước                                                                                                                                                                                                                                                | File                                                                              | Điểm mở rộng |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------ |
| 1   | Thêm plugin: `tauri-plugin-notification` vào `Cargo.toml`, `lib.rs`, capabilities (`notification:default`); `@tauri-apps/plugin-notification` vào `package.json`                                                                                    | `src-tauri/{Cargo.toml,src/lib.rs,capabilities/default.json}`, `package.json`     | tauri-core   |
| 2   | Lõi TS thuần, có test: `notifications.ts` — công tắc (`localStorage`, mặc định bật), `shouldNotify(appFocused, enabled, dedupeKey)`, văn bản cố định, dedupe theo khoá, ghi nhớ đích 2 phút; cổng native bọc plugin (gửi, xin quyền)                | `src/notifications/{notifications.ts,native-gate.ts,*.test.ts,index.ts}`          | UI/Client    |
| 3   | `useSystemNotifications()` gắn ở `App`: nghe snapshot controller (lỗi mic/âm thanh hệ thống) và `useDebriefBrief` cho cuộc họp vừa xong; kiểm tra focus (`getAllWindows().some(isFocused)`); khi cửa sổ chính được focus thì chuyển tới đích đã nhớ | `src/notifications/use-system-notifications.ts`, `src/app/App.tsx`                | UI           |
| 4   | Cài đặt: công tắc "Thông báo hệ thống" trong mục "Họp và caption"; bật lần đầu thì xin quyền, bị từ chối thì hiện dòng giải thích và nút mở cài đặt hệ thống                                                                                        | `src/notifications/NotificationSettings.tsx`, `src/app/SettingsPage.tsx` (+ test) | UI           |
| 5   | Docs cùng commit: `tauri-core.md` (plugin, capability), `session-controller.md`, `settings.md`, glossary nếu cần; spec ghi lại AC4 đã đổi; `pnpm verify` + `pnpm docs:build`                                                                        | `apps/docs/docs/04-modules/01-desktop/*.md`                                       | Docs         |

Thứ tự: 1 → 2 → 4 → 3 → 5 (công tắc có trước khi gắn vào luồng thật). Không cần agent native riêng: phần Rust chỉ là đăng ký plugin.

## 4. Rủi ro

| Rủi ro                                                                              | Giảm thiểu                                                                                               |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Plugin không bắt click trên desktop (đã nêu), nên không mở thẳng đúng trang         | Cơ chế "đích nhớ 2 phút" ở trên; ghi rõ trong spec và docs; không hứa hơn khả năng                       |
| macOS dev (`tauri dev`) dùng danh tính của Terminal nên có thể không hiện thông báo | Thử trên bản đã đóng gói (dmg); ghi chú trong review                                                     |
| Windows toast cần AppUserModelID của bản cài; chưa thử thật                         | Ghi rõ "chưa thử trên máy Windows"; phiên Windows kiểm lại                                               |
| Thông báo hiện khi người dùng đang xem app                                          | Chỉ báo khi không cửa sổ nào của app có focus (AC3); test thuần cho `shouldNotify`                       |
| Báo lặp (lỗi mic lặp, debrief mở lại)                                               | Dedupe theo khoá (`capture:mic`, `capture:system`, `debrief:<sessionId>`) trong phiên chạy của app (AC8) |
| Lộ nội dung cuộc họp qua thông báo/log                                              | Chỉ dùng hằng chữ cố định; test khẳng định không nhận tham số nội dung; không log ở nhánh gửi            |
| Poll debrief lặp khi đang ở màn Họp (hook chạy cả ở `App` và `SessionPanel`)        | Chấp nhận (hai lời gọi nhẹ, tự dừng khi xong); nếu thấy thừa thì dùng chung kết quả ở bước sau           |
