---
title: Phản hồi
---

# Phản hồi (feedback)

> Phần: [API service](./README.md) · Code: `services/api/src/modules/feedback/` · Spec: `06-delivery/2026-11-05-beta-readiness`

Người thử beta gửi lỗi hoặc góp ý. **Chỉ ghi, không có route đọc cho người dùng.**

## Interface

| Method | Path           | Kết quả                                                                     |
| ------ | -------------- | --------------------------------------------------------------------------- |
| POST   | `/v1/feedback` | `201` `{ id, createdAt }`; `400` nếu sai schema; `429` quá 10 tin/giờ/người |

Body (`CreateFeedbackRequestSchema`, `.strict()`): `kind` (`bug`/`idea`), `message` (1–2000 ký tự), `client` (`desktop`/`web`), `appVersion` (≤ 40), `os` (≤ 80). Không có trường nào chứa transcript, audio, token hay `userId`; trường thừa bị từ chối.

## Dữ liệu & quyền riêng tư

- Bảng `feedback(user_id → auth_user ON DELETE CASCADE, …)`; xoá tài khoản xoá phản hồi.
- `user_id` luôn lấy từ session. Không log nội dung (`req.body` đã bị che).
- Số lượng 30 ngày hiện ở `/admin/metrics` (khối `beta.feedback30d`).

## Đọc phản hồi (tạm, chưa có trang)

Admin đọc bằng SQL, không kèm email:

```sql
SELECT created_at, kind, client, app_version, os, message
FROM feedback ORDER BY created_at DESC LIMIT 50;
```

## Câu hỏi mở

- Có cần trang đọc phản hồi cho admin (`GET /v1/admin/feedback`, không kèm email) không? Hiện chưa (vượt AC8).
