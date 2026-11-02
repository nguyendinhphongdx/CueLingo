---
title: Brief · Tài khoản đầy đủ (giao diện web và desktop)
---

# Brief — Giao diện tài khoản đầy đủ

> Nhánh `feat/p2-account-ui-codex` · Worktree `.worktrees/p2-account-ui-codex`

## Bối cảnh

Đăng nhập bằng email đã chạy (magic link, token thiết bị cho app desktop). Claude đang làm phần API: `GET/PATCH/DELETE /v1/me` theo `packages/shared/src/dto/account.dto.ts` (đừng đổi), gửi email thật và giới hạn tần suất. Bạn làm **giao diện**. API `/v1/me` chưa có khi bạn làm: viết client + test với `fetch`/client giả, đừng gọi mạng thật.

## Việc cần làm

**Web** (`apps/web`, trang `/settings` đã có; đọc `src/features/account`):

1. **Hồ sơ:** hiện tên và email (email chỉ đọc), sửa tên (`PATCH /v1/me`), ngày tham gia; avatar là chữ cái đầu tên trong vòng tròn phẳng, không ảnh.
2. **Thiết bị đã đăng nhập:** `GET /v1/device/tokens` → danh sách (nhãn, đăng nhập lúc, dùng lần cuối, khi nào theo "x phút trước"), nút "Đăng xuất thiết bị" cho từng dòng (`DELETE /v1/device/tokens/:id`, có xác nhận). Trạng thái rỗng: "Chưa có app nào đăng nhập" kèm liên kết `/download`.
3. **Phiên trình duyệt:** nút "Đăng xuất khỏi các trình duyệt khác" dùng `authClient.revokeOtherSessions()` của Better Auth; nút "Đăng xuất" hiện có giữ nguyên.
4. **Vùng nguy hiểm:** "Đóng tài khoản": hộp xác nhận hai bước, người dùng gõ đúng `XOA TAI KHOAN` (`DELETE_ACCOUNT_CONFIRMATION`), gọi `DELETE /v1/me`, rồi đăng xuất và chuyển về `/`. Nói rõ xoá những gì (cuộc họp, cụm từ, thuật ngữ, debrief, thiết bị) và không hoàn tác được. Đặt dưới mục "Dữ liệu của bạn" đã có (tải dữ liệu / xoá dữ liệu).
5. **Lần đầu đăng nhập:** nếu `name` của người dùng đang trùng phần trước `@` của email (tên mặc định), hiện một bước nhỏ "Bạn muốn được gọi là gì?" một lần (lưu bằng `PATCH /v1/me`, bỏ qua được, nhớ đã bỏ qua trong `localStorage`).
6. Sidebar (`AppShell`) hiện tên người dùng thay cho email khi có.

**Desktop** (`apps/desktop`, thẻ `AccountCard` ở `src/auth/AccountCard.tsx`): 7. Khi đã đăng nhập bằng token thiết bị, thẻ hiện avatar chữ cái đầu, tên và email (`GET /v1/me` qua client `src/auth/me-api.ts` viết mới theo mẫu `src/insights/insights-api.ts`, token lấy từ `currentToken`), kèm nút "Đăng xuất khỏi thiết bị này" hiện có. Lỗi mạng hiện dòng nhỏ, không chặn nút đăng xuất. Chế độ token dev: giữ câu hiện tại.

## AC

| #   | AC (EARS)                                                                                                                                 | Test           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| AC1 | WHEN sửa tên và lưu THE SYSTEM SHALL gọi `PATCH /v1/me` với tên đã cắt khoảng trắng và hiện tên mới                                       | component test |
| AC2 | IF tên rỗng hoặc dài hơn 80 ký tự THEN nút Lưu bị vô hiệu                                                                                 | test           |
| AC3 | Danh sách thiết bị hiện từng thiết bị; WHEN xác nhận đăng xuất thiết bị THE SYSTEM SHALL gọi `DELETE /v1/device/tokens/:id` và bỏ dòng đó | test           |
| AC4 | Đóng tài khoản chỉ gọi API khi người dùng gõ đúng chuỗi xác nhận; thành công thì đăng xuất và chuyển về `/`                               | test           |
| AC5 | Bước "Bạn muốn được gọi là gì?" chỉ hiện khi tên trùng phần trước `@`, và không hiện lại sau khi bỏ qua                                   | test           |
| AC6 | Desktop: `AccountCard` hiện tên + email khi `GET /v1/me` thành công; lỗi mạng không làm mất nút đăng xuất                                 | test           |
| AC7 | `pnpm verify` và `pnpm --filter @cuelingo/web build` xanh                                                                                 | verify         |

## Phạm vi file

Được sửa/tạo: `apps/web/src/features/account/**`, `apps/web/src/features/auth/AppShell.tsx`, `apps/web/src/lib/client.ts` (chỉ thêm `me` và `device`), `apps/web/src/app/(app)/settings/**`, `apps/desktop/src/auth/{AccountCard.tsx,me-api.ts,*.test.ts}`. Không sửa `services/**`, `packages/**`, `src-tauri/**`, `package.json`, lockfile.

Quy tắc chung: đọc `AGENTS.md` gốc và của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`. Dùng `@cuelingo/ui` và các skill thiết kế trong `.claude/skills/` (màu chỉ cho dữ liệu, không gradient, không thẻ icon giống nhau). Không có mạng, không `pnpm add`, không commit/push. Chạy `pnpm verify`; điền mục Kết quả.

## Kết quả _(implementer điền)_
