# Glossary

> Phần: [Web app](./README.md) · Code: `apps/web/src/features/glossary/`

> **Module mẫu** của tầng này (`apps/web/src/features/glossary/`). Module mới copy cấu trúc từ đây — xem [web-feature](../../05-engineering/conventions/web-feature.md).

Quản lý thuật ngữ và tên riêng dùng cho STT và dịch.

## Trách nhiệm

- Thêm/sửa/xoá thuật ngữ
- Dán danh sách hàng loạt

## Phạm vi MVP

- US-09

## Interface

- CRUD `/v1/glossary`

## Phụ thuộc

- (chưa có)

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- (chưa có)

## Thêm nhanh và dán hàng loạt

Nút **Dán nhiều thuật ngữ** mở một ô văn bản: mỗi dòng một thuật ngữ, cách dịch (tuỳ chọn) đứng sau Tab, `-`, `|`, `=` hoặc `;`. `parseBulkTerms` (`bulk.ts`, hàm thuần) bỏ dòng trống, trùng (kể cả với thuật ngữ đã có) hoặc quá giới hạn độ dài, và chỉ lấy tối đa 50 dòng mỗi lần. Thêm lần lượt bằng `POST /v1/glossary` (không có endpoint hàng loạt); lỗi dừng ở dòng lỗi và giữ lại phần chưa thêm trong ô.
