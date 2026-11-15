# Plan — desktop-update-settings

## 1. Bối cảnh code

| Chỗ                                             | Hiện trạng                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `apps/desktop/src/app/brand.ts:3`               | `APP_VERSION = '0.1.0'` viết cứng; dùng ở `AppShell.tsx:27`, `AboutCard.tsx:39`                        |
| `apps/desktop/src/lib/native.ts:187-222`        | `appInfo()` đã đọc `getVersion()`; `checkUpdate()` trả `null` cả khi mới nhất lẫn khi không có updater |
| `apps/desktop/src/updater/update-controller.ts` | Trạng thái `none/available/installing/failed`; `check()` nuốt lỗi; khoá khi họp                        |
| `apps/desktop/src/updater/use-updater.ts`       | Một `updater` dùng chung; hook tự hỏi khi mở và mỗi 6 giờ                                              |
| `apps/desktop/src/app/App.tsx:191`              | Cài đặt hiện `<AboutCard />`                                                                           |

## 2. Phương án

| #    | Phương án                                                                                                                                                                                                                                                                                                                   | Ưu                                          | Nhược                                                                 |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| A ✅ | Mở rộng `update-controller`: thêm `checkNow()` trả kết quả cho lần bấm tay (`checking` · `upToDate{at}` · `unsupported` · `error`) giữ ở trường `manual`, còn `check()` nền vẫn im lặng; `native.checkUpdate()` trả `'unsupported'` khi thiếu plugin. Mục `UpdateSection` trong `AboutCard` dùng chung `updater` với banner | Một nguồn trạng thái, không hỏi trùng (AC5) | Đổi kiểu trả về của `checkUpdate` (chỉ updater dùng)                  |
| B    | Component riêng gọi thẳng `native.checkUpdate()`                                                                                                                                                                                                                                                                            | Ít đụng controller                          | Hai trạng thái lệch nhau: bấm Cập nhật ở Cài đặt mà banner không biết |

**Chọn A.** Phiên bản: hook `useAppVersion()` gọi `getVersion()` một lần (cache), fallback `APP_VERSION` lấy từ `tauri.conf.json` lúc build qua Vite (`import.meta.env` / `define`) thay cho chuỗi viết cứng.

| Tác động                            | Có?   |
| ----------------------------------- | ----- |
| DB · contract · AI · quyền riêng tư | Không |

## 3. Các bước

| #   | Bước           | File                                                                                                                                            |
| --- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Phiên bản thật | `brand.ts` (bỏ hằng viết cứng → đọc từ build), `app/use-app-version.ts`, `AppShell.tsx`, `AboutCard.tsx`                                        |
| 2   | Kiểm tra tay   | `lib/native.ts` (`'unsupported'`), `updater/update-controller.ts(+test)`, `updater/UpdateSection.tsx(+test)`, `AboutCard.tsx`, `use-updater.ts` |
| 3   | Docs           | `04-modules/01-desktop/updater.md`, `settings.md`                                                                                               |

## 4. Rủi ro

| Rủi ro                                    | Giảm thiểu                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Bấm kiểm tra khi kiểm tra nền đang chạy   | Dùng chung cờ `checking`; `checkNow` chờ lần đang chạy                                                                          |
| Không thử được cập nhật thật trên bản dev | Test controller bằng `check` giả; thử thật khi phát hành 0.1.4 (bản 0.1.3 không có mục này, nhưng 0.1.3 → 0.1.4 vẫn qua banner) |
