---
name: task-loop
description: Quy trình CueLingo cho task KHÔNG đơn giản (≥ 3 file, nhiều phần, hoặc đụng @cuelingo/shared, migration, event, prompt/model AI, dữ liệu người dùng, scaffold một phần mới). Mở hồ sơ apps/docs/docs/06-delivery, đi qua 3 cổng duyệt SPEC → PLAN → RESULT. Invoke TRƯỚC khi lập plan hoặc sửa code. Không dùng cho task vặt 1–2 file.
---

# task-loop

**Làm theo:** `apps/docs/docs/05-engineering/workflows/task-loop.md` (nguồn duy nhất, dùng chung với Codex). Đọc file đó trước, rồi đi đúng từng pha và dừng ở mỗi cổng ⛔ để hỏi người dùng.

## Riêng cho Claude Code

| Pha                                | Công cụ                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Spec — cần tổng hợp nhiều tài liệu | agent `docs-explorer`                                                                   |
| Plan — task nhạy cảm hoặc > 5 bước | agent `solution-architect` (hoặc `/plan`)                                               |
| Làm — TypeScript                   | agent `ts-engineer` hoặc luồng chính                                                    |
| Làm — Swift/Rust                   | agent `native-engineer`                                                                 |
| Làm — giao cho Codex               | viết `04-brief.md` rồi giao theo `apps/docs/docs/05-engineering/agent-collaboration.md` |
| Review                             | agent `code-reviewer` (hoặc nhờ Codex review chéo nếu Claude viết code)                 |
| Commit                             | skill `git-commit`                                                                      |
| Phần chưa dựng                     | trang scaffold trong `apps/docs/docs/05-engineering/scaffold/`                          |
