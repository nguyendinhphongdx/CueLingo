---
title: Quan sát hệ thống
---

# Quan sát hệ thống

Log API là JSON có cấu trúc. Không ghi request body, token, cookie, email, transcript hoặc nội dung cuộc họp.

## Theo một request

API nhận `x-request-id` an toàn từ client (tối đa 64 ký tự) hoặc tự sinh UUID. Mọi phản hồi trả lại header này; body lỗi có `error.requestId`.

```bash
# Tìm toàn bộ log của một request trong công cụ thu thập log
requestId="desktop:meeting_42"
```

Gửi request id cho người vận hành khi báo lỗi. Không gửi token hoặc nội dung cuộc họp.

## Quyền xem số liệu nội bộ

Đặt danh sách email trong `.env`, phân cách bằng dấu phẩy:

```dotenv
ADMIN_EMAILS=owner@example.com,ops@example.com
```

- So khớp không phân biệt hoa thường.
- Thiếu hoặc để trống biến: mọi tài khoản nhận `403` từ API và thấy `404` ở web.
- `/admin/metrics` chỉ trả số tổng hợp, không trả email hoặc nội dung.

## Định nghĩa số liệu

| Số liệu                        | Cửa sổ / cách tính                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Người dùng hoạt động           | User có cuộc họp, event hoặc lượt ôn trong 7 ngày                                                                                                               |
| Người hoạt động (khu Quản trị) | Có ít nhất một phiên họp (không `deleted`) hoặc một lượt ôn trong 1, 7, 30 ngày trượt từ lúc gọi. **Không** tính `events`, nên khác `activeUsers7d` ở dòng trên |
| DAU/WAU/MAU họp                | `count(DISTINCT user_id)` của phiên họp không `deleted` trong 1, 7, 30 ngày                                                                                     |
| Ngày và tháng trong biểu đồ    | Ngày và tháng lịch giờ Việt Nam (`Asia/Ho_Chi_Minh`); riêng bảng phiên ôn 14 ngày ở trên theo UTC                                                               |
| Doanh thu                      | Đơn `paid` không phải của admin, gom theo ngày/tháng VN của `paid_at`; đơn 0đ của admin không tính                                                              |
| Tỉ lệ đơn được trả             | `paid` / mọi đơn không phải admin tạo trong 30 ngày (gồm `pending`); `null` khi 0 đơn                                                                           |
| Cuộc họp và giờ họp            | 7 và 30 ngày; giờ chỉ tính phiên đã kết thúc                                                                                                                    |
| Độ trễ debrief                 | Phút từ lúc kết thúc tới debrief đầu tiên, 30 ngày                                                                                                              |
| Chi phí AI / giờ               | Tổng `sessions.cost_usd` chia tổng giờ họp, 30 ngày                                                                                                             |
| Phiên ôn                       | Số user có lượt ôn theo từng ngày; 14 ngày gần nhất                                                                                                             |
| Debrief thành công             | Phiên đã kết thúc có debrief / tổng phiên kết thúc, 30 ngày                                                                                                     |

Số liệu giảm khi người dùng xoá dữ liệu hoặc tài khoản (cascade): đúng ý, dữ liệu đã xoá thì không tính. Trang admin cache ở API 60 giây ([admin-analytics](../04-modules/03-api/admin-analytics.md)).

Giá model nằm ở `packages/ai-gateway/src/pricing.ts`; kiểm lại khi đổi model hoặc bảng giá nhà cung cấp.
