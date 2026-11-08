# Plan — server-picker

## 1. Bối cảnh code

- Địa chỉ API và web được đọc ở **10 chỗ** bằng `import.meta.env.VITE_API_URL` / `VITE_WEB_URL`: `auth-api.ts`, `me-api.ts`, `settings-api.ts`, `dial-api.ts`, `insights-api.ts`, `study-api.ts`, `privacy-api.ts`, `assist-api.ts`, `feedback-api.ts`, `open-web.ts`, và `session/use-session.ts` (WebSocket `ws://…`). Phần lớn tạo client **một lần lúc nạp module** với `apiUrl` cố định, nên đổi địa chỉ lúc đang chạy không có tác dụng với các client đã tạo.
- App có hai webview (cửa sổ chính và overlay) dùng chung origin nên dùng chung `localStorage`; `settings-store.ts` đã có mẫu lưu lựa chọn bằng `localStorage` trong `try/catch`.
- `LoginScreen.tsx` là màn hiện khi chưa đăng nhập; `AccountCard`/Cài đặt hiện khi đã đăng nhập. `auth-store` giữ token (Keychain), `revokeThisDevice` thu hồi thiết bị.
- `tauri-plugin-process` đã có (updater dùng để khởi động lại); `tauri-plugin-deep-link` cũng đã có (đăng nhập qua link). `sessionController.getSnapshot().status !== 'idle'` cho biết đang họp (`use-updater.ts` dùng để khoá cập nhật).
- API đã có `/health` (`services/api/src/app.ts`). Tauri `csp` đang `null` nên gọi tới máy chủ bất kỳ không bị chặn ở tầng này.
- Quy tắc repo: UI tiếng Việt; UI dùng chung ở `@cuelingo/ui`; code ở `apps/desktop/src/<module>/` có `index.ts`.

## 2. Phương án

| #   | Phương án                                                                                                    | Ưu                                                                                                     | Nhược                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| A   | Một hàm `serverConfig()` đọc địa chỉ **lúc khởi động**; lưu lựa chọn rồi **khởi động lại app** để áp dụng    | Đơn giản, chắc: mọi client, WebSocket và hai webview đều dùng địa chỉ mới; không có trạng thái lơ lửng | Đổi máy chủ làm app khởi động lại (vài giây); không đổi nóng                                              |
| B   | Biến mọi client thành "đọc địa chỉ mỗi lần gọi" (truyền hàm thay vì chuỗi), đổi nóng không cần khởi động lại | Mượt hơn                                                                                               | Sửa 10+ module và controller realtime; phiên WebSocket và cache đang giữ địa chỉ cũ; dễ sót, khó kiểm hết |
| C   | Chỉ thêm biến môi trường lúc build/`defaults write`, không có UI                                             | Gần như không đổi code                                                                                 | Không đáp ứng yêu cầu (UI, đổi được cả khi chưa đăng nhập)                                                |

**Chọn: A.** Đổi máy chủ hiếm khi xảy ra và đằng nào cũng phải đăng xuất, nên khởi động lại là chấp nhận được; đổi lại tránh hẳn lớp lỗi "client này còn địa chỉ cũ". B có thể làm sau nếu cần. Không cần ADR: không đổi kiến trúc, chỉ thêm một cấu hình phía client.

Mặc định cho câu hỏi mở (đổi được ở cổng này):

1. Danh sách chọn sẵn: "CueLingo Beta (mặc định)" và "Tuỳ chỉnh…"; `localhost` chỉ khi build dev.
2. "Tuỳ chỉnh…" hiện trong Cài đặt → Nâng cao và qua liên kết nhỏ "Máy chủ" ở màn đăng nhập.
3. Đổi máy chủ xoá phiên đăng nhập; dữ liệu cục bộ gắn với tài khoản cũ không dùng lại (không xoá dữ liệu máy chủ).
4. Link mở app `cuelingo://` để sau; plugin deep-link đã có nên việc thêm sau khá rẻ.

| Tác động                            | Có?    | Chi tiết                                                                                                                           |
| ----------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| DB migration                        | Không  |                                                                                                                                    |
| Contract (`@cuelingo/shared`)       | Không  | Dùng `/health` có sẵn                                                                                                              |
| Event / Learner Model               | Không  |                                                                                                                                    |
| Prompt / model AI                   | Không  |                                                                                                                                    |
| Quyền riêng tư / dữ liệu người dùng | **Có** | Cho phép trỏ app tới máy chủ bất kỳ: chỉ `https`, cảnh báo rõ, đăng xuất khi đổi, không ghi địa chỉ vào log/telemetry (AC5, 8, 13) |

