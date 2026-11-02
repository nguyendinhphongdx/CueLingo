---
title: Mô hình kinh doanh & chỉ số
---

# Mô hình kinh doanh & chỉ số

**North Star:** số phút giao tiếp thật mà người dùng tự xử lý ở **Assist level ≤ 2** mỗi tuần. Chỉ số này chỉ tăng khi người dùng vừa dùng nhiều vừa tiến bộ.

## Gói dịch vụ

| Gói                   | Dành cho           | Bao gồm                                                                                                                                            |
| --------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Free**              | Dùng thử           | Vài giờ Copilot/tháng, Phrase Bank, SRS cơ bản, debrief rút gọn                                                                                    |
| **Pro**               | Cá nhân            | Copilot nhiều giờ hơn, debrief đầy đủ, briefing và follow-up, Daily Mix, Speech Coach                                                              |
| **Pro+**              | Cá nhân dùng nhiều | Roleplay persona, voice mode, podcast cá nhân, nhiều ngôn ngữ, tutor                                                                               |
| **Team / Enterprise** | Doanh nghiệp       | **Sau cổng B2C** (xem [lộ trình](./04-roadmap.md#điều-kiện-mở-các-hướng-ở-đợt-4)): theo seat, glossary công ty, dashboard L&D, SSO, on-premise/VPC |
| **Add-on**            | Tuỳ chọn           | Human coach review, luyện thi chứng chỉ                                                                                                            |

Hướng đi hiện tại là **B2C trước** (2026-11-02): Free và Pro là hai gói cần có ở Đợt 2; Pro+ và Team chỉ làm khi có số liệu. Phần chia tính năng giữa Free và Pro ở trên là **giả định**, chưa chốt.

Giá và giới hạn Free chốt sau khi đo chi phí AI thực tế/giờ họp trong beta (giả thuyết H5 ở [Phạm vi MVP](./03-mvp-scope.md)). Beta kín miễn phí hoặc thu tay. Nhà cung cấp thanh toán cần ADR và hỏi người trước khi chọn.

## Chỉ số

| Nhóm       | Chỉ số                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Học tập    | % hiểu trong họp thật · Assist level trung bình · CEFR theo kỹ năng · số cụm productive mới/tháng · độ chính xác phát âm · thời gian phản xạ |
| Tương tác  | Số cuộc họp/tuần có Copilot · tỷ lệ mở debrief · tỷ lệ hoàn thành phiên ôn · streak · tỷ lệ cuộc họp có mở briefing hoặc follow-up           |
| Kích hoạt  | Thời gian từ cài tới caption đầu tiên · tỷ lệ người cài có cuộc họp đầu tiên trong 7 ngày · D1/D7                                            |
| Phễu B2C   | Free → trả phí · tỷ lệ chạm quota · chi phí AI/giờ họp so với doanh thu/giờ họp · churn theo tháng                                           |
| Kinh doanh | Retention D30/D90 · chuyển đổi free → trả phí · chi phí AI/user/tháng · seat B2B đang hoạt động                                              |
| Chất lượng | Độ trễ caption p50/p95 · lỗi dịch thuật ngữ · điểm hài lòng debrief                                                                          |

Event dùng để đo: catalog trong [Mô hình dữ liệu](../03-architecture/07-data-model.md#catalog-event-mvp).

## Cạnh tranh

| Nhóm đối thủ            | Ví dụ                     | Họ làm tốt                                  | CueLingo khác ở                                         |
| ----------------------- | ------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| Dịch trong nền tảng họp | Google Meet, Teams, Zoom  | Tích hợp sẵn, miễn phí với gói doanh nghiệp | Chạy trên mọi app; có phần nói và phần học; cá nhân hoá |
| Phiên dịch hội nghị     | Wordly, KUDO, Interprefy  | Sự kiện lớn, nhiều ngôn ngữ                 | Dành cho cá nhân trong họp hằng ngày                    |
| Ghi chép họp            | Otter, Fireflies, Granola | Transcript, tóm tắt                         | Hỗ trợ ngay trong lúc họp; biến cuộc họp thành bài học  |
| App học ngôn ngữ        | Duolingo, ELSA, Speak     | Nội dung, gamification, phát âm             | Nội dung là cuộc họp thật của người dùng                |

## Rủi ro

| Rủi ro                                                                               | Mức        | Giảm thiểu                                                                    |
| ------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------- |
| Pháp lý ghi âm / quyền riêng tư (Nghị định 13/2023, GDPR, chính sách của khách hàng) | Cao        | Thông báo người dự họp, không lưu audio mặc định, xử lý trên máy, DPA cho B2B |
| Nền tảng họp tích hợp sẵn dịch                                                       | Cao        | Khác biệt ở phần học và cá nhân hoá, chạy trên mọi nền tảng                   |
| Chi phí AI realtime                                                                  | Trung bình | STT on-device, VAD, routing model, giới hạn theo gói                          |
| Người dùng chỉ dùng Copilot, không học                                               | Trung bình | Debrief tự sinh bài, bài ôn dưới 5 phút, tiến bộ nhìn thấy được               |
| Dịch sai trong tình huống quan trọng                                                 | Trung bình | Luôn hiện câu gốc, glossary, đánh dấu độ tin cậy                              |
