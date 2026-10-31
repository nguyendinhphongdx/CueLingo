# Privacy

> Phần: [API service](./README.md) · Code: `services/api/src/modules/privacy/`

Xoá dữ liệu, thời hạn lưu, xuất dữ liệu, consent.

## Trách nhiệm

- Xoá phiên: transcript, audio, event; thẻ giữ lại nhưng bỏ câu gốc (≤ 24 giờ)
- Xoá tài khoản
- Ghi trạng thái consent mỗi phiên

## Phạm vi MVP

- US-15

## Interface

- `DELETE /v1/sessions/:id`, `DELETE /v1/me`, `GET /v1/me/export`

## Phụ thuộc

- `workers/retention`

## Dữ liệu & sự kiện

- Events: `data_deleted`

## Câu hỏi mở

- (chưa có)