## 3. Các bước (mỗi bước ≈ 1 commit)

| #   | Bước                                                                                                                                                                                                            | File                                                          | Điểm mở rộng   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------- |
| 1   | `apps/desktop/src/server/`: `server-config.ts` (`serverConfig()`, `validateServerUrl`, `saveServer`, `resetServer`, ưu tiên: đã lưu → build → mặc định; chuẩn hoá về `http(s)` và `ws(s)`), test AC1, 5, 10, 11 | `src/server/*`                                                | Desktop module |
| 2   | Thay 10 chỗ đọc `VITE_API_URL`/`VITE_WEB_URL` bằng `serverConfig()`; không đổi hành vi khi chưa lưu gì; test cũ giữ xanh                                                                                        | các file `*-api.ts`, `open-web.ts`, `use-session.ts`          | Desktop module |
| 3   | `checkServer(url)` gọi `/health` có timeout, báo nguyên nhân ngắn (AC6); không ghi log địa chỉ (AC13)                                                                                                           | `src/server/check-server.ts`                                  | Desktop module |
| 4   | `ServerDialog` trong `@cuelingo/ui` (danh sách chọn sẵn, nhập tuỳ chỉnh, kiểm tra kết nối, cảnh báo, lưu/đặt lại) — thuần hiển thị, nhận hàm qua props (AC4, 6, 7)                                              | `packages/ui/src/components/server-dialog.tsx`                | UI chung       |
| 5   | Nối vào desktop: liên kết "Máy chủ" ở `LoginScreen` (AC2), mục trong Cài đặt → Nâng cao (AC3); khi đổi: cảnh báo, `revokeThisDevice` best-effort, xoá token, rồi `relaunch` (AC8); chặn khi đang họp (AC9)      | `LoginScreen.tsx`, `App.tsx`, `src/server/ServerSettings.tsx` | Desktop        |
| 6   | Docs: trang module `server`, cập nhật `settings.md`/`tauri-core.md`, ADR 0017 (một dòng hệ quả), hướng dẫn cho tester; `pnpm verify`, `pnpm docs:build`; chạy thật app dev với hai máy chủ API cục bộ           | `apps/docs/docs/04-modules/01-desktop/**`, `03-review.md`     | Docs           |

## 4. Rủi ro

| Rủi ro                                                                    | Giảm thiểu                                                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Sót một chỗ đọc địa chỉ cũ nên một vài tính năng vẫn gọi máy chủ mặc định | Bước 2 grep toàn `apps/desktop/src` và thêm test/lint cấm `import.meta.env.VITE_API_URL` ngoài `server/`                        |
| Overlay webview giữ địa chỉ cũ                                            | Khởi động lại app áp dụng cho cả hai webview; kiểm khi chạy thật                                                                |
| Link/cài đặt bị lợi dụng để dụ trỏ sang máy chủ giả                       | Chỉ `https`, cảnh báo rõ tên miền đích, bắt đăng xuất khi đổi; không có đường tự đổi (link mở app để sau, sẽ luôn hỏi xác nhận) |
| `relaunch` không chạy được trong bản dev hoặc trên máy chưa ký            | Dùng `tauri-plugin-process` giống updater; nếu lỗi thì báo "hãy đóng và mở lại CueLingo"                                        |
| Không chạy thật được với máy chủ cloud vì chưa có                         | Chạy thật với API cục bộ ở hai cổng khác nhau; ghi rõ ở `03-review.md`                                                          |

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                                                                                  |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-08 | Plan | Trình phương án A (đổi → khởi động lại); B (đổi nóng) bị loại vì phải sửa 10+ client và phiên đang chạy                                                                                                                                                                                                                        |
| 2026-11-08 | Làm  | Lệch plan khi làm: (1) endpoint là `/healthz`, không phải `/health`; (2) lưu hai địa chỉ `{api, web}` thay vì một; (3) giao diện + luồng đổi nằm ở `src/server-picker/` thay vì `src/server/` để tránh vòng phụ thuộc với `auth`/`session`; (4) "Đặt lại mặc định" đi qua đường Lưu; (5) có 14 file đọc địa chỉ, không phải 10 |
| 2026-11-08 | Làm  | Chạy thật trên trình duyệt với hai API cục bộ chưa làm được: sandbox chặn mở cổng cục bộ. Ghi ở `03-review.md`                                                                                                                                                                                                                 |
