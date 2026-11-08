# Plan — landing-redesign

## 1. Bối cảnh code

- Landing và trang tải về nằm ở **`packages/ui/src/components/landing/`**: `landing-view.tsx` (130 dòng), `download-page.tsx`, `public-header.tsx`, `caption-overlay.tsx` (minh hoạ caption chỉ là ba dòng chữ trong khung), `landing.module.css` (665 dòng, một tệp CSS module cho cả hai trang). Web (`apps/web/src/features/landing`) và site GitHub Pages (`apps/site/src/pages.tsx`) chỉ bọc các thành phần này và truyền `link` + `paths`, nên **sửa một nơi là cả hai đổi** (AC8).
- Token màu nằm ở `packages/ui/src/styles/brand.css` (indigo `#4f46e5`, nền hơi lạnh, có `.dark`). CSS landing hiện dùng `--brand`, vài màu cứng (`#0f172a`, `#334155`) và `color-mix`. Chủ đề sáng/tối đi theo class `.dark` do app đặt, trang công khai chưa theo `prefers-color-scheme` rõ ràng.
- Trang tĩnh, không gọi API (đã xác nhận ở dossier web-cloudflare); có test `download-page.test.tsx` và quét `scan-out` / `scan-dist` chặn chuỗi nhạy cảm.
- Nội dung quyền riêng tư hiện có (tiếng Anh nhận dạng trên máy, Nhật/Hàn/Trung/Việt trên đám mây khi người dùng đồng ý, xoá dữ liệu bất cứ lúc nào) phải giữ đúng theo `08-security-privacy.md`.

## 2. Phương án

| #   | Phương án                                                                                                                                                                                                                      | Ưu                                                                                                                             | Nhược                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| A   | **Viết lại tại chỗ** trong `packages/ui/.../landing/`: tầng token riêng cho landing (chữ, khoảng cách, bóng, gradient, sáng/tối), bộ minh hoạ sản phẩm dựng bằng code, các mục mới, giữ CSS module và giao diện `link`/`paths` | Một nơi cho web và site; không thêm thư viện; hình luôn đúng với app vì dựng từ cùng token; đổi nhỏ ở hai app gần như không có | Tốn công thiết kế từng minh hoạ; CSS lớn hơn (kiểm tra kích thước)                               |
| B   | Dựng landing riêng trong `apps/site` (Vite + Tailwind) rồi web import lại                                                                                                                                                      | Tự do hơn về công cụ                                                                                                           | Đảo chiều phụ thuộc (web phụ thuộc site), trái quy tắc "client dùng lại `@cuelingo/ui`", dễ lệch |
| C   | Dùng ảnh chụp / video màn hình thật làm hình                                                                                                                                                                                   | Chân thực nhất                                                                                                                 | Cần tài sản chưa có, nặng, lỗi thời khi app đổi, cần bản sáng và tối riêng                       |

**Chọn: A.** Hình sản phẩm dựng bằng code (nhẹ, sắc nét mọi cỡ màn hình, theo sáng/tối, không phải chụp lại khi app đổi). C dành cho sau khi có ảnh thật; chỗ đặt hình đã thiết kế để thay được.

**Mặc định cho câu hỏi mở của SPEC** (chưa có câu trả lời; sửa được ở cổng này):

1. Hướng thẩm mỹ: **sáng, thoáng, nhiều khoảng trắng** kiểu Stripe/Figma; theo chế độ hệ thống thì chuyển sang tối tinh (nền xanh-đen, viền sáng mảnh). Gradient indigo→cyan chỉ dùng cho một điểm nhấn mỗi màn hình.
2. Giữ tên và logo hiện tại; phông là **phông hệ thống** (SF Pro trên macOS) để không thêm tệp phông (AC10, AC11).
3. Hình sản phẩm dựng bằng code; tiếng Việt là ngôn ngữ duy nhất.
4. Không có mục "dành cho doanh nghiệp" (chưa có giá, SSO). Thay vào đó là mục **Quyền riêng tư và dữ liệu** nêu cụ thể và trung thực, giúp người đi làm yên tâm.
5. Thông điệp: nghe hiểu cuộc họp (caption song ngữ) → hỏi ngay trong họp → biến cuộc họp thành bài học. Câu hỏi thường gặp: dữ liệu đi đâu, ngôn ngữ nào hỗ trợ, cần macOS mấy, giá, xoá dữ liệu, vì sao app chưa được Apple công chứng.

| Tác động                            | Có?   | Chi tiết                                                                                                                              |
| ----------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| DB migration                        | Không |                                                                                                                                       |
| Contract (`@cuelingo/shared`)       | Không |                                                                                                                                       |
| Event / Learner Model               | Không |                                                                                                                                       |
| Prompt / model AI                   | Không |                                                                                                                                       |
| Quyền riêng tư / dữ liệu người dùng | Có    | Chỉ **nội dung giới thiệu**: câu chữ về dữ liệu phải khớp `08-security-privacy.md`; không script theo dõi, không tải tài nguyên ngoài |

## 3. Các bước (mỗi bước ≈ 1 commit)

