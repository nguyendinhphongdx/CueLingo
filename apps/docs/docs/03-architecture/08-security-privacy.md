# Bảo mật & quyền riêng tư

Dữ liệu họp là dữ liệu nhạy cảm của doanh nghiệp người dùng, nên mặc định thu thập ít nhất có thể: **không lưu audio**, ưu tiên STT trên máy, người dùng xoá được mọi thứ.

## Nguyên tắc

| Nguyên tắc                 | Hiện thực                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Thu ít nhất                | STT on-device. Chỉ gửi văn bản câu final lên server. Audio chỉ rời máy khi người dùng chọn STT cloud |
| Không lưu audio mặc định   | Bật lưu audio → lưu từng đoạn, tự xoá sau 30 ngày (workers/retention)                                |
| Người dùng kiểm soát       | Xoá một phiên (cascade), xoá tài khoản, xuất dữ liệu (api/privacy)                                   |
| Minh bạch với người dự họp | Nhắc người dùng thông báo khi bật Copilot; ghi trạng thái consent vào `sessions.consent`             |
| Nhà cung cấp AI            | Chỉ dùng gói API cam kết không huấn luyện trên dữ liệu khách hàng / zero-retention khi có            |
| Mã hoá                     | TLS khi truyền, mã hoá khi lưu; token lưu trong Keychain trên desktop                                |
| Overlay                    | Loại khỏi screen capture để không lộ khi chia sẻ màn hình                                            |

## Hội thoại với trợ lý AI

- Nội dung hội thoại (`agent_conversations`, `agent_messages`: chữ người dùng gõ, câu trả lời, bước công cụ, thẻ) được **lưu trên server** theo `userId`, chỉ chủ sở hữu đọc được. Xoá hội thoại ẩn ngay và xoá hẳn sau 7 ngày (workers/retention); xoá tài khoản hoặc `DELETE /v1/me/data` xoá tất cả ngay.
- Để trả lời, **nội dung tin nhắn, lịch sử gần đây và kết quả công cụ (vd. cụm từ đã lưu) được gửi tới Google Gemini** qua `@cuelingo/ai-gateway`. Chỉ dùng gói API cam kết không huấn luyện trên dữ liệu khách hàng. Dùng agent là tự nguyện: tính năng sau cờ `AGENT_ENABLED`.
- Log chỉ ghi id và số đếm, không ghi nội dung tin nhắn, output công cụ hay lỗi gốc của nhà cung cấp.
- **Mã do AI sinh ra** ([ADR 0019](../08-adr/0019-ai-generated-ui.md), sau cờ `AGENT_HTML_BLOCKS`, mặc định tắt): chạy trong sandbox runner ở origin riêng (`infra/sandbox-runner`), iframe `sandbox="allow-scripts"` không `allow-same-origin`, CSP bằng header HTTP (`connect-src 'none'`, `form-action 'none'`, `frame-src 'self' about:`), cầu nối `postMessage` chỉ sáu thao tác, ghi dữ liệu luôn cần người dùng xác nhận. Khối không nhận token, cookie hay URL API; đọc cụm từ chỉ trả `phrase` và `meaningVi`. Kiểm tĩnh phía API chỉ là lớp phụ. Runner phải ở **domain khác site** với web khi lên production nếu muốn chắc về cô lập tiến trình (đã kiểm trên Chrome: cả cùng site lẫn khác site đều không làm treo trang chat, WKWebView chưa kiểm).
- Chính sách quyền riêng tư (khi viết, xem mục Pháp lý) phải nêu: có lưu hội thoại, gửi nội dung tới Gemini, thời hạn lưu và cách xoá. Repo chưa có trang chính sách nên chưa sửa được ở đây.

## Lượng dùng và gói

- `usage_counters` chỉ lưu con số (giây, số lần) gắn với `user_id`; không log nội dung câu hay âm thanh khi đếm.
- `DELETE /v1/me/data` **không** xoá counter và gói (để hạn mức tháng không bị đặt lại), xoá tài khoản thì xoá ([ADR 0022](../08-adr/0022-usage-survives-data-delete.md)). Chính sách quyền riêng tư phải nêu điều này.

## Phân quyền

