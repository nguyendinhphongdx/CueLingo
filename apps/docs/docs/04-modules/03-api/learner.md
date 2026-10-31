# Learner Model service

> Phần: [API service](./README.md) · Code: `services/api/src/modules/learner/`

Nguồn sự thật về người học: profile, lexicon, kỹ năng; áp dụng event thành cập nhật.

## Trách nhiệm

- API đọc profile và lexicon cho các module khác
- Nhận event, gọi `@cuelingo/learner-model` để cập nhật trạng thái
- Placement test → `listening_level`

## Phạm vi MVP

- F1, F6

## Interface

- `GET/PATCH /v1/me`, `POST /v1/placement`, hàm nội bộ `applyEvents(userId, events)`

## Phụ thuộc

- `@cuelingo/learner-model`

## Dữ liệu & sự kiện

- Bảng `users`, `user_lexicon`, `events`

## Câu hỏi mở

- Giai đoạn 2: thêm Graphiti cho temporal graph
