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

## Phân quyền

| Vai trò                            | Thấy gì                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Learner                            | Toàn bộ dữ liệu của mình                                                     |
| Team admin / L&D (giai đoạn Scale) | Chỉ số tổng hợp, ẩn danh; **không** xem transcript hay câu nói của nhân viên |
| Nhân viên vận hành                 | Không truy cập transcript, trừ khi người dùng gửi kèm báo cáo lỗi            |

## Mã mời (beta kín)

- Tài khoản mới cần mã mời hợp lệ ở mọi đường đăng ký (email, Google, desktop qua web). Mã lưu dạng SHA-256, hiện bản rõ một lần cho admin, ~60 bit ngẫu nhiên, giới hạn 10 lần thử/10 phút/IP, mọi lý do từ chối dùng chung một thông báo.
- Cookie `cl_invite`: httpOnly, `SameSite=Lax`, `Secure` ở production, sống 30 phút; header `cookie` bị che trong log.

## Pháp lý

- Chính sách quyền riêng tư và điều khoản theo Nghị định 13/2023/NĐ-CP (Việt Nam) và GDPR (nếu có người dùng EU), phải xong trước beta.
- Mẫu đồng ý dữ liệu riêng cho beta: nêu rõ dữ liệu nào được xem để cải thiện sản phẩm.
- Ghi công license model: Parakeet (CC-BY-4.0). Tránh model và thư viện NC/AGPL/GPL theo [khảo sát open source](../07-research/01-open-source.md).
