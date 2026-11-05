---
title: Số liệu nội bộ
---

# Số liệu nội bộ

> Code: `apps/web/src/features/admin/`

## Trách nhiệm

- Hiện số liệu vận hành tổng hợp cho admin.
- Che sự tồn tại của trang với tài khoản không được phép bằng trang `404`.

## Phạm vi MVP

- Trang `/admin/metrics`; không có liên kết trong thanh bên.

## Interface

- Đọc `GET /v1/admin/metrics` qua web API client.
- Chỉ số chữ lớn, khối **Beta** (số chưa đủ dữ liệu hiện "Chưa đủ dữ liệu", không phải 0) và bảng phiên ôn 14 ngày; không biểu đồ.

## Phụ thuộc

- API admin metrics, `@cuelingo/shared`, `@cuelingo/ui`.

## Dữ liệu & sự kiện

- Không lưu dữ liệu. Không hiện định danh hoặc nội dung cuộc họp.

## Câu hỏi mở

- Chưa có.
