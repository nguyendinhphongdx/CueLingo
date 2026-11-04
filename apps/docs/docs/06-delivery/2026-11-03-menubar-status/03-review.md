# Review — menubar-status

**Trạng thái:** code xong sau một vòng review độc lập (`code-reviewer`); test xanh; **chưa nhìn thật trên thanh menu**. Chưa push.

## Thay đổi so với plan

Không có plan riêng: chủ sản phẩm duyệt spec và bảo làm theo đề xuất, nên làm thẳng theo spec.

| Dấu         | Phần                                                                | Chi tiết (lý do nếu khác spec)                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🟢 ADDED    | `src-tauri/src/tray.rs`, `icons/tray/*.png`, lệnh `tray_report`     | Ba biểu tượng và chú thích cố định; Rust quyết định live theo phiên native, vẽ lại ở `session_start`/`session_stop`                                                                                    |
| 🟡 MODIFIED | `src-tauri/src/lib.rs`, `commands.rs`                               | Tray có id; mục "Dừng họp" phát `tray-stop`. Khác AC5: "Thoát" không bị tắt mà đổi thành "Dừng họp và thoát" (chờ họp xong tối đa 20 giây), vì tắt cứng có thể kẹt khi webview chết hoặc tải lại       |
| 🟢 ADDED    | `src/session/tray-sync.ts` (+ test), `native.trayReport/onTrayStop` | Đăng ký ở mức module trong `use-session.ts`, chạy cả khi cửa sổ ẩn; báo còn họp, phút, luồng lỗi; thử lại sau lỗi; nhịp 15 giây; bỏ qua "Dừng họp" khi họp còn đang khởi động (như nút Dừng trong app) |

## Lỗi tìm thấy khi review

| Lỗi                                                                                                                                      | Tìm ở         | Sửa                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| 🔴 Tray báo rảnh khi `status` = `error` giữa họp trong lúc sidecar vẫn thu và tải âm thanh lên (sai AC2, sai chỉ báo quyền riêng tư)     | code-reviewer | Rust quyết định live theo `session_id` của phiên native; webview không báo idle thay Rust                    |
| 🔴 Webview tải lại hoặc chết: tray báo rảnh sai, hoặc kẹt Live với "Thoát" bị tắt, không dừng được từ menu                               | code-reviewer | Cùng sửa trên; "Thoát" luôn bấm được, chờ tối đa 20 giây rồi thoát                                           |
| 🟡 "Dừng họp" bật cả lúc đang kết nối, trong khi nút Dừng trong app bị tắt                                                               | code-reviewer | `tray-stop` bị bỏ qua khi `status` = `connecting`; có test                                                   |
| 🟡 Lỗi cập nhật icon không được thử lại; nhịp 60 giây làm phút chậm gần 2 phút                                                           | code-reviewer | Thử lại sau 2 giây; nhịp 15 giây                                                                             |
| 🟡 Test khoá hành vi sai (`error` ra idle), test "never throws" không có assertion, tên test AC6 không đúng; thiếu test cho bật/tắt menu | code-reviewer | Viết lại test theo hành vi mới; tách hàm thuần `kind_for`, `menu_for` có test Rust; test giải mã ba file PNG |

## Kiểm

```bash
cd apps/desktop && pnpm exec vitest run          # 42 file, 393 test xanh
cd apps/desktop/src-tauri && cargo test --lib    # 21 test xanh
cd apps/desktop/src-tauri && cargo clippy -- -D warnings   # sạch
```

`pnpm check:deps` nguyên bản chưa chạy được trong sandbox (không đọc được `apps/desktop/.env`).

## Còn lại

- **Nhìn thật (cần người dùng):** AC1 (biểu tượng rảnh trên thanh menu sáng và tối, thứ tự đổi icon rồi cờ template) và AC6 (đang họp, đóng cửa sổ chính, biểu tượng vẫn đổi; "Dừng họp" và "Dừng họp và thoát" hoạt động).
- **⌘Q và Quit trên Dock** vẫn thoát ngay giữa họp (không qua đường tray); chặn bằng `RunEvent::ExitRequested` là việc sau, cần tính tới việc không để kẹt.
- Chưa có nhãn trên biểu tượng Dock (câu hỏi mở số 5, để sau).
