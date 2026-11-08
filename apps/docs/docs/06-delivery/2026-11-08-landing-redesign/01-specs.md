# landing-redesign — Landing page và trang tải về trông như sản phẩm doanh nghiệp

| Trạng thái | Loại    | Nhánh / PR                     | Ước lượng → thực tế |
| ---------- | ------- | ------------------------------ | ------------------- |
| Spec       | feature | `feat/landing-redesign` / _PR_ | _1–2 ngày → ?_      |

**Phạm vi:** trong: thiết kế lại landing page (`/`) và trang tải về (`/download`) ở gói dùng chung `@cuelingo/ui` (web Cloudflare Pages và site GitHub Pages cùng đổi), hình giao diện sản phẩm dựng bằng code, hệ chữ, màu, khoảng cách, bóng đổ, hoạt ảnh nhẹ, bản sáng/tối, bản điện thoại · ngoài: nội dung các màn trong app, trang đăng nhập, bảng giá, blog, video demo thật, số liệu hay lời chứng thực (chưa có thì không bịa), đổi tên thương hiệu hay logo.

## 1. Vấn đề

Chủ sản phẩm đánh giá landing page hiện tại **không giống các sản phẩm doanh nghiệp** (Figma, Stripe). Người ngoài vào đây để quyết định có tải CueLingo và đưa tên miền công việc của họ vào hay không, nên trang phải gây được cảm giác đáng tin ngay màn hình đầu.

Quan sát trang đang chạy (`cuelingo.tutorial-aws.com`, cửa sổ 1440×900):

- Màn hình đầu chỉ có tiêu đề và đoạn chữ ở bên trái; bên phải là khối màu phẳng mô phỏng thẻ caption, **không cho thấy sản phẩm thật** là gì.
- Hệ chữ và nhịp trình bày rời rạc: mô tả nhỏ so với tiêu đề lớn, tiêu đề mục và mô tả của mục nằm hai đầu dòng nên mắt phải nhảy xa; các nút nhỏ và chưa nổi.
- Màu và chi tiết thô: nền gần đen cộng một màu tím đậm không có chiều sâu (không viền sáng, bóng đổ, lớp), một khối tím lớn lấn bố cục.
- Chưa có chỗ nào cho thấy sản phẩm chạy thật, cũng chưa trả lời câu hỏi doanh nghiệp hay hỏi: dữ liệu cuộc họp đi đâu, ai thấy, xoá thế nào.
- Mô tả mục dài, nhỏ, ít phân cấp; ba khả năng nằm trong ba khối giống hệt nhau.

Người bị ảnh hưởng: người thử bên ngoài (tải về, đăng ký), và chủ sản phẩm khi giới thiệu sản phẩm.

- **Spec liên quan:** `02-product/03-mvp-scope.md`, `04-modules/02-web/README.md`, `03-architecture/08-security-privacy.md` (nội dung về quyền riêng tư phải khớp thực tế), `06-delivery/2026-11-07-pages-landing/`
- **Module chạm tới:** `packages/ui/src/components/landing/*` (landing, trang tải về, header, caption overlay, CSS), `apps/web`, `apps/site`

## 2. Tiêu chí chấp nhận (EARS)

