---
title: Admin · trợ lý AI
---

# Admin · trợ lý AI

> Code: `apps/web/src/features/admin/AdminAgentPage.tsx`, route `/admin/agent` · API: [admin](../03-api/admin.md) · Hồ sơ: [ai-agent](../../06-delivery/2026-11-05-ai-agent/02-plan.md)

Trang tối thiểu cho quản trị viên (`ADMIN_EMAILS`) bật/tắt trợ lý AI và từng plugin lúc chạy.

## Trách nhiệm

- Nút **Tắt trợ lý / Bật trợ lý**: công tắc toàn cục (`PATCH /v1/admin/agent {enabled}`). Nếu deploy đang tắt trợ lý (`available=false`) thì trang nói rõ công tắc chưa có tác dụng.
- Bảng plugin: `id` + phiên bản, công cụ, quyền, trạng thái bằng tiếng Việt (đang bật, đã tắt bởi admin, tự tắt do lỗi liên tiếp kèm giờ thử lại, lỗi khi nạp) và nút **Tắt/Bật** từng plugin. Plugin lỗi khi nạp không có nút.
- Người không phải admin nhận 404 (như `/admin/metrics`). Không có liên kết trong thanh bên.

## Interface

- Hook `useAdminAgent` đọc `client.admin.agent.get()` và gửi `client.admin.agent.update(...)`; câu trả lời của PATCH thay luôn trạng thái trong cache.
- Dùng `Button`, `Card`, `PageHeader`, `Section` của `@cuelingo/ui`.

## Phụ thuộc

- API admin agent, `@cuelingo/shared` (`AdminAgentStatus`), `@cuelingo/ui`.

## Dữ liệu & sự kiện

- Không lưu gì ở web. Công tắc nằm trong bộ nhớ API, khởi động lại thì về bật.

## Câu hỏi mở

- Chưa có.
