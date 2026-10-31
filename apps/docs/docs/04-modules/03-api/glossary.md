# Glossary

> Phần: [API service](./README.md) · Code: `services/api/src/modules/glossary/`

> **Module mẫu** của tầng này (`services/api/src/modules/glossary/`). Module mới copy cấu trúc từ đây — xem [api-module](../../05-engineering/conventions/api-module.md).

CRUD thuật ngữ cá nhân; cung cấp glossary cho realtime và STT.

## Trách nhiệm

- CRUD
- Trả danh sách gọn cho prompt dịch và context biasing của STT

## Phạm vi MVP

- US-09

## Interface

- CRUD `/v1/glossary`

## Phụ thuộc

- (chưa có)

## Dữ liệu & sự kiện

- Bảng `glossary_terms`

## Câu hỏi mở

- (chưa có)
