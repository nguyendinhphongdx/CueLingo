---
title: Brief P2-15 · cài đặt lưu bền và đồng bộ
---

# Brief — P2-15 · Cài đặt lưu theo tài khoản

> Nhánh `feat/p2-15-codex` · Worktree `.worktrees/p2-15-codex`

## Mục tiêu

Cài đặt đi theo người dùng qua máy và web thay vì mất khi cài lại.

**API** (`services/api/src/modules/settings/`, copy cấu trúc module `account`): `GET /v1/me/settings` và `PATCH /v1/me/settings` lưu vào `learner_profiles` (cột `assist_default` cho mức hỗ trợ, cột `settings` jsonb cho phần còn lại; **không cần migration**). Hợp đồng mới ở `packages/shared/src/dto/settings.dto.ts` (brief này được thêm file và một dòng export): `UserSettings = { assistDefault: 0|1|3|4, overlay: { fontSize: 14..28, opacity: 55..100, theme: 'dark'|'light' }, saveAudio: boolean }`, mặc định `{4, {18, 88, 'dark'}, false}`; PATCH nhận một phần (deep merge, kiểm giá trị bằng Zod `.strict()`). Mọi truy vấn lọc `userId`; dev token chấp nhận ở `/v1/me/settings` (đã có `me`).

**Desktop** (`apps/desktop/src/settings/**`, `apps/desktop/src/overlay/overlay-prefs.ts`): sau khi đăng nhập tải `GET /v1/me/settings` và áp dụng: `useSettings.setAssistLevel` + `native.setAssistLevel`, ghi `localStorage` các khoá của overlay (cùng nguồn `tauri://localhost` nên overlay đọc được; overlay đã lắng nghe `storage` event: thêm nếu chưa). Khi người dùng đổi mức hỗ trợ hoặc tuỳ chỉnh hiển thị ở overlay, gửi `PATCH` sau 800 ms yên lặng (debounce), lỗi mạng thì bỏ qua và thử lại lần đổi kế. Client riêng `settings/settings-api.ts` theo mẫu `auth/me-api.ts`.

**Web** (`apps/web/src/features/preferences/**`, hiện trong trang `/settings` thành mục "Tuỳ chọn"): mức hỗ trợ mặc định (`Segmented`), cỡ chữ và độ đậm nền overlay (thanh trượt), giao diện overlay sáng/tối, công tắc "Lưu âm thanh để nghe lại đoạn khó" (mặc định tắt, ghi rõ lưu ở đâu và xoá lúc nào: đến khi bạn xoá hoặc sau 30 ngày), nút Lưu có trạng thái.

## AC

| #   | AC (EARS)                                                                             | Test                          |
| --- | ------------------------------------------------------------------------------------- | ----------------------------- |
| AC1 | `GET` trả mặc định cho người chưa lưu gì; `PATCH` một phần giữ nguyên phần còn lại    | `settings.test.ts`            |
| AC2 | Giá trị ngoài khoảng (cỡ chữ 99, mức 2) hoặc khoá lạ → 400, không ghi gì              | test                          |
| AC3 | User B không đọc/ghi được cài đặt của A                                               | test + `settings.int.test.ts` |
| AC4 | Desktop áp dụng cài đặt tải về cho mức hỗ trợ và khoá localStorage overlay            | test                          |
| AC5 | Đổi nhanh nhiều lần chỉ gửi một `PATCH` cuối sau 800 ms                               | test với fake timers          |
| AC6 | Web: lưu thành công hiện xác nhận, lỗi hiện thông báo; công tắc âm thanh mặc định tắt | component test                |

## Phạm vi file

Được sửa/tạo: `services/api/src/modules/settings/**` (+ đăng ký ở `app.ts`, `server.ts`, `testing.ts`, test tích hợp), `packages/shared/src/dto/settings.dto.ts` + một dòng export, `apps/desktop/src/settings/**`, `apps/desktop/src/overlay/overlay-prefs.ts`, `apps/web/src/features/preferences/**` và một dòng nhúng vào trang `/settings`, doc module. `apps/desktop/src/overlay/CaptionOverlay.tsx` chỉ được thêm lời gọi lưu khi đổi tuỳ chỉnh.

Quy tắc chung: đọc `AGENTS.md` gốc và của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`, mục "Giai đoạn 2" trong `apps/docs/docs/02-product/06-backlog.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không sửa `packages/ui/src/lib/roadmap.ts`, `package.json`, `pnpm-lock.yaml` (lead sửa khi gộp). Giao diện: dùng `@cuelingo/ui` và các skill thiết kế trong `.claude/skills/` (màu chỉ cho dữ liệu, không gradient, không thẻ icon giống nhau, nhãn câu thường, chữ trong app nhỏ và gọn). Mọi chuỗi giao diện tiếng Việt. Chạy `pnpm verify` trước khi báo; điền mục Kết quả, nêu rõ cái gì chưa kiểm được.

## Kết quả _(implementer điền)_
