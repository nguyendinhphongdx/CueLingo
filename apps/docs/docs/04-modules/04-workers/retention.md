# Retention cleanup

> Phần: [Workers](./README.md) · Code: `services/workers/src/jobs/retention/`

Xoá audio hết hạn và thực hiện yêu cầu xoá dữ liệu.

## Trách nhiệm

- Xoá audio > 30 ngày
- Hoàn tất xoá phiên/tài khoản trong 24 giờ

## Phạm vi MVP

- US-15

## Interface

- Job định kỳ `retention.sweep`, job `privacy.delete {scope, id}`

## Phụ thuộc

- (chưa có)

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- (chưa có)
