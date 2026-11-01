---
title: Brief P2-13 · web trang chủ và trang tải app
---

# Brief — P2-13 · Trang giới thiệu và trang tải

> Nhánh `feat/p2-13-codex` · Worktree `.worktrees/p2-13-codex`

## Mục tiêu

Hai trang công khai trong `apps/web` (route group `(public)`, không dùng `AppFrame`), tiếng Việt:

- `/` (hiện chuyển hướng): khách chưa đăng nhập thấy **trang giới thiệu**; đã đăng nhập thì chuyển tới `/sessions`. Nội dung từ sản phẩm thật: tên "CueLingo", câu chính cho người đi làm đọc tiếng Anh tốt nhưng nghe kém ("nghe hiểu cuộc họp tiếng Anh ngay khi nó diễn ra"), một hình overlay caption **vẽ bằng HTML/CSS** đúng như overlay thật (khối "Họ", câu tiếng Anh nhạt, bản dịch tiếng Việt đậm), ba việc app làm (caption song ngữ khi họp; tra từ, tóm tắt và soạn câu ngay trong họp; debrief sau họp và ôn cụm từ từ chính cuộc họp), phần quyền riêng tư (nhận dạng giọng nói chạy trên máy, chỉ văn bản được gửi đi dịch, xoá dữ liệu bất cứ lúc nào), và một nút hành động chính "Tải cho macOS" dẫn tới `/download` cùng liên kết "Đăng nhập". Không tạo số liệu, lời chứng thực, logo khách hàng hay đánh giá giả.
- `/download`: yêu cầu macOS 14.2 trở lên, các bước cài (kéo vào Applications, mở lần đầu, cấp quyền micro và ghi âm hệ thống, vào Cài đặt hệ thống chỗ nào), khối xử lý sự cố ngắn, nút tải **vô hiệu có nhãn "Sắp có bản tải"** cho tới khi có bản phát hành (đọc URL tải từ `NEXT_PUBLIC_DOWNLOAD_URL`; có thì nút hoạt động).
- Làm theo kỹ năng thiết kế trong `.claude/skills/design-taste-frontend` (đọc kỹ cả luật cho trang): một ý tưởng lấy từ chính sản phẩm (overlay caption), kiểu chữ lớn, ít thẻ, không gradient, không icon trong ô màu, không nhãn in hoa, mỗi mục có tiêu đề, margin đều hai bên, responsive 390/768/1440. Dùng token thương hiệu của `@cuelingo/ui` (`brand.css`) và chế độ tối.
- Không dùng mạng để tìm ảnh; vẽ mọi minh hoạ bằng HTML/CSS/SVG từ đối tượng của sản phẩm.

## AC

| #   | AC (EARS)                                                                                                                   | Test            |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --------------- |
| AC1 | WHEN khách chưa đăng nhập mở `/` THE SYSTEM SHALL hiện trang giới thiệu với `h1`, nút "Tải cho macOS" và liên kết đăng nhập | component test  |
| AC2 | WHEN đã đăng nhập mở `/` THE SYSTEM SHALL chuyển tới `/sessions`                                                            | test            |
| AC3 | `/download` hiện yêu cầu hệ thống, các bước cài và nút tải vô hiệu khi chưa có URL                                          | test            |
| AC4 | Trang đọc được ở 390px không cuộn ngang; mọi nút ≥ 44px; có trạng thái focus                                                | test + kiểm tay |
| AC5 | `pnpm verify` và `pnpm --filter @cuelingo/web build` xanh                                                                   | build           |

## Phạm vi file

Được sửa/tạo: `apps/web/src/app/(public)/**`, `apps/web/src/app/page.tsx`, `apps/web/src/features/landing/**` (mới), middleware/redirect cần thiết trong `apps/web`. Không sửa `apps/desktop`, `services`, `packages`.

Quy tắc chung: đọc `AGENTS.md` gốc và của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`, và mục "Giai đoạn 2" trong `apps/docs/docs/02-product/06-backlog.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không sửa `packages/ui/src/lib/roadmap.ts`, `package.json`, `pnpm-lock.yaml` (lead sửa khi gộp). Thiết kế giao diện: dùng component của `@cuelingo/ui` và các skill thiết kế trong `.claude/skills/` (design-taste-frontend phần app screen, frontend-design): màu chỉ dành cho dữ liệu, không gradient, không thẻ icon giống nhau, nhãn câu thường. Chạy `pnpm verify` trước khi báo; điền mục Kết quả.

## Kết quả _(implementer điền)_
