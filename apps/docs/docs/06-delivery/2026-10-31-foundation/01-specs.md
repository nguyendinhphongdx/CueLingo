---
title: 2026-10-31 · Nền móng
---

# foundation — Giai đoạn 1 · Nền móng

| Trạng thái              | Loại                | Nhánh / PR        | Ước lượng → thực tế |
| ----------------------- | ------------------- | ----------------- | ------------------- |
| Spec + Plan (chờ duyệt) | chore / feature nền | `feat/foundation` | 2 tuần → ?          |

**Phạm vi:** trong: cấu hình, migration, auth thật, hàng đợi + worker, UI kit, web Next.js, khung app desktop, integration test, Dockerfile, CI · ngoài: audio, STT, realtime, AI, các module nghiệp vụ ngoài `glossary`.

## 1. Vấn đề

Repo đã có khung, harness và module mẫu `glossary`, nhưng **chưa có gì chạy như sản phẩm thật**:

- API xác thực bằng header dev (`x-dev-user-id`), đọc `process.env` rải rác, migration chỉ chạy khi docker khởi tạo lần đầu.
- Chưa có worker, chưa có hàng đợi; chưa có web app thật (chỉ có component React rời), chưa có UI kit, chưa có app desktop.
- Repository Postgres chưa từng chạy với DB thật; CI chưa có DB.

Mọi giai đoạn sau (đường realtime, vòng học) đều cần những nền này. Đây cũng là **lần đầu dùng harness với nhiều agent** (Claude + Codex) — phép thử cho scaffold và brief.

- **Spec liên quan:** [Tech stack](../../03-architecture/01-tech-stack.md), [Tổ chức thư mục](../../03-architecture/03-folder-structure.md), [Scaffold](../../05-engineering/scaffold/README.md), ADR [0007](../../08-adr/0007-ui-stack.md)–[0011](../../08-adr/0011-deployment-containers-sg.md).
- **Phần chạm tới:** `services/api`, `services/workers`, `packages/{shared,core-sdk,ui}`, `apps/{web,desktop}`, `infra/`, CI.

## 2. Tiêu chí chấp nhận (EARS)

| #    | AC                                                                                                                                                                                             | Test                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| AC1  | IF API hoặc worker khởi động thiếu/sai biến môi trường THEN THE SYSTEM SHALL dừng ngay và báo tên biến                                                                                         | `config.test.ts`                 |
| AC2  | WHEN chạy `pnpm db:migrate` trên DB trống THE SYSTEM SHALL tạo đủ bảng nghiệp vụ, bảng của Better Auth và `learner_profiles`; WHEN chạy `pnpm db:rollback` THE SYSTEM SHALL lùi migration cuối | integration (CI)                 |
| AC3  | WHEN người dùng đăng nhập bằng magic link (và Google khi có khoá OAuth) trên web THE SYSTEM SHALL tạo session, và request API kèm session đó SHALL có `userId` của người đó                    | chạy thật + test `resolveUserId` |
| AC4  | IF request tới `/v1/*` không có session hợp lệ THEN THE SYSTEM SHALL trả 401                                                                                                                   | `glossary.test.ts`               |
| AC5  | WHILE chạy với Postgres thật, repository `glossary` SHALL giữ ranh giới người dùng (user B không đọc/sửa/xoá được của user A)                                                                  | `glossary.int.test.ts`           |
| AC6  | WHEN API gửi một job THE SYSTEM SHALL để worker xử lý nó; `retention.sweep` SHALL chạy theo lịch hằng ngày và chạy lại không đổi kết quả                                                       | `retention.test.ts` + chạy thật  |
| AC7  | WHEN người dùng đã đăng nhập mở `/glossary` trên web THE SYSTEM SHALL liệt kê, thêm, xoá thuật ngữ lưu trong DB, dùng component từ `@cuelingo/ui`                                              | chạy thật trong trình duyệt      |
| AC8  | WHEN mở app desktop THE SYSTEM SHALL hiện cửa sổ chính; WHEN bấm ⌘⇧L THE SYSTEM SHALL hiện/ẩn overlay trong suốt, luôn nổi và không xuất hiện khi chia sẻ màn hình                             | chạy thật (Zoom/Meet thử)        |
| AC9  | WHEN build image `services/api` và `services/workers` THE SYSTEM SHALL build thành công không chứa `.env`                                                                                      | `docker build`                   |
| AC10 | WHEN có PR THE SYSTEM SHALL chạy trong CI: verify, docs build, migration và integration test trên Postgres                                                                                     | GitHub Actions                   |

## 3. Câu hỏi mở

- [ ] **Docker daemon** chưa chạy trên máy dev → cần bật Docker Desktop trước bước DB (AC2, AC5).
- [ ] **Khoá Google OAuth** (client id/secret): người dùng tạo trong Google Cloud Console? Nếu chưa có, giai đoạn này chỉ nghiệm thu magic link; Google bật khi có khoá.
- [ ] **Gửi email magic link:** dev in link ra log; nhà cung cấp email thật chọn ở giai đoạn Beta — đồng ý?
- [ ] **Node 24 LTS:** nâng ngay trong giai đoạn này (đề xuất, vì Dockerfile mới dùng `node:24-slim`)?

## Decision log

| Ngày       | Pha  | Quyết định / lý do                                                                                                             |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-31 | Spec | Mở hồ sơ. Trình spec và plan **cùng lúc** ở một cổng vì phạm vi đã được duyệt trước qua trang Tổ chức thư mục và ADR 0007–0011 |
