# 0008 · Auth: Better Auth self-host trên Postgres

**Trạng thái:** Accepted · 2026-10-31

## Bối cảnh

Cần đăng nhập Google + magic link email cho web và desktop. Dữ liệu người dùng nhạy cảm; về sau có B2B cần SSO và on-premise. Hiện API đang dùng header dev tạm (`x-dev-user-id`).

## Quyết định

- Dùng **Better Auth** (thư viện TypeScript, self-host, lưu trên Postgres của chúng ta), gắn vào `services/api` qua module `auth`.
- Phương thức đăng nhập: Google OAuth + magic link. Desktop dùng luồng trình duyệt hệ thống + PKCE, token lưu Keychain.
- Hook `lib/auth.ts` đổi sang đọc session/token của Better Auth và gắn `request.userId`. Bỏ header dev khỏi production.

## Phương án đã cân nhắc

- **Supabase Auth:** nhanh nhưng kéo theo nền tảng Supabase.
- **Clerk:** UI đẹp, nhưng dữ liệu người dùng nằm ở bên thứ ba và chi phí theo MAU; khó đi on-premise.
- **Tự viết:** rủi ro bảo mật cao, không đáng.

## Hệ quả

- Thêm bảng của Better Auth bằng migration mới.
- SSO doanh nghiệp (SAML/OIDC) làm ở giai đoạn Scale bằng plugin của thư viện.
