# .claude/ — harness Claude Code

Quy tắc chung nằm ở [AGENTS.md](../AGENTS.md) (cho mọi agent). Thư mục này chỉ chứa phần riêng của Claude Code.

```text
.claude/
  settings.json                 permission allow/deny/ask + hook (commit)
  settings.local.json           ghi đè của từng người (gitignore) — mẫu: settings.local.json.example
  hooks/session-start.mjs       nhắc vòng làm việc ở đầu mỗi session
  skills/<name>/SKILL.md        Claude tự gọi theo description
  agents/<name>.md              sub-agent: context riêng, tool hẹp
  commands/<name>.md            người dùng gõ /<name>
```

|          | Skill                     | Sub-agent                                   | Command          |
| -------- | ------------------------- | ------------------------------------------- | ---------------- |
| Ai gọi   | Claude (theo description) | Claude (Agent tool)                         | Người dùng (`/`) |
| Context  | Cùng luồng chính          | Tách riêng                                  | Cùng luồng chính |
| Dùng khi | Quy trình hẹp, lặp lại    | Việc nặng context hoặc cần góc nhìn độc lập | Lối tắt          |

## Khi thêm skill / agent / command

1. Skill: `description` nói rõ **khi nào** dùng; có Anti-pattern; ≤ 120 dòng; trỏ vào docs thay vì chép luật.
2. Agent: prompt tự đủ (agent không thấy hội thoại); giới hạn `tools`; nêu đầu ra mong đợi.
3. Cập nhật bảng "Harness Claude Code" trong [AGENTS.md](../AGENTS.md).
4. Chỉ thêm khi một việc đã lặp lại ≥ 2 lần. Ít mà dùng thật tốt hơn nhiều mà bỏ xó.

## Thứ tự permission

`deny` > `ask` > `allow`. Lệnh ghi ra ngoài repo (push, PR), xoá file, sửa migration và sửa chính harness luôn hỏi người.
