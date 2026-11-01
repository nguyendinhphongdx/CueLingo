# Auth

> Phần: [API service](./README.md) · Code: `services/api/src/modules/auth/`

Danh tính và đăng nhập bằng **Better Auth** tự host trên Postgres ([ADR-0008](../../08-adr/0008-auth-better-auth.md)). Biến một cookie session thành `request.userId` cho mọi route `/v1/*`.

## Trách nhiệm

- Đăng nhập bằng magic link; Google OAuth khi đặt `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`.
- Gắn handler của Better Auth vào `/api/auth/*` (Fastify request → Fetch `Request` → reply, giữ nhiều `Set-Cookie`).
- `resolveUserId`: đọc session từ header → `request.userId`; không có session → 401.
- Tạo một dòng `learner_profiles` ngay sau khi đăng ký (`databaseHooks.user.create.after`).
- Gửi magic link qua `Mailer`. Dev: in link ra log. **Production chưa có nhà cung cấp email nên từ chối** (chọn trước beta).

## Phạm vi MVP

- US-01 (đăng nhập). Token ngắn hạn cho WebSocket stream làm ở giai đoạn đường realtime.

## Interface

- `GET|POST /api/auth/*` — API của Better Auth (ví dụ `POST /api/auth/sign-in/magic-link`, `GET /api/auth/magic-link/verify`, `GET /api/auth/get-session`, `POST /api/auth/sign-out`).
- Hook `onRequest` trong `lib/auth.ts`: bỏ qua `/healthz` và `/api/auth/*`; còn lại yêu cầu session.
- `createAuthModule(config, mailer?)` → `{ auth, routes, resolveUserId }`.
- Client: `createAuthClient` từ `better-auth/react` (web, [scaffold](../../05-engineering/scaffold/04-web-nextjs.md)).

## Phụ thuộc

- `better-auth`, `pg` (pool riêng của Better Auth, tách khỏi `postgres.js` của phần còn lại).
- Config: `BETTER_AUTH_SECRET` (≥ 32 ký tự), `BETTER_AUTH_URL`, `WEB_ORIGIN`, tuỳ chọn Google.

## Dữ liệu & sự kiện

- Bảng `auth_user`, `auth_session`, `auth_account`, `auth_verification` (Better Auth sở hữu, tiền tố `auth_` đặt bằng `modelName`) và `learner_profiles`. Xem [Mô hình dữ liệu](../../03-architecture/07-data-model.md).
- Test integration `auth.int.test.ts` kiểm migration của ta khớp schema Better Auth cần (`getMigrations`) và luồng magic link → session → API.

## Câu hỏi mở

- Nhà cung cấp email cho magic link ở production (trước beta).
- Token ngắn hạn cho WebSocket: dùng plugin bearer/JWT của Better Auth hay cấp riêng?
