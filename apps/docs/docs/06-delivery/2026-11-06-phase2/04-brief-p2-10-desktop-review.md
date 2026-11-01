---
title: Brief P2-10 · desktop Ôn tập + Cụm từ
---

# Brief — P2-10 · Trang Ôn tập và Cụm từ trong app desktop

> Nhánh `feat/p2-10-codex` · Worktree `.worktrees/p2-10-codex`

## Mục tiêu

Hai trang thật trong `apps/desktop/src/study/` thay cho "Sắp ra mắt", đăng ký bằng hai dòng trong `apps/desktop/src/app/views.ts` (khoá `review` và `phrases`).

- **Ôn tập:** lấy `GET /v1/review/queue`, mỗi thẻ một màn hình, dạng **recognize** (chọn nghĩa) và **cloze** (điền chỗ trống), phím 1–4 chọn đáp án, Enter sang thẻ; sau khi chọn hiện đáp án đúng, `meaningVi`, `contextEn`, rồi bốn mức tự chấm "Lại / Khó / Được / Dễ" (gợi ý sẵn theo đúng/sai) gửi `POST /v1/review/answer` kèm `responseMs`. Thanh tiến độ "3/10", màn tổng kết (đúng/sai, còn bao nhiêu thẻ đến hạn, nút "Ôn tiếp"), trạng thái rỗng khuyến khích đi họp. Xem trang web `apps/web/src/features/review` làm tham chiếu hành vi (không import từ web).
- **Cụm từ:** `GET /v1/phrases` liệt kê (cụm, nghĩa, trạng thái "đang ôn"), xoá bằng `DELETE /v1/phrases/:id` có xác nhận, ô tìm trong danh sách, trạng thái rỗng.
- Một client duy nhất `study/study-api.ts` giống `quick-assist/assist-api.ts`: `VITE_API_URL`, `Authorization: Bearer ${VITE_REALTIME_TOKEN}`, parse bằng schema `@cuelingo/shared` (`ReviewQueueSchema`, `ReviewAnswerRequestSchema`, `PhraseListSchema`…). Dùng `@tanstack/react-query` đã có.
- Cửa sổ desktop không cuộn thanh bên; chỉ nội dung cuộn (khung `AppFrame` đã lo). Màn hình ôn đặt thẻ ở giữa, tối đa 560px.

## AC

| #   | AC (EARS)                                                                                           | Test           |
| --- | --------------------------------------------------------------------------------------------------- | -------------- |
| AC1 | WHEN có thẻ đến hạn THE SYSTEM SHALL hiện từng thẻ, chấm đáp án đúng/sai cục bộ và cho chấm bốn mức | component test |
| AC2 | WHEN chấm THE SYSTEM SHALL gọi `/v1/review/answer` đúng một lần rồi sang thẻ kế                     | test           |
| AC3 | WHEN hết thẻ THE SYSTEM SHALL hiện tổng kết và nút "Ôn tiếp" nếu còn thẻ đến hạn                    | test           |
| AC4 | Hàng đợi rỗng và danh sách cụm từ rỗng có trạng thái rỗng tiếng Việt                                | test           |
| AC5 | Xoá cụm từ cần xác nhận, lỗi mạng hiện thông báo có nút thử lại                                     | test           |
| AC6 | `tsc --noEmit` và `vitest` của desktop xanh; không đổi Rust                                         | verify         |

## Phạm vi file

Được sửa/tạo: `apps/desktop/src/study/**` (mới), `apps/desktop/src/app/views.ts` (chỉ thêm 2 dòng). Không sửa nơi khác.

Quy tắc chung: đọc `AGENTS.md` gốc và của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`, và mục "Giai đoạn 2" trong `apps/docs/docs/02-product/06-backlog.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không sửa `packages/ui/src/lib/roadmap.ts`, `package.json`, `pnpm-lock.yaml` (lead sửa khi gộp). Thiết kế giao diện: dùng component của `@cuelingo/ui` và các skill thiết kế trong `.claude/skills/` (design-taste-frontend phần app screen, frontend-design): màu chỉ dành cho dữ liệu, không gradient, không thẻ icon giống nhau, nhãn câu thường. Chạy `pnpm verify` trước khi báo; điền mục Kết quả.

## Kết quả _(implementer điền)_
