# desktop-update-settings — Phiên bản và cập nhật trong Cài đặt desktop

| Trạng thái | Loại    | Nhánh / PR                            | Ước lượng → thực tế |
| ---------- | ------- | ------------------------------------- | ------------------- |
| Xong       | feature | `feat/desktop-update-settings` / _PR_ | S → ?               |

**Phạm vi:** trong: mục "Phiên bản và cập nhật" ở trang Cài đặt desktop; sửa số phiên bản hiển thị. Ngoài: cập nhật Windows (chưa có trong `latest.json`), kênh beta, ghi chú phát hành dạng trang riêng.

## 1. Vấn đề

- App hiện số phiên bản **viết cứng** `0.1.0` (`apps/desktop/src/app/brand.ts:3`) ở thanh bên và thẻ Giới thiệu, trong khi bản đang chạy là 0.1.3. Người dùng và người hỗ trợ không biết đang chạy bản nào.
- App chỉ tự hỏi bản mới lúc mở và mỗi 6 giờ, và chỉ hiện banner ở trang Phiên họp khi có bản mới. Không có chỗ để **tự kiểm tra ngay** hay biết chắc "đang dùng bản mới nhất". Khi kiểm tra lỗi (mất mạng) thì app im lặng.

**Module chạm tới:** [Cập nhật app](../../04-modules/01-desktop/updater.md), [Cài đặt](../../04-modules/01-desktop/settings.md).

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                                                                                                                                | Test                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| AC1 | THE SYSTEM SHALL hiện phiên bản **đang chạy** (đọc từ app, khớp `tauri.conf.json`) ở thanh bên, thẻ Giới thiệu và mục cập nhật trong Cài đặt.                                                                                                     | `AboutCard.test.tsx` · `use-app-version`               |
| AC2 | WHEN người dùng bấm "Kiểm tra cập nhật" THE SYSTEM SHALL hỏi bản mới ngay, hiện "Đang kiểm tra…", rồi một trong: "Bạn đang dùng bản mới nhất" (kèm giờ kiểm tra), "Có bản mới X.Y.Z" kèm nút "Cập nhật", hoặc "Không kiểm tra được, thử lại sau". | `update-controller.test.ts` · `UpdateSection.test.tsx` |
| AC3 | WHEN người dùng bấm "Cập nhật" THE SYSTEM SHALL tải, cài và tự mở lại app như banner hiện nay; nút bị khoá khi đang họp, kèm lời giải thích.                                                                                                      | `UpdateSection.test.tsx`                               |
| AC4 | IF build không có updater (bản dev, bản tự dựng) THEN THE SYSTEM SHALL hiện "Bản này không tự cập nhật" thay vì "bản mới nhất".                                                                                                                   | `update-controller.test.ts`                            |
| AC5 | WHILE kiểm tra tự động chạy nền THE SYSTEM SHALL vẫn im lặng khi lỗi như hiện nay; banner ở trang Phiên họp và mục trong Cài đặt dùng chung một trạng thái (không hỏi hai lần cùng lúc).                                                          | `update-controller.test.ts`                            |

## 3. Câu hỏi mở

- (không có)

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                      |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-15 | Spec | Mở hồ sơ theo yêu cầu "Cài đặt desktop có version hiện tại, nút kiểm tra và update". Làm ở worktree riêng từ `main` vì nhánh W2-03 đang có agent khác commit.      |
| 2026-11-15 | Plan | **Duyệt spec và plan.** Phiên bản đọc thẳng từ `tauri.conf.json` lúc build (đơn giản hơn hook `getVersion()` trong plan, vẫn đúng AC1 vì bundle dùng chính số đó). |
