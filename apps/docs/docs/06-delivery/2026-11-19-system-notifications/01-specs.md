# system-notifications — Thông báo hệ thống khi app chạy nền

| Trạng thái | Loại    | Nhánh / PR                  | Ước lượng → thực tế |
| ---------- | ------- | --------------------------- | ------------------- |
| Spec       | feature | `feat/system-notifications` | _? → ?_             |

**Phạm vi:** trong: thông báo hệ thống (macOS, Windows) khi debrief tạo xong và khi micro/âm thanh hệ thống không mở được giữa cuộc họp, chỉ lúc cửa sổ app không ở phía trước · công tắc trong Cài đặt (mặc định bật) · bấm thông báo thì mở đúng chỗ · ngoài: nhắc ôn cụm từ, cảnh báo sắp hết hạn mức dịch, thông báo đẩy từ server, cài đặt riêng từng loại.

## 1. Vấn đề

CueLingo hay chạy nền: cửa sổ bị che bởi app họp, hoặc thu nhỏ xuống thanh menu. Hai việc xảy ra mà người dùng không biết nếu không mở app: debrief sau họp tạo xong (mất công mở lại để xem), và micro hoặc âm thanh hệ thống bị lỗi giữa họp (caption ngừng mà không ai thấy). Các app desktop khác báo những việc này bằng thông báo hệ thống.

- **Module chạm tới:** `04-modules/01-desktop` (tauri-core, session-controller, settings).
- **Quyền riêng tư:** nội dung thông báo là chữ cố định, không bao giờ chứa transcript, tên người, từ vựng hay tiêu đề cuộc họp.

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                                        | Test |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| AC1 | WHEN debrief của cuộc họp vừa xong tạo xong AND cửa sổ app không ở phía trước, THE SYSTEM SHALL hiện một thông báo hệ thống "Debrief đã sẵn sàng".        |      |
| AC2 | WHEN micro hoặc âm thanh hệ thống không mở được giữa cuộc họp AND cửa sổ app không ở phía trước, THE SYSTEM SHALL hiện thông báo nêu đúng luồng lỗi.      |      |
| AC3 | WHILE cửa sổ chính hoặc overlay đang ở phía trước (có focus), THE SYSTEM SHALL không hiện thông báo hệ thống (app đã tự hiện thông báo trong giao diện).  |      |
| AC4 | WHEN người dùng bấm thông báo, THE SYSTEM SHALL đưa cửa sổ chính lên trước và mở trang liên quan (debrief của cuộc họp đó; cài đặt quyền với lỗi thu âm). |      |
| AC5 | THE SYSTEM SHALL có một công tắc "Thông báo hệ thống" trong Cài đặt, mặc định bật; WHILE tắt, THE SYSTEM SHALL không hiện thông báo nào.                  |      |
| AC6 | IF hệ thống chưa cấp quyền thông báo, THEN THE SYSTEM SHALL xin quyền một lần khi bật lần đầu và, nếu bị từ chối, nói rõ trong Cài đặt thay vì im lặng.   |      |
| AC7 | THE SYSTEM SHALL chỉ dùng chữ cố định trong thông báo và trong log; không đưa transcript, tên, tiêu đề cuộc họp hay nội dung từ vựng vào đó.              |      |
| AC8 | Mỗi sự kiện chỉ hiện tối đa một thông báo (cùng lỗi lặp lại hay debrief mở lại không báo thêm).                                                           |      |

## 3. Câu hỏi mở

- [ ] Công tắc nằm ở mục nào trong Cài đặt? Mặc định: cạnh các lựa chọn ứng dụng chung (không tạo mục mới).
- [ ] Có lưu công tắc trong tài khoản (đồng bộ máy khác) hay chỉ trên máy này? Mặc định: chỉ trên máy này, như cỡ chữ overlay.
- [ ] Thông báo hết hạn mức dịch có cần không? Mặc định: không, để sau.

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                         |
| ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-19 | Spec | Mở hồ sơ. Người dùng chọn: có công tắc, mặc định bật. Loại thông báo: bắt đầu với hai loại.                                                           |
| 2026-11-20 | Plan | AC4 đổi: plugin desktop không có callback bấm, nên hệ điều hành đưa app lên trước và app điều hướng khi cửa sổ chính lấy lại focus (nhớ đích 2 phút). |
