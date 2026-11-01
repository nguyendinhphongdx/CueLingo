---
title: Brief B2 · UI package
---

# Brief — foundation · B2 UI package

> Giao cho: Codex · Nhánh: `feat/foundation-ui-codex` · Worktree: `../cuelingo-foundation-ui-codex`
> Quy tắc phối hợp: `apps/docs/docs/05-engineering/agent-collaboration.md`

## Mục tiêu

Dựng `@cuelingo/ui` (Tailwind 4 + shadcn/ui) theo `apps/docs/docs/05-engineering/scaffold/05-ui-package.md`, gồm Button, Input, Card và CaptionLine, dùng được từ web và desktop.

## AC phải đạt

| #   | AC (EARS)                 | Test                   |
| --- | ------------------------- | ---------------------- |
| AC1 | WHEN … THE SYSTEM SHALL … | `<file>.test.ts` › `…` |

## Đọc trước

- `AGENTS.md` (gốc) và `<thư mục>/AGENTS.md`
- Scaffold: `apps/docs/docs/05-engineering/scaffold/05-ui-package.md`
- Convention: _apps/docs/docs/05-engineering/conventions/…_
- Module mẫu: _đường dẫn_

## Phạm vi file

| Được sửa / tạo                                                  | Không được sửa                                                                                |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/ui/**`, `apps/docs/docs/04-modules/05-packages/ui.md` | `services/api/src/app.ts`, `packages/shared/src/index.ts`, `pnpm-lock.yaml` _(lead tích hợp)_ |

## Các bước

1. …
2. …

## Definition of Done

- [ ] AC trên có test và xanh
- [ ] `pnpm verify` xanh (sửa docs → `pnpm docs:build`)
- [ ] Đã chạy thật: _mô tả cần thử_
- [ ] Trang module trong `apps/docs/docs/04-modules/` cập nhật nếu interface/dữ liệu đổi
- [ ] Không commit, không push (lead tích hợp)

## Ngoài phạm vi · Dừng và hỏi khi

- Ngoài phạm vi: …
- Dừng và ghi câu hỏi nếu: cần sửa file ngoài danh sách · AC mâu thuẫn với code · phải đổi contract/schema không có trong brief.

## Kết quả _(implementer điền)_

- File đã đổi:
- Test đã thêm:
- `pnpm verify`:
- Đã chạy thật:
- Khác brief (và lý do):
- Câu hỏi còn mở:
