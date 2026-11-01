# Account & privacy

> Phần: [Web app](./README.md) · Code: `apps/web/src/features/account/`

Cài đặt tài khoản, quyền riêng tư, xoá dữ liệu.

## Trách nhiệm

- Xoá một cuộc họp từ trang chi tiết sau bước xác nhận
- Xoá toàn bộ dữ liệu sau hai bước xác nhận, giữ tài khoản
- Tải dữ liệu cá nhân dạng JSON

## Phạm vi MVP

- US-15

## Interface

- `DELETE /v1/sessions/:id`
- `DELETE /v1/me/data` với chuỗi xác nhận `XOA DU LIEU`
- `GET /v1/me/export`

## Phụ thuộc

- API `privacy`, thư viện cuộc họp và debrief

## Dữ liệu & sự kiện

- Hiện trạng thái đang xoá, lỗi và thành công; làm mới cache sau khi xoá

## Câu hỏi mở

- (chưa có)
