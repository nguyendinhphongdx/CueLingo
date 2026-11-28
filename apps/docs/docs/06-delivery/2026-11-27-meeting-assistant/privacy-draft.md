# Nháp — đoạn chính sách quyền riêng tư cho trợ lý trong cuộc họp

**Trạng thái:** nháp, chưa công bố, chưa qua người có chuyên môn pháp lý. Repo chưa có trang chính sách ([backlog W2-06](../../02-product/06-backlog.md)); đoạn này để ghép vào trang đó khi viết.

## Đoạn cho người dùng

### Trợ lý trong cuộc họp (tuỳ chọn)

Bạn có thể hỏi CueLingo về điều đang được bàn trong cuộc họp. Tính năng này chỉ chạy khi bạn đã đồng ý riêng, và chỉ gửi dữ liệu khi bạn đặt câu hỏi.

**Khi bạn hỏi, những phần sau được gửi tới Google (Gemini) để soạn câu trả lời:**

- câu hỏi của bạn và câu trong phụ đề mà bạn chỉ vào (nếu có);
- một phần transcript của cuộc họp đang diễn ra: đoạn mới nhất và các đoạn liên quan đến câu hỏi, kèm tên người nói. Phần này **gồm lời của những người khác trong cuộc họp**;
- thuật ngữ và cụm từ bạn đã lưu, nếu chúng xuất hiện trong câu hỏi hoặc đoạn transcript được gửi;
- trích đoạn của tối đa ba cuộc họp trước của bạn (tiêu đề, ngày, dòng tóm tắt, vài câu liên quan), tìm trong các cuộc họp 180 ngày gần đây;
- tối đa ba câu hỏi và câu trả lời gần nhất của cuộc họp đó.

Không gửi âm thanh. Cuộc họp bạn đã xoá không được dùng để trả lời.

**Chúng tôi lưu gì:** câu hỏi, câu trả lời và danh sách nguồn, gắn với cuộc họp và chỉ tài khoản của bạn truy cập được; lựa chọn đồng ý của bạn và thời điểm đồng ý; số lượt hỏi đã dùng. Nhật ký kỹ thuật chỉ ghi mã định danh, số đếm và thời gian xử lý, không ghi nội dung.

**Lưu đến khi nào và xoá thế nào:**

| Bạn làm gì               | Hỏi đáp                        | Lựa chọn đồng ý | Số lượt đã dùng |
| ------------------------ | ------------------------------ | --------------- | --------------- |
| Xoá một cuộc họp         | Xoá hẳn sau khoảng 7 ngày      | Giữ             | Giữ             |
| "Xoá toàn bộ dữ liệu"    | Xoá ngay                       | Xoá ngay        | Giữ             |
| Xoá tài khoản            | Xoá                            | Xoá             | Xoá             |
| Rút lại đồng ý (Cài đặt) | Giữ, không gửi thêm gì khi rút | Xoá             | Giữ             |

Nếu bạn không xoá, hỏi đáp được giữ cùng cuộc họp. Bản tải dữ liệu từ ứng dụng hoặc web gồm cả hỏi đáp. Hiện chưa có màn hình xem lại hay xoá riêng từng câu.

**Người cùng họp:** sự đồng ý ở trên là của bạn, không thay cho người khác. Hãy báo cho người cùng họp khi pháp luật hoặc quy định nơi bạn làm việc yêu cầu.

**Câu trả lời có thể sai.** Phần ghi "Kiến thức chung (chưa kiểm chứng)" không lấy từ dữ liệu của bạn.

## Phải chốt trước khi công bố

Các mục này repo không trả lời được, nên đoạn trên **không khẳng định** gì về chúng.

| #   | Cần chốt                                                                                                         | Ai        |
| --- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Gói Gemini API đang dùng có cam kết không huấn luyện trên dữ liệu không; Google giữ dữ liệu bao lâu              | Chủ dự án |
| 2   | Chuyển dữ liệu ra nước ngoài: nghĩa vụ theo Nghị định 13/2023/NĐ-CP (và GDPR nếu có người dùng EU)               | Pháp lý   |
| 3   | Đơn vị chịu trách nhiệm, địa chỉ liên hệ, thời hạn phản hồi yêu cầu                                              | Chủ dự án |
| 4   | Bản sao lưu cơ sở dữ liệu giữ bao lâu (ảnh hưởng câu "xoá ngay")                                                 | Chủ dự án |
| 5   | Số lượt đã dùng được giữ sau "Xoá toàn bộ dữ liệu" ([ADR 0022](../../08-adr/0022-usage-survives-data-delete.md)) | Pháp lý   |

## Lời đồng ý trong app

`CONSENT_TEXT` (`apps/desktop/src/quick-assist/MeetingAskPanel.tsx`, dùng cả ở Cài đặt) đã sửa cho khớp đoạn trên: nêu thêm tên người nói, lời người khác và hỏi đáp trước; nói rõ xoá theo cuộc họp hoặc toàn bộ dữ liệu. Phiên bản giữ `meeting-assist@v1` vì tính năng chưa bật nên chưa ai đồng ý. Sau khi bật, đổi lời văn phải tăng phiên bản.

## Đối chiếu với code

| Khẳng định                     | Chỗ trong code                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Dữ liệu gửi đi                 | `services/api/src/modules/meeting-assist/meeting-assist.context.ts`, `retrieval.ts`                |
| Xoá theo cuộc họp, 7 ngày      | khoá ngoại ở migration `20261127090000`; [job retention](../../04-modules/04-workers/retention.md) |
| Xoá dữ liệu, xuất              | `services/api/src/modules/privacy/`                                                                |
| Rút đồng ý chỉ xoá dòng đồng ý | `meeting-assist.repository.ts` (`revokeConsent`)                                                   |
