# Review — desktop-update-settings

## Thay đổi so với plan

| Dấu         | File / hành vi                                      | Chi tiết                                                                                                                                                                                      |
| ----------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟡 MODIFIED | `apps/desktop/src/app/brand.ts`                     | `APP_VERSION` đọc từ `src-tauri/tauri.conf.json` lúc build thay vì `'0.1.0'` viết cứng. Plan định dùng hook `getVersion()`; đọc lúc build đơn giản hơn, không bất đồng bộ, và đúng với bundle |
| 🟡 MODIFIED | `apps/desktop/src/lib/native.ts`                    | `checkUpdate()` trả `'unsupported'` khi không có plugin updater (trước: `null`)                                                                                                               |
| 🟡 MODIFIED | `apps/desktop/src/updater/update-controller.ts`     | `checkNow()` và `getManual()`; một yêu cầu tại một thời điểm (`running`)                                                                                                                      |
| 🟢 ADDED    | `apps/desktop/src/updater/UpdateSection.tsx(+test)` | Mục trong thẻ Giới thiệu của Cài đặt                                                                                                                                                          |
| 🟡 MODIFIED | `use-updater.ts`, `AboutCard.tsx`                   | `useUpdateStatus()`; gắn `UpdateSection`                                                                                                                                                      |

**Docs:** `04-modules/01-desktop/updater.md`, `settings.md`.

## Tự review

- [x] Ranh giới & bảo mật (không đổi) · [x] Hợp đồng (không đổi) · [x] Kiến trúc (UI chỉ ở desktop, không vào `@cuelingo/ui`) · [x] AI (không) · [x] Test · [x] Docs · [x] Phạm vi

Đã chạy thật: chưa. Bản dev không có updater, nên chỉ thấy được "Bản này không tự cập nhật". Đường cài bản mới chỉ thử được từ bản 0.1.4 trở đi (bản này phải được phát hành trước).

## Lỗi tìm thấy khi review/test

| Lỗi                                                | Tìm ở                 | Sửa                              |
| -------------------------------------------------- | --------------------- | -------------------------------- |
| Phiên bản hiện `0.1.0` trong khi bản chạy là 0.1.3 | Đọc code khi lập spec | `brand.ts` đọc `tauri.conf.json` |
