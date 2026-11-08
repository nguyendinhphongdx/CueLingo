# Review — server-picker

## Thay đổi so với plan

| Dấu         | File / hành vi                                                                                                 | Chi tiết (lý do nếu khác plan)                                                                                                                                                                                                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🟢 ADDED    | `apps/desktop/src/server/server-config.ts` (+test)                                                             | `serverConfig`, `validateServerUrl`, `saveServer`, `resetServer`, `defaultServer`, `isDevBuild`. Lưu **hai** địa chỉ `{api, web}` (plan chỉ nói chung "địa chỉ"): bản dev có API `:4000` và web `:3000` khác origin nên một ô không đủ.                                                                                                          |
| 🟢 ADDED    | `apps/desktop/src/server/check-server.ts` (+test)                                                              | Gọi **`/healthz`**, không phải `/health` như plan: API chỉ có `/healthz` (`services/api/src/app.ts`). Có kiểm thân `{ok: true}` để báo "không phải máy chủ CueLingo".                                                                                                                                                                            |
| 🟢 ADDED    | `packages/ui/src/components/server-dialog.tsx` (+test)                                                         | `ServerDialog` thuần hiển thị. "Đặt lại mặc định" chọn lại mục mặc định rồi đi qua đường Lưu (một đường duy nhất, có cùng cảnh báo/đăng xuất); app thấy lựa chọn trùng địa chỉ build thì gọi `resetServer()`.                                                                                                                                    |
| 🟢 ADDED    | `apps/desktop/src/server-picker/` (`ServerPicker.tsx`, `change-server.ts`, tests)                              | **Khác plan** (plan để `src/server/ServerSettings.tsx`): `auth` và `session` import `src/server`, còn picker cần `auth` và `session` → tách ra thư mục riêng để `src/server` là lá, tránh vòng phụ thuộc.                                                                                                                                        |
| 🟢 ADDED    | `native.relaunchApp()` ở `lib/native.ts`                                                                       | Dùng lại `relaunch()` của `tauri-plugin-process` và quyền `process:allow-restart` có sẵn; không thêm command Rust.                                                                                                                                                                                                                               |
| 🟡 MODIFIED | 14 file đọc `VITE_API_URL`/`VITE_WEB_URL` (`*-api.ts`, `open-web.ts`, `session-actions.ts`, `use-session.ts`…) | Plan nói 10 chỗ, thực tế 14 file (thêm `debrief-api`, `sessions-api`, `session-actions`, `auth-api` đọc cả API lẫn web). Chỉ thay nguồn địa chỉ; `auth-api` và `feedback-api` bỏ đoạn đổi `ws`→`http` thừa vì `serverConfig()` đã chuẩn hoá. **Soi kỹ**: client vẫn tạo một lần lúc nạp module, nên chỉ khởi động lại mới áp dụng (phương án A). |
| 🟡 MODIFIED | `eslint.config.mjs`                                                                                            | Luật `no-restricted-syntax` cấm `VITE_API_URL`/`VITE_WEB_URL` trong `apps/desktop/src` trừ `src/server/**` (đã thử: ghi vào file tạm thì lint đỏ).                                                                                                                                                                                               |
| 🟡 MODIFIED | `LoginScreen.tsx`, `App.tsx`, `auth/index.ts`                                                                  | `LoginScreen` nhận `serverSlot` (không import picker để tránh vòng); `App` truyền `<ServerLink />` và thêm `<ServerSettings />` (mục "Nâng cao") vào Cài đặt. `auth` xuất thêm `revokeThisDevice`.                                                                                                                                               |
| 🟡 MODIFIED | Docs                                                                                                           | Xem bên dưới.                                                                                                                                                                                                                                                                                                                                    |

**Docs đã cập nhật:** `04-modules/01-desktop/server.md` (mới, kèm hướng dẫn tester), `README.md`, `settings.md`, `tauri-core.md`, `session-controller.md` của phần Desktop; `04-modules/05-packages/ui.md`; ADR `0017-beta-distribution-adhoc-updater.md` (một dòng hệ quả); decision log của hồ sơ này.

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md): - [x] Ranh giới & bảo mật · - [x] Hợp đồng (không đổi `@cuelingo/shared`/core-sdk) · - [x] Kiến trúc (`check:deps` xanh, `src/server` là lá) · - [x] AI (không đụng) · - [x] Test · - [x] Docs · - [x] Phạm vi

```bash
pnpm verify   # format:check, lint, typecheck, test (207 file, 1612 test), check:deps: xanh
pnpm docs:build   # xanh
```

Chạy trên Node 22.14.0 (repo yêu cầu ≥ 22.19 cho Testcontainers; `pnpm verify` không cần Docker nên vẫn chạy được, chỉ cảnh báo engine).

