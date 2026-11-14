---
title: Mô hình kinh doanh & chỉ số
---

# Mô hình kinh doanh & chỉ số

**North Star:** số phút giao tiếp thật mà người dùng tự xử lý ở **Assist level ≤ 2** mỗi tuần. Chỉ số này chỉ tăng khi người dùng vừa dùng nhiều vừa tiến bộ.

## Gói dịch vụ

| Gói                   | Dành cho           | Bao gồm                                                                                                                                            |
| --------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Free**              | Dùng thử           | Caption tiếng Anh không giới hạn, vài giờ dịch/tháng, Phrase Bank, SRS cơ bản, debrief rút gọn                                                     |
| **Pro**               | Cá nhân            | Copilot nhiều giờ hơn, debrief đầy đủ, briefing và follow-up, Daily Mix, Speech Coach                                                              |
| **Ultra**             | Cá nhân dùng nhiều | Roleplay persona, voice mode, podcast cá nhân, nhiều ngôn ngữ, tutor                                                                               |
| **Team / Enterprise** | Doanh nghiệp       | **Sau cổng B2C** (xem [lộ trình](./04-roadmap.md#điều-kiện-mở-các-hướng-ở-đợt-4)): theo seat, glossary công ty, dashboard L&D, SSO, on-premise/VPC |
| **Add-on**            | Tuỳ chọn           | Human coach review, luyện thi chứng chỉ                                                                                                            |

Hướng đi hiện tại là **B2C trước** (2026-11-02): Free và Pro là hai gói cần có ở Đợt 2; Ultra và Team chỉ làm khi có số liệu. Phần chia tính năng giữa Free và Pro ở trên là **giả định**, chưa chốt; đề xuất cụ thể ở [Phân tích gói](#phân-tích-gói-đề-xuất-chưa-chốt).

Giá và giới hạn Free chốt sau khi đo chi phí AI thực tế/giờ họp trong beta (giả thuyết H5 ở [Phạm vi MVP](./03-mvp-scope.md)). Beta kín miễn phí hoặc thu tay. Nhà cung cấp thanh toán cần ADR và hỏi người trước khi chọn.

## Chi phí AI ước tính / giờ họp

**Ước tính ngày 2026-11-14.** Production chưa có lượt gọi AI nào. Số liệu được tính từ bảng giá trong `packages/ai-gateway/src/pricing.ts` (Gemini Flash-Lite: vào 0,25 · ra 1,5 · audio 0,5 USD/1M token; audio tính 32 token/giây) và cách định tuyến tác vụ trong `packages/ai-gateway/src/tasks.ts`. Khi beta có dữ liệu, thay bằng số đo thật từ event `ai_call` (`cost_usd`) và `sessions.cost_usd`.

| Tác vụ                                         | Giả định                                 | USD/giờ     |
| ---------------------------------------------- | ---------------------------------------- | ----------- |
| STT tiếng Anh                                  | Parakeet chạy trên máy (FluidAudio)      | **0**       |
| Dịch caption Anh → Việt (`translate.realtime`) | ~450 câu/giờ · 400–800 token vào · 30 ra | 0,07–0,12   |
| Debrief (`debrief.generate`)                   | 1 lần/cuộc họp · ~11k vào · ~1,5k ra     | ~0,005      |
| Tra từ · recap · compose (`assist.*`)          | Vài chục lần · ~0,0002 USD/lần           | ~0,005      |
| STT đám mây cho vi/ja/ko/zh (`stt.transcribe`) | 2 luồng · ~60% thời gian có tiếng nói    | 0,10–0,15   |
| Trợ lý chat (`agent.chat`)                     | ~0,0015 USD/tin                          | theo số tin |

→ Một giờ họp tiếng Anh tốn **~0,08–0,13 USD**, gần như toàn bộ là phần dịch. Chi phí cố định (API trên Mac + Cloudflare Tunnel, Resend gói miễn phí) gần bằng 0 ở quy mô beta.

## Phân tích gói (đề xuất, chưa chốt)

**Nguyên tắc:** chỉ đặt hạn mức cho thứ **tốn tiền phía server**: dịch, STT đám mây, debrief, trợ lý, lưu trữ. Caption tiếng Anh chạy trên máy, không tốn gì, nên **không giới hạn ở mọi gói**. Đây là mồi cho Free và là điểm khác đối thủ (họ tính phút cho cả phần nhận dạng).

| Hạng mục                         | Free                      | Pro                                 | Ultra (để sau) |
| -------------------------------- | ------------------------- | ----------------------------------- | -------------- |
| Caption tiếng Anh (trên máy)     | Không giới hạn            | Không giới hạn                      | Không giới hạn |
| Dịch Anh → Việt                  | **2 giờ/tháng**           | 20 giờ/tháng (chống lạm dụng)       | 60 giờ/tháng   |
| STT đám mây (vi/ja/ko/zh)        | 1 giờ/tháng               | 10 giờ/tháng                        | 30 giờ/tháng   |
| Debrief                          | Rút gọn · **8 bản/tháng** | Đầy đủ + follow-up · không giới hạn | Đầy đủ         |
| Tra từ · Nói giúp tôi            | 20 lần/ngày               | Thoải mái                           | Thoải mái      |
| Phrase Bank · SRS (không gọi AI) | Có                        | Có                                  | Có             |
| Trợ lý chat                      | Không                     | 100 tin/tháng                       | 500 tin/tháng  |
| Lịch sử cuộc họp (transcript)    | **Giữ 30 ngày**           | Giữ mãi                             | Giữ mãi        |
| Giá (giả định)                   | 0                         | 99–129k ₫/tháng (~4–5 USD)          | ~249k ₫/tháng  |
| Chi phí AI tối đa/người/tháng    | ~0,4 USD                  | ~2,9 USD                            | ~8,5 USD       |

**Lý do hai hạn mức của Free:**

- **Debrief 8 bản/tháng:** debrief tự chạy sau mỗi cuộc họp và có gọi AI. Người chỉ dùng caption miễn phí vẫn tạo ra chi phí này, nên cần có trần.
- **Lịch sử 30 ngày:** transcript được lưu ở server (module `sessions`), khoảng 50–80 KB mỗi giờ. Con số nhỏ, nhưng không có trần thì dung lượng tăng mãi theo số người dùng Free. Cụm từ đã lưu vào Phrase Bank không bị xoá.

**Kiểm tra lỗ lãi** (giả định tỷ giá ~25k ₫/USD, phí thanh toán ~5%):

| Trường hợp                          | Thu      | Chi AI    | Còn lại   |
| ----------------------------------- | -------- | --------- | --------- |
| Pro dùng hết hạn mức                | ~4,6 USD | ~2,9 USD  | ~1,7 USD  |
| Pro dùng trung bình (8–12 giờ dịch) | ~4,6 USD | ~1,3 USD  | ~3,3 USD  |
| Free dùng trung bình (~1 giờ dịch)  | 0        | ~0,15 USD | −0,15 USD |

Để hoà vốn, chỉ cần khoảng **3–4%** người Free chuyển sang Pro, khớp với cổng Đợt 2 (free → trả phí ≥ 3%).

## Câu hỏi mở về gói

| Câu hỏi                   | Đề xuất                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Đơn vị hạn mức            | Giờ dịch và giờ STT đám mây, không đếm giờ dùng app                                                  |
| Hết hạn mức giữa cuộc họp | Báo trước khi còn 10 phút; khi hết vẫn giữ caption tiếng Anh, chỉ dừng phần dịch, không cắt cuộc họp |
| Thời điểm áp dụng         | Áp hạn mức Free ngay trong beta (vì đăng ký đang mở); gói trả phí và thanh toán để Đợt 2             |
| Xoá lịch sử sau 30 ngày   | Đây là xoá dữ liệu người dùng: cần spec riêng, báo trước cho người dùng, hỏi chủ sản phẩm            |

Triển khai (backlog W2-02 trở đi) đi qua [task-loop](../05-engineering/workflows/task-loop.md), vì việc này đụng contract, migration và AI.

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
