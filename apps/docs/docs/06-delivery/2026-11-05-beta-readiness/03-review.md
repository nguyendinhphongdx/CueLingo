# Review — <slug>

## Thay đổi so với plan

| Dấu         | File / hành vi | Chi tiết (lý do nếu khác plan) |
| ----------- | -------------- | ------------------------------ |
| 🟢 ADDED    | …              | …                              |
| 🟡 MODIFIED | …              | _chỗ rủi ro, soi kỹ_           |
| 🔴 REMOVED  | …              | …                              |

**Docs đã cập nhật:** _docs/03-parts/…, ADR…_

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md): - [ ] Ranh giới & bảo mật · - [ ] Hợp đồng · - [ ] Kiến trúc · - [ ] AI · - [ ] Test · - [ ] Docs · - [ ] Phạm vi

```bash
pnpm verify
```

Đã chạy thật: _mô tả luồng đã thử_

## Cho người review — đọc theo thứ tự

| #   | File | Soi gì |
| --- | ---- | ------ |
| 1   | …    | …      |

## Lỗi tìm thấy khi review/test

| Lỗi | Tìm ở | Sửa |
| --- | ----- | --- |

## Spike: đổi Việt ↔ Anh giữa họp (Lô 5)

Đọc `session-controller.ts`, `audio_bridge.rs`, `main.swift`: sidecar giữ mô hình cũ cho tới khi mô hình mới `ready` (comment trong `set_language`), controller không xoá transcript khi đổi ngôn ngữ. Khoảng trống caption chỉ bằng thời gian tải mô hình, không cần sửa Swift. Chưa đo bằng tay trên máy thật: việc của người (H7).
