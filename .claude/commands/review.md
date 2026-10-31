---
description: Review độc lập các thay đổi đang chờ bằng agent code-reviewer, theo checklist docs/05-engineering/conventions/code-review.md.
argument-hint: (tuỳ chọn) <phần cần soi kỹ>
allowed-tools: [Agent, Bash]
---

Review thay đổi hiện tại${ARGUMENTS:+, soi kỹ: $ARGUMENTS}.

Giao cho agent `code-reviewer`. Nhận báo cáo → có 🔴 thì đề xuất cách sửa với người dùng. **Không tự commit.**
