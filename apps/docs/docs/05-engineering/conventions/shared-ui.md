---
title: Giao diện dùng chung
sidebar_position: 12
---

# Giao diện dùng chung

**Luật:** cái gì hiện ở hơn một client thì nằm ở `packages/ui` và được viết một lần. Web, desktop và overlay chỉ dùng, không tự vẽ lại. Ví dụ đã từng lệch: hai nơi vẽ hai kiểu avatar và hai kiểu nút đăng xuất cho cùng một người dùng.

## Cái gì thuộc về `@cuelingo/ui`

| Loại                 | Có sẵn                                                              |
| -------------------- | ------------------------------------------------------------------- |
| Định danh người dùng | `Avatar`, `PersonRow`, `AccountChip`                                |
| Điều khiển           | `Button`, `IconButton`, `Input`, `Segmented`, `Kbd`                 |
| Khung và điều hướng  | `AppFrame`, `SidebarNav`, `PageHeader`, `Section`, `ListCard`       |
| Trạng thái           | `ComingSoon`, `SoonBadge`, `CaptionLine`                            |
| Thương hiệu          | `Logo`, token ở `brand.css`, danh sách tính năng ở `lib/roadmap.ts` |

## Khi thêm giao diện mới

1. Tìm trong `packages/ui/src/components` trước. Có rồi thì dùng.
2. Có gần giống? Thêm một tuỳ chọn (prop) cho component đó thay vì viết bản mới.
3. Chưa có và sẽ hiện ở ít nhất hai nơi (hoặc là một phần của hệ thống thiết kế)? Viết ở `packages/ui`, có tên, có kiểu, có test.
4. Chỉ hiện ở một màn hình của một client và gắn chặt với dữ liệu của nó (ví dụ khối caption)? Để ở feature của client.

## Máy kiểm

`packages/ui/src/shared-ui.test.ts` đọc mọi component đã xuất ở `packages/ui/src/components` rồi quét `apps/web/src` và `apps/desktop/src`: nếu client **định nghĩa** một hàm hoặc hằng trùng tên với component chung thì test đỏ. Lỗi ghi rõ file và tên.

Test chỉ bắt trùng tên. Hai component khác tên mà làm cùng một việc thì phải để ý ở bước review ([checklist](./code-review.md)).
