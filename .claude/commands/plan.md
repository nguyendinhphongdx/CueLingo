---
description: Lập plan cho một task bằng agent solution-architect (không viết code). Trả về plan theo mẫu 02-plan.md với ≥ 2 phương án.
argument-hint: <mô tả task hoặc đường dẫn hồ sơ apps/docs/docs/06-delivery...>
allowed-tools: [Agent, Read]
---

Giao cho agent `solution-architect` lập plan cho: **$ARGUMENTS**

Prompt cho agent phải tự đủ: mô tả task, AC (nếu có hồ sơ thì đưa đường dẫn `01-specs.md`), phạm vi trong/ngoài, ràng buộc người dùng đã nêu.

Nhận plan → trình cho người dùng, hỏi: "Plan này ổn chưa? Bắt đầu bước 1 không?" **Không viết code trước khi người dùng đồng ý.**
