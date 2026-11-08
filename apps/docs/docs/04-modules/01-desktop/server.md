# Máy chủ

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src/server/`, `apps/desktop/src/server-picker/`, `packages/ui/src/components/server-dialog.tsx` · Hồ sơ: [server-picker](../../06-delivery/2026-11-08-server-picker/01-specs.md)

Địa chỉ API và web mà app desktop dùng, và cách người dùng đổi nó. Trong beta, nơi đặt máy chủ chưa cố định, nên địa chỉ không còn bị ghi cứng lúc build.

## Trách nhiệm

- Một nơi duy nhất trả lời "API và web ở đâu": `serverConfig()`. Mọi client API, WebSocket và `openWeb` đọc từ đây; ESLint cấm đọc `VITE_API_URL`/`VITE_WEB_URL` ngoài `src/server/`.
- Kiểm tra địa chỉ người dùng nhập, kiểm tra kết nối, lưu lựa chọn trên máy.
- Hộp thoại chọn máy chủ ở màn đăng nhập và Cài đặt → Nâng cao; đổi máy chủ thì đăng xuất thiết bị khỏi máy chủ cũ, lưu, rồi khởi động lại app.

## Interface

`src/server/` (không phụ thuộc module nào khác để `auth`, `session`… import được):

- `serverConfig()` trả `{apiUrl, wsUrl, webUrl, custom}`. Thứ tự ưu tiên: lựa chọn đã lưu → `VITE_API_URL`/`VITE_WEB_URL` lúc build → `http://localhost:4000` / `http://localhost:3000`. `apiUrl` luôn là `http(s)://`, `wsUrl` là `ws(s)://`, không có dấu `/` cuối. Giá trị đã lưu bị hỏng hoặc không còn hợp lệ thì bị bỏ qua.
- `validateServerUrl(input, {dev})`: chỉ nhận `https://`; `http://localhost` và `http://127.0.0.1` chỉ khi `dev` (bản `vite dev`/`tauri dev`). Từ chối địa chỉ có tên người dùng, mật khẩu, tham số hoặc `#`. Trả lý do bằng tiếng Việt.
- `saveServer({api, web})`, `resetServer()`, `defaultServer()` (địa chỉ lúc build), `isDevBuild()`.
- `checkServer(apiUrl)`: `GET {apiUrl}/healthz` với timeout 5 giây, trả `{ok: true}` hoặc `{ok: false, cause}`; `cause` là câu ngắn cố định, không chứa địa chỉ hay lỗi gốc.

`src/server-picker/` (nối vào app): `<ServerLink />` (liên kết nhỏ "Máy chủ" ở `LoginScreen`, truyền qua prop `serverSlot`), `<ServerSettings />` (mục "Nâng cao" trong Cài đặt) và `changeServer(choice, deps)`.

`ServerDialog` ở `@cuelingo/ui` thuần hiển thị: nhận `current`, `defaultChoice`, `devMode`, `signedIn`, `validate`, `onCheck`, `onSave`, `onClose`. Danh sách chọn sẵn: "CueLingo Beta (mặc định)", "Tuỳ chỉnh…" (hai ô: địa chỉ API và địa chỉ web) và mục `localhost` chỉ khi `devMode`. "Đặt lại mặc định" chọn lại mục mặc định; lưu mục mặc định thì app xoá lựa chọn đã lưu.

## Luồng đổi máy chủ

1. Người dùng chọn và (tuỳ ý) bấm "Kiểm tra kết nối". Nếu kiểm tra thất bại, bấm "Lưu" chỉ hiện cảnh báo; phải bấm "Vẫn lưu" mới lưu.
2. Hộp thoại luôn nói tài khoản và nội dung cuộc họp sẽ gửi tới máy chủ nào, và app sẽ khởi động lại.
3. `changeServer`: chặn nếu `sessionController` khác `idle` (đang họp); `revokeThisDevice` trên máy chủ cũ (best effort); xoá token trong Keychain; lưu lựa chọn; `native.relaunchApp()`.
4. Nếu app không tự khởi động lại được (bản dev, bản chưa ký), hiện màn "Hãy đóng và mở lại CueLingo". Các client API được tạo lúc nạp module nên chỉ khởi động lại mới áp dụng địa chỉ mới cho cả hai webview (chính và overlay).

## Dữ liệu & sự kiện

- Lưu ở `localStorage` khoá `cuelingo.server.v1` (`{api, web}`), chung origin cho cả hai webview; chỉ nằm trên máy, không gửi lên máy chủ; giữ nguyên qua khởi động lại và cập nhật.
- Địa chỉ tuỳ chỉnh không được ghi vào log hay telemetry: `checkServer` không log, `cause` không chứa địa chỉ, sự kiện kích hoạt không mang địa chỉ.
- Cập nhật app không phụ thuộc máy chủ đã chọn: endpoint và khoá công khai của updater được gắn vào bản build phát hành, không đọc từ `serverConfig()` ([Cập nhật](./updater.md)); chữ ký vẫn được kiểm như cũ. Phần này không đổi trong hồ sơ này (AC12 chỉ rà soát).

## Quyền riêng tư

Cho phép trỏ app tới máy chủ bất kỳ là rủi ro thật: máy chủ đó nhận đăng nhập và nội dung họp. Giảm thiểu: chỉ `https`, cảnh báo nêu tên miền đích, bắt đăng xuất khi đổi, không có đường tự đổi (không có link mở app; nếu thêm sau, link luôn phải hỏi xác nhận).

## Hướng dẫn cho tester

- Mặc định bạn không cần làm gì: app dùng máy chủ "CueLingo Beta".
- Khi được báo địa chỉ máy chủ mới (hoặc không đăng nhập được): ở màn đăng nhập bấm "Máy chủ" (nếu đã đăng nhập: Cài đặt → Nâng cao → "Đổi máy chủ") → chọn "Tuỳ chỉnh…" → nhập địa chỉ API và địa chỉ web do nhóm gửi (bắt đầu bằng `https://`) → "Kiểm tra kết nối" → "Lưu".
- App đăng xuất bạn và tự mở lại; nếu không tự mở lại, hãy đóng và mở lại CueLingo, rồi đăng nhập lại.
- Không đổi được khi đang họp: hãy dừng cuộc họp trước.
- Muốn quay về: Cài đặt → Nâng cao → "Đổi máy chủ" → "Đặt lại mặc định" → "Lưu".
- Chỉ nhập địa chỉ do nhóm CueLingo gửi qua kênh bạn tin; máy chủ lạ nhận được tài khoản và nội dung họp của bạn.

## Câu hỏi mở

- Danh sách chọn sẵn có thêm môi trường thử không (hiện chỉ "CueLingo Beta" lấy từ `CUELINGO_API_URL` lúc build)?
- Link mở app `cuelingo://server?...`: để sau; plugin deep-link đã có.
- Có xoá cache cục bộ gắn với máy chủ cũ khi đổi không (hiện token bị xoá, dữ liệu cục bộ giữ nguyên).