| #   | Bước                                                                                                                                                                                                                                                                                                                                                                                 | File                                                                                 | Điểm mở rộng |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------ |
| 1   | **Nền tảng thiết kế:** tầng token landing (thang chữ, khoảng cách, bán kính, bóng, gradient điểm nhấn, sáng/tối theo `prefers-color-scheme` và `.dark`), vùng chứa và lưới, nút chính/phụ, header dính có làm mờ nền; thay các màu cứng (AC2, AC6, AC7)                                                                                                                              | `landing.module.css` (tách `landing-tokens.module.css` nếu cần), `public-header.tsx` | UI           |
| 2   | **Minh hoạ sản phẩm bằng code:** cửa sổ cuộc họp + overlay caption song ngữ có nhãn người nói, chip ngôn ngữ, thanh trạng thái; thẻ debrief; thẻ ôn tập cụm từ. Văn bản thay thế mô tả đúng nội dung; trang trí `aria-hidden` (AC1, AC6)                                                                                                                                             | `caption-overlay.tsx` → `product-visuals.tsx`, test                                  | UI           |
| 3   | **Trang chủ mới:** hero (tiêu đề ≤ 2 dòng, một câu, nút chính + phụ, hình sản phẩm), cách hoạt động (3 bước, mỗi bước một hình), quyền riêng tư và dữ liệu (sơ đồ luồng + cam kết cụ thể), học từ cuộc họp, câu hỏi thường gặp (`details/summary`), lời kêu gọi cuối, chân trang; copy deck tiếng Việt; test cấu trúc và danh sách cấm (không số liệu/logo/lời chứng thực) (AC1–AC4) | `landing-view.tsx`, `landing-copy.ts`, `landing-view.test.tsx`                       | UI           |
| 4   | **Trang tải về** cùng ngôn ngữ thiết kế: hero với nút tải hoặc "Sắp có bản tải", yêu cầu hệ thống dạng thẻ, các bước cài (có bước mở app ký ad-hoc) dạng danh sách đánh số rõ ràng, cập nhật, xử lý sự cố; giữ test hiện có (AC9)                                                                                                                                                    | `download-page.tsx`, `download-page.test.tsx`                                        | UI           |
| 5   | **Hoạt ảnh nhẹ** (hiện dần khi cuộn, caption "gõ" trong hero) chỉ dùng `transform`/`opacity`, tắt khi `prefers-reduced-motion`; không thư viện (AC6, AC10)                                                                                                                                                                                                                           | `landing.module.css`, hook nhỏ nếu cần                                               | UI           |
| 6   | **Kiểm chạy thật:** mở trang ở 375/768/1024/1440, sáng và tối, không cuộn ngang, tương phản, bàn phím, giảm chuyển động; build `apps/web` (`build:static`) và `apps/site`; so kích thước bản build; quét mạng không có request ngoài; `pnpm verify`; điền `03-review.md` kèm ảnh chụp (AC5–AC8, AC10, AC11)                                                                          | `03-review.md`                                                                       | —            |
| 7   | **Docs:** cập nhật trang module web/UI về landing, ghi nguyên tắc thiết kế (token, minh hoạ bằng code, không bịa bằng chứng); `pnpm docs:build`                                                                                                                                                                                                                                      | `apps/docs/docs/04-modules/02-web/**`                                                | Docs         |

Tôi sẽ dùng skill `design-taste-frontend` và `emil-design-eng` ở bước 1–5 để chọn hướng, chữ, màu và chi tiết; mỗi bước kiểm bằng ảnh chụp trước khi sang bước sau.

## 4. Rủi ro

| Rủi ro                                                                | Giảm thiểu                                                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| "Đẹp" mang tính chủ quan, làm xong vẫn bị chê                         | Chốt hướng ở cổng này; sau bước 3 chụp ảnh gửi bạn xem **trước** khi làm trang tải về và hoạt ảnh          |
| Bịa bằng chứng cho đẹp (số liệu, logo, lời chứng thực)                | AC4 + danh sách cấm có test; nội dung dựa trên tính năng và quyền riêng tư thật                            |
| Lời nói về quyền riêng tư lệch thực tế                                | Đối chiếu từng câu với `08-security-privacy.md` ở bước 3 và ghi vào review                                 |
| CSS phình, tải chậm                                                   | Không thư viện, không ảnh bitmap lớn, đo kích thước bản build trước/sau (AC10)                             |
| Hai nơi (web, site) lệch hoặc vỡ khi chỉ kiểm một nơi                 | Bước 6 build và mở cả hai                                                                                  |
| Tối/sáng làm vỡ tương phản                                            | Dùng token, kiểm tương phản từng cặp ở hai chế độ                                                          |
| Chưa có ảnh/video thật nên hình dựng bằng code có thể thiếu chân thực | Dựng theo đúng giao diện app thật (cùng token, cùng bố cục); khung hình thiết kế để thay bằng ảnh thật sau |

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                        |
| ---------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-08 | Plan | Trình phương án A (viết lại tại chỗ, minh hoạ bằng code); B loại vì đảo chiều phụ thuộc, C để dành khi có ảnh thật. Câu hỏi mở dùng mặc định đề xuất |
