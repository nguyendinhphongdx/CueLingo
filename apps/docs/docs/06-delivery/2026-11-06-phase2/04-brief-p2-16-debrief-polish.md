---
title: Brief P2-16 · hoàn thiện debrief
---

# Brief — P2-16 · Debrief dễ dùng hơn

> Nhánh `feat/p2-16-codex` · Worktree `.worktrees/p2-16-codex`

## Mục tiêu

Trang debrief của web (`apps/web/src/features/debrief/`) hiện đủ 5 khối nhưng còn thô. Làm:

1. **Đoạn khó dẫn tới đúng câu:** bấm một đoạn khó trong khối "Đoạn khó" thì cuộn tới câu đó trong transcript và nháy nền nhẹ 1,5 s (tôn trọng `prefers-reduced-motion`); transcript có `id` theo segment.
2. **Lọc transcript** theo người nói: "Tất cả / Họ / Tôi" (Segmented); đếm số câu mỗi nhóm.
3. **Sao chép:** nút sao chép ở từng khối (tóm tắt, việc cần làm, cụm từ, câu gợi ý) và "Sao chép cả debrief"; báo "Đã sao chép" trong 2 s.
4. **Tải Markdown cả cuộc họp:** hiện nút xuất chỉ có debrief; thêm tuỳ chọn "kèm transcript song ngữ" (thời gian mm:ss + Họ/Tôi + EN + VI). Hàm dựng Markdown là hàm thuần, có test.
5. **Trạng thái đang tạo debrief** rõ hơn: hiện thời gian đã chờ ("Đang tạo… 12 s"), sau 90 s đổi thành "Lâu hơn bình thường, bạn có thể quay lại sau" kèm nút thử lại; thất bại 404 lâu thì không quay vòng vô hạn.
6. Phím tắt: `j/k` đi giữa các khối, `c` sao chép khối đang chọn (chỉ khi không đang gõ).
7. Giữ nguyên đủ chức năng đang có (phản hồi 👍/👎, lưu cụm từ, xoá cuộc họp).

## AC

| #   | AC (EARS)                                                                                                   | Test                 |
| --- | ----------------------------------------------------------------------------------------------------------- | -------------------- |
| AC1 | WHEN bấm một đoạn khó THE SYSTEM SHALL cuộn tới câu tương ứng và đánh dấu nó                                | component test       |
| AC2 | Lọc "Tôi" chỉ còn câu `mic`; đếm đúng                                                                       | test                 |
| AC3 | Sao chép gọi `navigator.clipboard.writeText` với nội dung đúng và hiện xác nhận; clipboard bị chặn hiện lỗi | test                 |
| AC4 | Hàm dựng Markdown có/không transcript cho đúng định dạng và thứ tự thời gian                                | unit test            |
| AC5 | Chờ debrief > 90 s hiện thông báo lâu hơn bình thường và nút thử lại                                        | test với fake timers |
| AC6 | `pnpm --filter @cuelingo/web build` xanh                                                                    | build                |

## Phạm vi file

Được sửa/tạo: `apps/web/src/features/debrief/**`, `apps/web/src/app/(app)/sessions/**` nếu cần. Không sửa API, `packages/**`, desktop.

Quy tắc chung: đọc `AGENTS.md` gốc và của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`, mục "Giai đoạn 2" trong `apps/docs/docs/02-product/06-backlog.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không sửa `packages/ui/src/lib/roadmap.ts`, `package.json`, `pnpm-lock.yaml` (lead sửa khi gộp). Giao diện: dùng `@cuelingo/ui` và các skill thiết kế trong `.claude/skills/` (màu chỉ cho dữ liệu, không gradient, không thẻ icon giống nhau, nhãn câu thường, chữ trong app nhỏ và gọn). Mọi chuỗi giao diện tiếng Việt. Chạy `pnpm verify` trước khi báo; điền mục Kết quả, nêu rõ cái gì chưa kiểm được.

## Kết quả _(implementer điền)_
