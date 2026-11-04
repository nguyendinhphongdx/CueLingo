# Review — menubar-status

**Trạng thái:** code xong, test xanh; **chưa nhìn thật trên thanh menu** và chưa có review độc lập. Chưa push.

## Thay đổi so với plan

Không có plan riêng: chủ sản phẩm duyệt spec và bảo làm theo đề xuất, nên làm thẳng theo spec.

| Dấu         | Phần                                                                | Chi tiết                                                                                               |
| ----------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 🟢 ADDED    | `src-tauri/src/tray.rs`, `icons/tray/*.png`, lệnh `tray_set_state`  | Ba biểu tượng (rảnh dạng template, đang nghe đỏ, cảnh báo hổ phách), chú thích và menu theo trạng thái |
| 🟡 MODIFIED | `src-tauri/src/lib.rs`                                              | Tray có id, mục "Dừng họp" (phát `tray-stop`), "Thoát" tắt khi đang họp                                |
| 🟢 ADDED    | `src/session/tray-sync.ts` (+ test), `native.setTray`, `onTrayStop` | Đăng ký ở mức module trong `use-session.ts`, nên chạy cả khi cửa sổ chính ẩn                           |

## Kiểm

```bash
cd apps/desktop && pnpm exec vitest run   # 42 file, 391 test xanh
cd apps/desktop/src-tauri && cargo test --lib tray   # 3 test xanh
```

## Còn lại

- **Nhìn thật (cần người dùng):** biểu tượng rảnh trên thanh menu sáng và tối, đang nghe có chấm đỏ và giờ, "Dừng họp" dừng được khi cửa sổ ẩn, "Thoát" xám khi đang họp. AC1 và AC6 chỉ kiểm bằng mắt.
- Chưa có nhãn trên biểu tượng Dock (để sau, theo câu hỏi mở số 5).
- Review độc lập (`code-reviewer`).
