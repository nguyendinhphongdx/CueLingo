---
name: git-commit
description: Tạo commit theo Conventional Commits cho repo CueLingo — chia theo bước logic, message tiếng Anh, body giải thích vì sao. Dùng khi người dùng bảo commit hoặc khi đóng task-loop sau cổng RESULT.
---

# git-commit

## Trước khi commit

1. `pnpm verify` xanh.
2. `git status` + `git diff --staged`: không có `.env`, secret, file trong `ml/bench/data`, model, `node_modules`.
3. Chỉ commit khi người dùng đã bảo (hoặc đã qua cổng RESULT của task-loop).

## Message

```text
<type>(<scope>): <subject, imperative, ≤ 72 ký tự>

<body: vì sao thay đổi, không lặp lại diff. Link hồ sơ docs/06-delivery/… hoặc ADR nếu có.>
```

| type       | Khi                             |
| ---------- | ------------------------------- |
| `feat`     | Hành vi mới cho người dùng      |
| `fix`      | Sửa lỗi                         |
| `refactor` | Đổi cấu trúc, không đổi hành vi |
| `test`     | Chỉ thêm/sửa test               |
| `docs`     | Chỉ tài liệu                    |
| `chore`    | Tooling, cấu hình, dependency   |

`scope` = phần hoặc module: `api`, `web`, `desktop`, `shared`, `learner-model`, `ai-gateway`, `glossary`, `harness`…

## Chia commit

Mỗi commit một bước logic, review được độc lập, theo thứ tự: contract → migration → api → client → app → docs. Không gộp refactor với tính năng.

## Anti-pattern

- ❌ `git add -A` khi chưa xem `git status`.
- ❌ Message "update", "fix bug", "wip".
- ❌ Commit khi verify đỏ "để sửa sau".
- ❌ Dùng `--no-verify` để bỏ qua hook.