| Vai trò                            | Thấy gì                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Learner                            | Toàn bộ dữ liệu của mình                                                                                                                                                                                                                                                                                                                   |
| Team admin / L&D (giai đoạn Scale) | Chỉ số tổng hợp, ẩn danh; **không** xem transcript hay câu nói của nhân viên                                                                                                                                                                                                                                                               |
| Nhân viên vận hành                 | Không truy cập transcript, trừ khi người dùng gửi kèm báo cáo lỗi                                                                                                                                                                                                                                                                          |
| Admin vận hành (`ADMIN_EMAILS`)    | Email, tên, ngày đăng ký, gói, lượng dùng tháng, lần họp gần nhất và đơn thanh toán của **mọi** người dùng (trang `/admin/users`); số liệu tổng hợp ở `/admin` (Tổng quan), `/admin/revenue`, `/admin/usage`, `/admin/metrics` (chỉ số tổng, không định danh). **Không** thấy tiêu đề phiên, transcript, cụm từ, mã QR hay link thanh toán |

### Admin xem số liệu tổng hợp

Bốn trang Tổng quan, Doanh thu, Lượng dùng, Hoạt động app ([admin-analytics](../04-modules/03-api/admin-analytics.md)) chỉ trả số tổng, không có email, id hay nội dung cuộc họp; từ bảng `events` chỉ đọc `cost_usd`, không đọc `payload`. Ở quy mô nhỏ, một số rất nhỏ (ví dụ "1 người Ultra") có thể chỉ ra một người, nhưng admin vốn đã thấy định danh ở `/admin/users`. `GET /v1/admin/me` chỉ cho người gọi biết chính họ có phải admin. Thanh bên lưu `localStorage` chỉ id nhóm đang thu gọn, không có dữ liệu người dùng.

### Admin xem danh sách người dùng

Trang `/admin/users` ([admin-users](../04-modules/03-api/admin-users.md)) là chỗ duy nhất hiện email của người dùng khác; cần để hỗ trợ và đổi gói đúng người.

- Chỉ email trong `ADMIN_EMAILS`; mọi route kiểm quyền trước khi đọc đầu vào. Câu trả lời đi qua schema strict nên không có trường nội dung.
- Rủi ro còn lại: tài khoản admin bị chiếm thì lộ email hàng loạt. Giảm thiểu: mỗi trang 50 dòng, không xuất CSV, không có route ghi ngoài đổi gói.
- Log đổi gói chỉ có id (admin, người bị đổi), gói cũ, gói mới, hạn; không có email. Đổi gói có nhật ký, đọc thì không.
- Chính sách quyền riêng tư công khai (`apps/site`) chưa sửa trong task này; cần nêu việc admin xem email khi cập nhật.

## Mã mời (beta kín)

- Tài khoản mới cần mã mời hợp lệ ở mọi đường đăng ký (email, Google, desktop qua web). Mã lưu dạng SHA-256, hiện bản rõ một lần cho admin, ~60 bit ngẫu nhiên, giới hạn 10 lần thử/10 phút/IP, mọi lý do từ chối dùng chung một thông báo.
- Cookie `cl_invite`: httpOnly, `SameSite=Lax`, `Secure` ở production, sống 30 phút; header `cookie` bị che trong log.

## Pháp lý

- Chính sách quyền riêng tư và điều khoản theo Nghị định 13/2023/NĐ-CP (Việt Nam) và GDPR (nếu có người dùng EU), phải xong trước beta.
- Mẫu đồng ý dữ liệu riêng cho beta: nêu rõ dữ liệu nào được xem để cải thiện sản phẩm.
- Ghi công license model: Parakeet (CC-BY-4.0). Tránh model và thư viện NC/AGPL/GPL theo [khảo sát open source](../07-research/01-open-source.md).

## Bài học theo mục tiêu

Câu luyện gõ được gửi tới Gemini để nhận xét rồi bỏ: không lưu, không log (chỉ id, kết luận, số đếm). Thuật ngữ cá nhân của người dùng (glossary, Phrase Bank) cũng được gửi tới Gemini, trong khối không tin cậy, chỉ để viết ví dụ cá nhân; sinh nội dung bài dùng chung thì không gửi gì của người dùng. Nội dung bài dùng chung không chứa dữ liệu người dùng. Xoá dữ liệu cá nhân xoá mục tiêu, tiến độ, báo lỗi của người đó và không đụng nội dung chung. Xem [ADR 0025](../08-adr/0025-goal-lessons-shared-content.md).
