---
title: Hoạt động app
---

# Hoạt động app (số liệu nội bộ)

> Code: `apps/web/src/features/admin/`

## Trách nhiệm

- Hiện số liệu vận hành tổng hợp cho admin.
- Che sự tồn tại của trang với tài khoản không được phép bằng trang `404`.

## Phạm vi MVP

- Trang `/admin/metrics` (URL giữ nguyên, nhãn "Hoạt động app") nằm trong khung app chung, mục **Hoạt động app** của nhóm Quản trị: xem [Khu Quản trị](./admin-console.md). Bị `401/403` thì trang gọi `notFound()`.

## Interface

- Đọc `GET /v1/admin/analytics/activity` (trong đó có `metrics` = đúng `GET /v1/admin/metrics`), qua `client.admin.analytics.activity()`. Web không gọi `/v1/admin/metrics` trực tiếp nữa; route đó vẫn giữ cho tương thích.
- Số người họp DAU/WAU/MAU (tính theo phiên họp), biểu đồ cuộc họp và giờ họp theo ngày (30 ngày), rồi các chỉ số cũ: chữ lớn, khối **Beta** (số chưa đủ dữ liệu hiện "Chưa đủ dữ liệu", không phải 0) và bảng phiên ôn 14 ngày.

## Phụ thuộc

- API admin metrics, `@cuelingo/shared`, `@cuelingo/ui`.

## Dữ liệu & sự kiện

- Không lưu dữ liệu. Không hiện định danh hoặc nội dung cuộc họp.

## Câu hỏi mở

- Chưa có.
