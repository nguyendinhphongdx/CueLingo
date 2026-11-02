---
title: Brief P2-20 · quan sát và số liệu nội bộ
---

# Brief — P2-20 · Log có cấu trúc, chi phí AI và trang số liệu nội bộ

> Nhánh `feat/p2-20-codex` · Worktree `.worktrees/p2-20-codex`

## Mục tiêu

1. **Request id:** API gán `x-request-id` cho mỗi request (nhận từ client nếu hợp lệ, chuỗi ≤ 64 ký tự an toàn, ngược lại sinh mới), trả lại trong header phản hồi và có trong mọi dòng log của request và trong body lỗi (`error.requestId`; cập nhật `ErrorResponseSchema` nếu cần, phần tử tuỳ chọn). **Không bao giờ log nội dung body, token, email, hay nội dung câu họp.** Test chứng minh header `Authorization` và body không xuất hiện trong log (cấu hình `redact` của Fastify logger).
2. **Chi phí AI:** `AiCallRecord` của `ai-gateway` (có `inputTokens`, `outputTokens`, `model`, `task`) → bảng giá theo model đặt trong `packages/ai-gateway/src/pricing.ts` (USD / 1M token, ghi rõ nguồn và ngày; model lạ thì chi phí null) → hàm thuần `estimateCostUsd(record)` có test. API và worker ghi mỗi lời gọi thành một dòng `events` (`type='ai_call'`, `user_id` khi biết, `session_id` khi biết, `cost_usd`, `latency_ms`, `payload={task, model, fallback, ok}`) qua một hook `onCall` không chặn (lỗi ghi không làm hỏng request); cộng dồn vào `sessions.cost_usd` cho cuộc họp liên quan nếu có `session_id`.
3. **Số liệu nội bộ:** `GET /v1/admin/metrics` chỉ cho email nằm trong biến môi trường `ADMIN_EMAILS` (phẩy ngăn cách, so khớp không phân biệt hoa thường; thiếu biến thì mọi người 403). Trả: số người dùng hoạt động 7 ngày; số cuộc họp và tổng giờ họp 7/30 ngày; thời gian từ kết thúc họp tới có debrief (trung vị và p95); chi phí AI trung bình mỗi giờ họp (USD); số phiên ôn mỗi ngày 14 ngày; tỉ lệ cuộc họp có debrief thành công. Schema Zod `AdminMetricsSchema` trong `packages/shared/src/dto/admin.dto.ts` (thêm file và một dòng export). Truy vấn tổng hợp trên toàn bảng nhưng **không trả thông tin định danh** (không email, không nội dung).
4. **Web:** trang `/admin/metrics` (route group riêng, chỉ hiện với người được phép; người khác thấy 404) với các chỉ số dạng chữ lớn, bảng nhỏ 14 ngày, không biểu đồ màu mè. Không thêm vào thanh bên.
5. Tài liệu: `apps/docs/docs/05-engineering/observability.md` ngắn, cách đọc log theo request id, cách đặt `ADMIN_EMAILS`.

## AC

| #   | AC (EARS)                                                                                                                  | Test                          |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| AC1 | Mọi phản hồi có `x-request-id`; id hợp lệ từ client được giữ, id xấu bị thay                                               | `app.test.ts`                 |
| AC2 | Log không chứa header Authorization, body, email                                                                           | test bắt log                  |
| AC3 | `estimateCostUsd` đúng với model có giá và null với model lạ                                                               | unit test                     |
| AC4 | Lời gọi AI ghi một dòng `ai_call` và cộng `cost_usd` vào cuộc họp; lỗi ghi không ném                                       | test + `ai-calls.int.test.ts` |
| AC5 | `/v1/admin/metrics` 403 với người không nằm trong `ADMIN_EMAILS`, 200 với người nằm trong; kết quả không có email/nội dung | test                          |
| AC6 | Trang `/admin/metrics` hiện số liệu cho admin và 404 cho người khác                                                        | component test                |

## Phạm vi file

Được sửa/tạo: `services/api/**` (module `admin`, `app.ts`, `server.ts`, `lib/`), `services/workers/**` (chỉ phần ghi `ai_call`), `packages/ai-gateway/src/pricing.ts` (+ test, export), `packages/shared/src/dto/admin.dto.ts` + một dòng export, `apps/web/src/app/admin/**` và `apps/web/src/features/admin/**`, `.env.example` (`ADMIN_EMAILS`), doc. Không sửa desktop.

Quy tắc chung: đọc `AGENTS.md` gốc và của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`, mục "Giai đoạn 2" trong `apps/docs/docs/02-product/06-backlog.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không sửa `packages/ui/src/lib/roadmap.ts`, `package.json`, `pnpm-lock.yaml` (lead sửa khi gộp). Giao diện: dùng `@cuelingo/ui` và các skill thiết kế trong `.claude/skills/` (màu chỉ cho dữ liệu, không gradient, không thẻ icon giống nhau, nhãn câu thường, chữ trong app nhỏ và gọn). Mọi chuỗi giao diện tiếng Việt. Chạy `pnpm verify` trước khi báo; điền mục Kết quả, nêu rõ cái gì chưa kiểm được.

## Kết quả _(implementer điền)_
