# Review — landing-redesign

## Thay đổi so với plan

| Dấu         | File / hành vi                                                                                | Chi tiết (lý do nếu khác plan)                                                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟡 MODIFIED | `landing.module.css` (viết lại), `landing-view.tsx`, `download-page.tsx`, `public-header.tsx` | Thiết kế mới: motif hai dòng caption, hero hình thanh cắt mép, bảng chi tiết, dải quyền riêng tư, FAQ, chân trang chữ khối. Nội dung quyền riêng tư giữ nguyên ý cũ |
| 🟢 ADDED    | `product-visuals.tsx`, `stages.tsx`, `landing-view.test.tsx`                                  | Mảnh giao diện sản phẩm dựng bằng code, thanh trượt 4 giai đoạn, test cấu trúc và "không bịa bằng chứng"                                                            |
| 🔴 REMOVED  | `caption-overlay.tsx`                                                                         | Thay bằng `product-visuals.tsx`                                                                                                                                     |
| 🟡 MODIFIED | `apps/web/.../LandingPage.test.tsx`, `DownloadPage.test.tsx`, `apps/site/src/pages.test.tsx`  | Cập nhật câu chữ và bỏ kiểm class `min-h-11` cũ                                                                                                                     |
| 🟢 ADDED    | `04-modules/02-web/landing.md`, `.claude/launch.json` (mục `site`)                            | Trang docs; cấu hình chạy site thử                                                                                                                                  |
| Lệch plan   | Gradient, header kính mờ                                                                      | Plan ghi gradient indigo→cyan và header làm mờ; skill thiết kế của dự án cấm cả hai nên bỏ. Màu indigo giữ vì là màu thương hiệu (đánh dấu `taste-skill-ignore`)    |
| Lệch plan   | Hoạt ảnh (bước 5)                                                                             | Gọn hơn dự kiến: hero hiện dần, hình thanh trượt vào, các ô/FAQ trượt lên khi cuộn (`animation-timeline: view()`); tắt khi giảm chuyển động                         |
| Lệch plan   | FAQ                                                                                           | Dùng `details/summary` thẻ đặc thay vì thẻ xếp chồng có tab cắt (đơn giản, truy cập tốt)                                                                            |

**Docs đã cập nhật:** `04-modules/02-web/landing.md`, README của web.

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md): ✅ Ranh giới (trang tĩnh, không API, không script ngoài; `scan:static` sạch) · n/a Hợp đồng · ✅ Kiến trúc (vẫn dùng chung `@cuelingo/ui`) · n/a AI · ✅ Test · ✅ Docs · ✅ Phạm vi

```bash
pnpm verify   # xanh: 213 file, 1643 test
```

**Đã chạy thật:** build `apps/site` và `apps/web` (`build:static` + `scan-out`: 160 file, không có gì nhạy cảm); bộ kiểm của skill (lint 0 lỗi; inspector trên bản production: lần chạy cuối còn 1 FAIL (tiêu đề ô Debrief 3 dòng ở 390 px), đã sửa nhưng chưa chạy lại inspector sau sửa) ở 1440, 768, 390; xem ảnh chụp hero, giai đoạn, bảng, quyền riêng tư, FAQ, chân trang ở desktop và điện thoại, chế độ tối.

**Chưa kiểm / còn cảnh báo (chấp nhận được hoặc để sau):**

- Chế độ sáng và 1024 px chỉ xem qua token, chưa mở ảnh chụp riêng; trang tải về chưa xem ảnh chụp riêng (dùng chung hero và thành phần).
- Inspector còn WARN: không có ảnh thật/video (không có clip trung thực phù hợp; hình là giao diện sản phẩm dựng bằng code), một khoảng trống 472 px ở gần chân trang desktop chưa xác định được vị trí (ảnh chụp không thấy khoảng trống), mục FAQ ở 768 px chỉ có tiêu đề bên trái.
- Số kích cỡ chữ vẫn nhiều hơn mức khuyến nghị (kích thước hiển thị theo `vw`).
- `pnpm docs:build` đã chạy, thành công; chưa kiểm trên Safari/WKWebView; chưa thử trên web đã deploy.
- Mảnh giao diện dùng chữ mẫu (câu tiếng Anh, "Họp kế hoạch ra mắt", cụm "align on"): chỉ minh hoạ, không phải dữ liệu thật. Cần chủ sản phẩm xác nhận.

## Cho người review — đọc theo thứ tự

| #   | File                                | Soi gì                                                |
| --- | ----------------------------------- | ----------------------------------------------------- |
| 1   | `landing-view.tsx`                  | Nội dung từng mục, đúng với `08-security-privacy.md`  |
| 2   | `landing.module.css`                | Token, sáng/tối, phone, không gradient/bóng/viền mảnh |
| 3   | `product-visuals.tsx`, `stages.tsx` | Chữ thay thế, bàn phím và nhãn của thanh trượt        |
| 4   | `landing-view.test.tsx`             | Danh sách cấm "bằng chứng bịa"                        |

## Lỗi tìm thấy khi review/test

- Lưới bảng chi tiết để ô trống do tự xếp → đặt vị trí tường minh.
- Tiêu đề kết dài 3 dòng, ô Debrief đè lên chữ → rút ngắn, tách bố cục.
- Test cũ bám câu chữ và class cũ → cập nhật.
- Bộ kiểm treo ở bản dev khi chụp ảnh → kiểm trên bản production.
