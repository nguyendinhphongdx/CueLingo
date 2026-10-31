# 0009 · Migration: dbmate với file SQL thuần

**Trạng thái:** Accepted · 2026-10-31

## Bối cảnh

Repo truy cập DB bằng SQL tay (postgres.js, không ORM). Migration hiện nằm trong `infra/db/migrations/` và chỉ chạy khi docker khởi tạo lần đầu, nên chưa có cách áp dụng thay đổi lên DB đang chạy.

## Quyết định

- Dùng **dbmate**: mỗi migration là một file `.sql` có phần `-- migrate:up` / `-- migrate:down`, đặt tên theo timestamp, nằm trong `infra/db/migrations/`. dbmate ghi các bản đã chạy vào bảng `schema_migrations`.
- Lệnh: `pnpm db:migrate`, `pnpm db:new <name>`, `pnpm db:rollback` (chỉ dùng ở dev).
- CI chạy migration trên Postgres tạm trước integration test.
- Migration đã merge thì **không sửa**, muốn đổi thì thêm file mới.

## Phương án đã cân nhắc

- **Tự viết runner:** ít phụ thuộc, nhưng phải tự lo khoá, thứ tự, rollback.
- **node-pg-migrate / Knex / Prisma Migrate:** migration viết bằng JS hoặc gắn với ORM, trong khi ta muốn SQL thuần dễ review.

## Hệ quả

- Chuyển `0001_init.sql` sang định dạng dbmate ở giai đoạn Nền móng. File này chưa chạy ở đâu nên chuyển được.
