---
description: Viết một Architecture Decision Record mới trong docs/adr/.
argument-hint: <tiêu đề quyết định>
allowed-tools: [Read, Write, Edit, Glob]
---

Viết ADR cho: **$ARGUMENTS**

1. Số tiếp theo trong `docs/adr/` (`NNNN-<slug>.md`).
2. Cấu trúc như các ADR hiện có: **Trạng thái** (Proposed) · ngày · Bối cảnh · Quyết định · Phương án đã cân nhắc · Hệ quả. Ngắn gọn, ≤ 60 dòng.
3. Thêm một dòng vào bảng trong `docs/adr/README.md`.
4. ADR thay thế ADR cũ → không sửa nội dung ADR cũ, chỉ đổi trạng thái thành "Superseded by NNNN".
5. Trình nháp cho người dùng; chỉ đổi sang "Accepted" khi người dùng đồng ý.
