# Progress

> Phần: [Web app](./README.md) · Code: `apps/web/src/features/progress/`

Tiến bộ theo tuần: % hiểu, số cụm đã học, streak.

## Trách nhiệm

- Biểu đồ % hiểu theo tuần
- Số cụm receptive/productive
- Gợi ý hạ Assist level

## Phạm vi MVP

- US-14 (F6)

## Interface

- `GET /v1/progress?range=12w`

## Phụ thuộc

- (chưa có)

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- (chưa có)

## Là một tab của Ôn tập

Hiện là tab **Tiến độ** của [Ôn tập](./review.md#ba-tab-hôm-nay-kho-cụm-từ-tiến-độ); `/progress` chuyển hướng tới `/review?tab=progress`. Feature xuất `ProgressPanel({ language })`, các số tổng quan dùng `StatCard`/`StatGrid` của `@cuelingo/ui`.
