---
title: commit
---

# Workflow · commit — Conventional Commits

**Chỉ commit khi người dùng đã bảo** (hoặc đã qua cổng RESULT của [task-loop](./task-loop.md)).

## Trước khi commit

1. `pnpm verify` xanh (sửa docs → thêm `pnpm docs:build`).
2. `git status` + `git diff --staged`: không có `.env`, secret, dữ liệu/model trong `ml/`, `node_modules`, `build/`.
3. Hook pre-commit (lint-staged) chạy ESLint + Prettier. **Không** dùng `--no-verify`.

## Message (tiếng Anh)

```text
<type>(<scope>): <subject, imperative, ≤ 72 ký tự>

<body: vì sao thay đổi, không lặp lại diff. Link hồ sơ apps/docs/docs/06-delivery/… hoặc ADR.>

Co-Authored-By: <agent> <email>     # agent nào viết thì ghi agent đó
```

| type                      | Khi                                                   |     | scope (ví dụ)                                                                                   |
| ------------------------- | ----------------------------------------------------- | --- | ----------------------------------------------------------------------------------------------- |
| `feat`                    | Hành vi mới cho người dùng                            |     | `api`, `web`, `desktop`, `shared`, `learner-model`, `ai-gateway`, `glossary`, `docs`, `harness` |
| `fix`                     | Sửa lỗi                                               |     |                                                                                                 |
| `refactor`                | Đổi cấu trúc, không đổi hành vi                       |     |                                                                                                 |
| `test` · `docs` · `chore` | Chỉ test · chỉ tài liệu · tooling/cấu hình/dependency |     |                                                                                                 |

## Chia commit

Mỗi commit một bước logic, review được độc lập, theo thứ tự contract → migration → api → client → app → docs. Không gộp refactor với tính năng.

## Anti-pattern

- ❌ `git add -A` khi chưa xem `git status` · message "update", "wip".
- ❌ Commit khi verify đỏ "để sửa sau" · `--no-verify`.
