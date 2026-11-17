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

## Xoá toàn bộ dữ liệu: hai bước

Nút "Xoá toàn bộ dữ liệu" mở `DeleteDataSteps` (`@cuelingo/ui/components/delete-data-steps`, dùng chung với desktop). Bước 1 trên 2 liệt kê những gì sẽ mất (`DELETE_DATA_ITEMS`, khớp `deleteMyData` ở API: cuộc họp, cụm từ và lịch ôn, thuật ngữ, hội thoại với trợ lý AI, số liệu); bước 2 trên 2 yêu cầu gõ đúng `XOA DU LIEU`, nút xoá chỉ bật khi khớp từng ký tự, và focus bắt đầu ở nút **Huỷ** để một lần Enter lỡ tay không xoá. Test: `packages/ui/src/components/delete-data-steps.test.tsx`.

## Liên kết app (`/app-auth`)

`AppAuthPage` kiểm phiên, rồi hỏi "Cho CueLingo trên máy này vào tài khoản?" với **Không phải tôi, huỷ** (focus mặc định) và **Cho phép**. Mã dùng một lần (`device.createCode`) chỉ được tạo sau khi bấm Cho phép; huỷ thì không có mã nào được tạo hay chuyển cho app. Test: `apps/web/src/features/auth/AppAuthPage.consent.test.tsx`.
