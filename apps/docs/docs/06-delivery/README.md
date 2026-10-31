# 06 · Delivery Log

Mỗi task **không đơn giản** có một hồ sơ: `apps/docs/docs/06-delivery/<YYYY-MM-DD>-<slug>/`. Người review đọc hồ sơ trước khi đọc diff.

| Loại task      | Dấu hiệu                                                           | Hồ sơ?                            |
| -------------- | ------------------------------------------------------------------ | --------------------------------- |
| Vặt            | 1–2 file, không đụng contract/schema/AI/quyền riêng tư             | Không — code thẳng, `pnpm verify` |
| Không đơn giản | ≥ 3 file, nhiều phần, đụng contract/schema/event/prompt            | Có                                |
| Nhạy cảm       | DB schema, xoá dữ liệu, bảo mật, nhà cung cấp AI mới, breaking API | Có + hỏi người ở mỗi cổng         |

```bash
cp -r apps/docs/docs/06-delivery/_template apps/docs/docs/06-delivery/$(date +%F)-<slug>
```

| File                     | Điền ở pha                                                                                                                  | Cổng             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `01-specs.md`            | Hiểu vấn đề, AC (EARS)                                                                                                      | ⛔ Duyệt spec    |
| `02-plan.md`             | ≥ 2 phương án, chọn 1, các bước                                                                                             | ⛔ Duyệt plan    |
| `03-review.md`           | Thay đổi thực tế, tự review, hướng dẫn review                                                                               | ⛔ Duyệt kết quả |
| `04-brief.md` (tuỳ chọn) | Mỗi phần việc giao cho agent khác (Codex, sub-agent) — xem [phối hợp nhiều agent](../05-engineering/agent-collaboration.md) | —                |

Bị từ chối ở cổng nào → quay lại pha đó, **ghi thêm** lý do vào Decision log (không xoá dòng cũ). Quy trình đầy đủ: skill `task-loop`.