| AC   | Bằng chứng                                                                                                                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | `server-config.test.ts`: ưu tiên đã lưu → build → mặc định; chuẩn hoá `http(s)`/`ws(s)`; giá trị lưu hỏng bị bỏ                                                                               |
| AC2  | `ServerPicker.test.tsx`: `LoginScreen` hiện liên kết "Máy chủ" qua `serverSlot`                                                                                                               |
| AC3  | `ServerPicker.test.tsx`: `ServerSettingsView` ("Nâng cao" / "Đổi máy chủ"). Chỉ kiểm markup, chưa kiểm `App` ráp thật                                                                         |
| AC4  | `server-dialog.test.tsx`: hai mục chọn sẵn; `localhost` chỉ khi `devMode`                                                                                                                     |
| AC5  | `server-config.test.ts`: bảng 15 ca; `server-dialog.test.tsx`: lý do hiện ra và nút Lưu bị khoá                                                                                               |
| AC6  | `check-server.test.ts` (máy chủ giả bằng `fetcher`: thành công, lỗi mạng, mã 5xx, không phải CueLingo, timeout); dialog hiện kết quả                                                          |
| AC7  | `server-dialog.test.tsx`: sau kiểm tra thất bại, "Lưu" chỉ hỏi lại, "Vẫn lưu" mới gọi `onSave`                                                                                                |
| AC8  | `change-server.test.ts`: thứ tự revoke (máy chủ cũ) → xoá token → lưu → khởi động lại; revoke lỗi không chặn; dialog nêu tên miền đích                                                        |
| AC9  | `change-server.test.ts` (không đổi gì khi đang họp) và `ServerPickerDialog` hiện thông báo thay vì hộp thoại khi `status !== 'idle'`. Phần UI này **không có test**                           |
| AC10 | `server-config.test.ts` (`resetServer`) và `server-dialog.test.tsx` ("Đặt lại mặc định" → lưu mục mặc định)                                                                                   |
| AC11 | `server-config.test.ts`: đọc lại sau khi lưu, đúng khoá `localStorage`. Chưa thử khởi động lại/cập nhật thật                                                                                  |
| AC12 | Rà soát, không đổi: updater lấy endpoint và khoá công khai từ cấu hình build phát hành (`lib.rs`), không đọc `serverConfig()`                                                                 |
| AC13 | `check-server.test.ts` kiểm `cause` không chứa địa chỉ và không có `console.*`. **Chưa có test riêng cho telemetry**: sự kiện kích hoạt vốn không có trường địa chỉ, tôi chỉ rà soát bằng mắt |

Đã chạy thật: **chưa chạy được app/trình duyệt**. Lần thử `vite` ở cổng 1420 bị sandbox chặn (`listen EPERM`, cổng cục bộ bị tắt), nên chưa chạy luồng "hai API cục bộ ở hai cổng khác nhau". Chưa thử: `relaunch` thật trong Tauri (đường dự phòng "hãy đóng và mở lại" chỉ có test đơn vị), overlay webview sau khi đổi, đổi máy chủ khi đang họp thật, màn đăng nhập trong cửa sổ Tauri.

## Cho người review — đọc theo thứ tự

| #   | File                                              | Soi gì                                                                                                                                                                              |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/desktop/src/server/server-config.ts`        | Luật `validateServerUrl` (https; localhost chỉ ở dev; cấm user:pass, query, `#`); giá trị lưu được kiểm lại mỗi lần đọc nên bản dev lưu localhost không có hiệu lực ở bản phát hành |
| 2   | `apps/desktop/src/server-picker/change-server.ts` | Thứ tự revoke → xoá token → lưu → khởi động lại; chặn khi đang họp                                                                                                                  |
| 3   | `apps/desktop/src/server-picker/ServerPicker.tsx` | Nối thật: màn "hãy mở lại" chặn toàn bộ app vì các client vẫn giữ địa chỉ cũ; cách lấy trạng thái họp                                                                               |
| 4   | `packages/ui/src/components/server-dialog.tsx`    | Luồng "kiểm tra thất bại → Vẫn lưu"; kết quả kiểm gắn với địa chỉ đã kiểm                                                                                                           |
| 5   | `apps/desktop/src/server/check-server.ts`         | Không để địa chỉ lọt vào `cause`; timeout 5 giây; `credentials: 'omit'`                                                                                                             |
| 6   | `eslint.config.mjs` và diff 14 file `*-api.ts`    | Không sót chỗ đọc địa chỉ cũ (`git grep VITE_API_URL apps/desktop/src` chỉ còn `src/server`)                                                                                        |

## Lỗi tìm thấy khi review/test

| Lỗi                                                                                                             | Tìm ở                         | Sửa                                                                      |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| Plan ghi `/health` nhưng API chỉ có `/healthz`                                                                  | Đọc `services/api/src/app.ts` | `checkServer` gọi `/healthz`                                             |
| Biến build rỗng (`''`) đè mặc định localhost                                                                    | Test `serverConfig` lần đầu   | `defaultServer`/`serverConfig` dùng `\|\|` về mặc định sau khi nhận biến |
| Hạn chế còn lại: máy chủ tuỳ chỉnh phải cho phép CORS từ origin của app (`tauri://localhost`)                   | Suy từ cấu hình CORS của API  | Chưa xử lý; cần kiểm khi có máy chủ thật                                 |
| Hạn chế còn lại: mục "CueLingo Beta (mặc định)" ở bản dev cũng là `localhost:4000` nếu không đặt `VITE_API_URL` | Thiết kế                      | Chấp nhận; mục `localhost` riêng vẫn hiện ở bản dev                      |
