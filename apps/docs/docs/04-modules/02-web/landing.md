# Landing và trang tải về

> Phần: [Web app](./README.md) · Code: `packages/ui/src/components/landing/` · Hồ sơ: [landing-redesign](../../06-delivery/2026-11-08-landing-redesign/02-plan.md) · Dùng bởi: `apps/web/src/features/landing`, `apps/site/src/pages.tsx`

Hai trang công khai (`/` và `/download`) nằm trong gói dùng chung `@cuelingo/ui`. Web (Cloudflare Pages) và site GitHub Pages chỉ bọc chúng và truyền `link` (router) cùng `paths` (đường dẫn), nên sửa một nơi là cả hai đổi. Trang tĩnh, không gọi API.

## Cấu trúc

| Tệp                   | Việc                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `landing-view.tsx`    | Trang chủ: hero, giai đoạn (thanh trượt), bảng chi tiết, quyền riêng tư, FAQ, kết, chân trang |
| `download-page.tsx`   | Trang tải về cùng ngôn ngữ thiết kế                                                           |
| `product-visuals.tsx` | Các mảnh giao diện sản phẩm dựng bằng HTML (caption, tra từ, trợ lý, ôn tập, debrief)         |
| `stages.tsx`          | Thanh trượt bốn giai đoạn (`'use client'`)                                                    |
| `landing.module.css`  | Token và kiểu của hai trang, sáng/tối theo hệ thống                                           |

## Nguyên tắc thiết kế

- **Một motif:** hai dòng caption trong logo (thanh dài trên thanh ngắn, đầu tròn) là hình ở hero, hình nút, dấu đầu dòng FAQ và dải quyền riêng tư. Một vai: nền, mực, màu nhấn indigo của thương hiệu; màu hổ phách của logo chỉ cho dòng ngắn.
- **Hình sản phẩm dựng bằng code**, gốc `data-ui`, có chữ thay thế; không ảnh bitmap, không phông tải thêm (phông hệ thống), không script bên ngoài.
- **Không bịa bằng chứng:** không số liệu, logo khách hàng, lời chứng thực. Test `landing-view.test.tsx` chặn các chuỗi dạng đó. Nội dung quyền riêng tư phải khớp [bảo mật & quyền riêng tư](../../03-architecture/08-security-privacy.md).
- Không gradient, không kính mờ, không bóng khi nghỉ (theo skill thiết kế của dự án). Chuyển động chỉ dùng `transform`/`opacity` và tắt khi bật giảm chuyển động.
- Thêm bản dịch hay ảnh thật sau: thay các mảnh trong `product-visuals.tsx`; chỗ đặt hình đã cố định kích thước.

## Kiểm

`pnpm verify`; build `apps/site` (`pnpm --filter @cuelingo/site build`) và `apps/web` (`build:static` + `scan:static`); mở ở 375/768/1024/1440, sáng và tối.
