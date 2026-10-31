# Debrief

> Phần: [API service](./README.md) · Code: `services/api/src/modules/debrief/`

Đọc kết quả debrief do worker tạo, nhận phản hồi.

## Trách nhiệm

- Trả debrief theo phiên bản
- Nhận feedback từng khối

## Phạm vi MVP

- F4

## Interface

- `GET /v1/sessions/:id/debrief`, `POST /v1/debriefs/:id/feedback`

## Phụ thuộc

- (chưa có)

## Dữ liệu & sự kiện

- Bảng `debriefs`

## Câu hỏi mở

- (chưa có)
