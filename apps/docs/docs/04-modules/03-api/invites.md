---
title: Mã mời
---

# Mã mời (invites)

> Phần: [API service](./README.md) · Code: `services/api/src/modules/invites/` · Spec: `06-delivery/2026-11-05-beta-readiness`

Cổng vào cho beta kín: người **chưa có tài khoản** phải có mã mời hợp lệ mới tạo được tài khoản, dù đăng nhập bằng email, Google hay từ app desktop.

## Trách nhiệm

- Quản trị viên tạo, liệt kê và thu hồi mã (`/v1/admin/invites`).
- Nhận mã người dùng gõ ở trang `/login` và nhớ nó cho lần đăng nhập ngay sau đó (`POST /v1/invites/intent` → cookie `cl_invite`).
- Cung cấp `InviteGate` cho Better Auth: tiêu một lần dùng của mã trước khi tạo user.

## Interface

| Method | Path                    | Ai gọi    | Kết quả                                                                                                      |
| ------ | ----------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| POST   | `/v1/invites/intent`    | công khai | `204` + cookie `cl_invite`; `400 INVITE_INVALID` (cùng một thông báo mọi lý do); `429` sau 10 lần/10 phút/IP |
| POST   | `/v1/admin/invites`     | admin     | `201` `CreatedInviteSchema` (có `code`, **chỉ lần này**); mặc định 1 lần dùng, 30 ngày                       |
| GET    | `/v1/admin/invites`     | admin     | `InviteListSchema`, không có mã                                                                              |
| DELETE | `/v1/admin/invites/:id` | admin     | `204`; `404` nếu không có hoặc đã thu hồi                                                                    |

Quyền admin hỏi `admin.service.isAdmin(userId)` (một nguồn sự thật cho `ADMIN_EMAILS`).

## Cách cổng hoạt động

1. `/login` gọi `intent` với mã đã gõ. API kiểm mã (không tiêu) và đặt cookie `cl_invite` (httpOnly, `SameSite=Lax`, `Secure` ở production, 30 phút).
2. Người dùng bấm link email / hoàn tất Google. Better Auth gọi `user.validateUserInfo` **chỉ khi tạo user mới** (`action = create-user`). Hook đọc cookie và chạy một câu `UPDATE invites SET used_count = used_count + 1 WHERE … AND used_count < max_uses RETURNING id`, nên hai người không thể cùng lấy lần dùng cuối.
3. Sai/hết hạn/đã dùng/bị thu hồi/không có mã → hook trả `{ error: 'invite_invalid' }`; Better Auth không tạo user và chuyển hướng về `errorCallbackURL?error=invite_invalid`.
4. `databaseHooks.user.create.after` ghi `invite_redemptions`.
5. Người đã có tài khoản không đi qua bước 2 nên không bị hỏi mã. Desktop đăng nhập qua web (`/login?app=1`) nên được phủ cùng cổng; module `device` không tạo user.

Mã: 12 ký tự Crockford base32 (~60 bit), lưu SHA-256, gõ không phân biệt hoa thường, bỏ qua dấu cách và gạch ngang.

## Cấu hình

`INVITES_REQUIRED` (`true`/`false`): mặc định **bật ở production, tắt ở development và test**.

Mã đầu tiên (khi chưa có admin nào): `pnpm --filter @cuelingo/api invite:create [lần dùng] [ngày] [ghi chú]` in mã rõ một lần ra stdout.

## Dữ liệu & quyền riêng tư

- Bảng `invites` (chỉ băm), `invite_redemptions` (xoá khi xoá tài khoản). Không log mã, email hay token; header `cookie` đã bị che trong log.
- Một lần dùng bị tiêu rồi mà tạo user lỗi giữa chừng thì mất lần dùng đó (hiếm; admin tạo mã mới).

## Giới hạn đã biết

- Mở magic link ở **trình duyệt khác** với trình duyệt đã gõ mã thì thiếu cookie → bị từ chối; người dùng nhập lại mã ở trình duyệt đó.
- Bộ đếm giới hạn `intent` nằm trong bộ nhớ một tiến trình API (đủ cho beta một instance).
