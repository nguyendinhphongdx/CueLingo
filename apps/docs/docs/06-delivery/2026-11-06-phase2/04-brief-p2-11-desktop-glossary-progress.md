---
title: Brief P2-11 · desktop Thuật ngữ + Tiến độ
---

# Brief — P2-11 · Trang Thuật ngữ và Tiến độ trong app desktop

> Nhánh `feat/p2-11-codex` · Worktree `.worktrees/p2-11-codex`

## Mục tiêu

Hai trang thật trong `apps/desktop/src/insights/` (thư mục riêng, khác brief P2-10), đăng ký bằng hai dòng trong `apps/desktop/src/app/views.ts` (khoá `glossary` và `progress`).

- **Thuật ngữ:** `GET/POST/PATCH/DELETE /v1/glossary` (xem `packages/shared/src/dto/glossary.dto.ts` và `apps/web/src/features/glossary` làm tham chiếu hành vi): danh sách, thêm (thuật ngữ + nghĩa tiếng Việt + ghi chú), sửa tại chỗ, xoá có xác nhận, tìm. Câu mở đầu giải thích "caption sẽ nghe và dịch đúng các từ này".
- **Tiến độ:** `GET /v1/progress` (`ProgressSchema`): các chỉ số (cụm đã lưu, đang ôn, đến hạn hôm nay, chuỗi ngày, số cuộc họp, % hiểu), biểu đồ cột 7 ngày ôn tập và biểu đồ 4 tuần "số lần tra từ mỗi cuộc họp" vẽ bằng SVG tự viết (có `aria-label` mô tả số liệu, không thêm thư viện). Màu chỉ trên dữ liệu, số lớn là chữ không phải thẻ có icon, trạng thái rỗng khi chưa có dữ liệu.
- Client riêng `insights/insights-api.ts` (cùng cách làm `quick-assist/assist-api.ts`).

## AC

| #   | AC (EARS)                                                                                      | Test           |
| --- | ---------------------------------------------------------------------------------------------- | -------------- |
| AC1 | WHEN mở Thuật ngữ THE SYSTEM SHALL liệt kê, cho thêm, sửa, xoá (có xác nhận) và tìm            | component test |
| AC2 | IF thuật ngữ trùng THEN hiện lỗi từ API bằng tiếng Việt                                        | test           |
| AC3 | WHEN mở Tiến độ THE SYSTEM SHALL hiện đủ chỉ số và hai biểu đồ có mô tả cho trình đọc màn hình | component test |
| AC4 | Dữ liệu rỗng (chưa có cuộc họp/ôn tập) hiện trạng thái rỗng, không biểu đồ trống trơn          | test           |
| AC5 | `tsc --noEmit` và `vitest` của desktop xanh                                                    | verify         |

## Phạm vi file

Được sửa/tạo: `apps/desktop/src/insights/**` (mới), `apps/desktop/src/app/views.ts` (chỉ thêm 2 dòng).

Quy tắc chung: đọc `AGENTS.md` gốc và của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`, và mục "Giai đoạn 2" trong `apps/docs/docs/02-product/06-backlog.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không sửa `packages/ui/src/lib/roadmap.ts`, `package.json`, `pnpm-lock.yaml` (lead sửa khi gộp). Thiết kế giao diện: dùng component của `@cuelingo/ui` và các skill thiết kế trong `.claude/skills/` (design-taste-frontend phần app screen, frontend-design): màu chỉ dành cho dữ liệu, không gradient, không thẻ icon giống nhau, nhãn câu thường. Chạy `pnpm verify` trước khi báo; điền mục Kết quả.

## Kết quả _(implementer điền)_
