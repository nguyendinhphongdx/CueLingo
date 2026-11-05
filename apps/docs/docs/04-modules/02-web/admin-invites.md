---
title: Admin · mã mời
---

# Admin · mã mời

> Code: `apps/web/src/features/invites/`, route `/admin/invites` · API: [invites](../03-api/invites.md)

Trang cho quản trị viên (`ADMIN_EMAILS`) tạo mã mời cho người thử beta.

- Tạo mã: số lần dùng (mặc định 1), hạn tính theo ngày (mặc định 30), ghi chú.
- Mã rõ chỉ hiện **một lần** trong thẻ `CreatedInviteCard` kèm nút sao chép; sau khi đóng không xem lại được.
- Bảng liệt kê không có mã: ghi chú, đã dùng/tối đa, hạn, trạng thái, nút thu hồi.
- Người không phải admin nhận 404 (như `/admin/metrics`).

Trang `/login` có ô "Mã mời (nếu bạn mới dùng)"; lỗi từ chối chỉ nói chung "Mã mời không dùng được" cho mọi lý do.