| #    | AC                                                                                                                                                                                                                                              | Test                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| AC1  | WHEN trang chủ mở ở cỡ desktop THE SYSTEM SHALL cho thấy trong màn hình đầu: tiêu đề (≤ 2 dòng), một câu mô tả, một nút chính và **hình giao diện app thật dựng bằng code** (caption song ngữ, thanh trạng thái), không dùng khối màu thay hình | kiểm bằng ảnh chụp ở 1440×900 + test cấu trúc                   |
| AC2  | THE SYSTEM SHALL dùng một hệ chữ, một thang khoảng cách và một bộ màu (token) cho mọi phần; mỗi mục có một ý chính và một hình hoặc minh hoạ, không lặp ba khối giống hệt                                                                       | rà soát + test cấu trúc                                         |
| AC3  | THE SYSTEM SHALL có đủ các mục: sản phẩm làm gì và cho ai, cách hoạt động từ lúc họp đến lúc ôn, quyền riêng tư và dữ liệu (đúng với hệ thống thật), cách tải, câu hỏi thường gặp, chân trang                                                   | test cấu trúc + đối chiếu `08-security-privacy.md`              |
| AC4  | THE SYSTEM SHALL không chứa số liệu, logo khách hàng, lời chứng thực hay tính năng chưa có thật                                                                                                                                                 | rà soát nội dung, danh sách trong `03-review.md`                |
| AC5  | WHEN mở ở 375, 768, 1024, 1440 px THE SYSTEM SHALL không cuộn ngang, chữ thân bài ≥ 16 px, vùng chạm ≥ 44 px, bố cục xếp lại có chủ ý                                                                                                           | kiểm trình duyệt ở bốn cỡ                                       |
| AC6  | THE SYSTEM SHALL đạt tương phản chữ ≥ 4,5:1, có vòng focus thấy được, điều hướng bằng bàn phím, nhãn cho biểu tượng, và tôn trọng `prefers-reduced-motion`                                                                                      | test a11y trong CI + kiểm tay                                   |
| AC7  | THE SYSTEM SHALL hỗ trợ giao diện sáng và tối theo hệ thống                                                                                                                                                                                     | kiểm trình duyệt hai chế độ                                     |
| AC8  | THE SYSTEM SHALL vẫn dùng chung `@cuelingo/ui` cho web và site GitHub Pages, không sao chép mã, và hai nơi build xanh                                                                                                                           | `pnpm verify`, build `apps/web` và `apps/site`                  |
| AC9  | THE SYSTEM SHALL có trang tải về cùng ngôn ngữ thiết kế: yêu cầu hệ thống, các bước cài (kể cả mở app ký ad-hoc lần đầu), nút tải hoặc "Sắp có bản tải" khi chưa có link                                                                        | test `download-page.test.tsx` + kiểm trình duyệt                |
| AC10 | THE SYSTEM SHALL tải nhanh: không thêm thư viện nặng, không ảnh bitmap lớn, trang chủ tĩnh không gọi API                                                                                                                                        | kiểm kích thước bản build, mạng không có request ngoài tên miền |
| AC11 | THE SYSTEM SHALL không thêm dấu vết theo dõi hay script bên ngoài; phông chữ tự lưu hoặc phông hệ thống                                                                                                                                         | kiểm mạng + `scan-out` / `scan-dist`                            |

## 3. Câu hỏi mở

- [ ] Hướng thẩm mỹ: **tối, tinh, nhiều chiều sâu** (kiểu Linear/Vercel) hay **sáng, thoáng, nhiều khoảng trắng** (kiểu Stripe/Figma)? Đề xuất: mặc định sáng, có chế độ tối, màu nhấn là gradient indigo→cyan của thương hiệu, dùng tiết chế.
- [ ] Giữ tên thương hiệu và logo hiện tại, hay có tài sản thiết kế mới (logo, phông)?
- [ ] Hình sản phẩm: dựng giao diện caption bằng code (đề xuất, nhẹ, luôn đúng), hay có ảnh chụp/video màn hình thật để chèn?
- [ ] Có mục "dành cho doanh nghiệp" hay chỉ nói tới cá nhân người đi làm trong giai đoạn beta? (chưa có bảng giá, SSO)
- [ ] Có cần bản tiếng Anh của trang không, hay chỉ tiếng Việt như hiện tại?
- [ ] Giữ ba khả năng chính hiện tại, hay đổi lại thứ tự ưu tiên thông điệp?
- [ ] Các câu hỏi thường gặp muốn nêu (dữ liệu, giá, ngôn ngữ hỗ trợ, macOS mấy trở lên)?

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                           |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------- |
| 2026-11-08 | Spec | Mở hồ sơ theo phản hồi của chủ sản phẩm: landing hiện tại chưa giống sản phẩm doanh nghiệp. Chưa sửa mã |
