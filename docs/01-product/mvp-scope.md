# Phạm vi MVP

MVP là **app desktop macOS + web app nhỏ**. Nó giúp người Việt hiểu cuộc họp tiếng Anh theo thời gian thực, rồi biến chính cuộc họp đó thành bài học. Mục tiêu là kiểm chứng vòng lặp **Dùng → Debrief → Ôn tập** trong 12 tuần, với 30–50 người dùng beta.

## Giả thuyết cần kiểm chứng

| #   | Giả thuyết                            | Đo bằng                                  | Ngưỡng đề xuất                       |
| --- | ------------------------------------- | ---------------------------------------- | ------------------------------------ |
| H1  | Người dùng cần Copilot đều đặn        | Số họp có Copilot / tuần                 | ≥ 2 họp/tuần với ≥ 50% user ở tuần 4 |
| H2  | Debrief có giá trị                    | Tỷ lệ mở debrief trong 24 giờ            | ≥ 60% cuộc họp                       |
| H3  | Người dùng chịu ôn cụm từ từ họp thật | User có ≥ 3 phiên ôn/tuần                | ≥ 30% user                           |
| H4  | Tín hiệu ngầm đo được tiến bộ         | Tỷ lệ câu phải tra/mở bản dịch theo tuần | Giảm rõ sau 6 tuần                   |
| H5  | Chi phí AI chấp nhận được             | Chi phí / giờ họp                        | Đủ để gói Pro có lãi                 |

## Tính năng

| ID  | Tính năng                              | Module chính                                                                                                                                                                                                         |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Onboarding + bài nghe đánh giá ban đầu | [desktop/onboarding](../03-parts/desktop/onboarding.md), [api/learner](../03-parts/api/learner.md)                                                                                                                   |
| F2  | Live caption song ngữ                  | [desktop/audio-capture](../03-parts/desktop/audio-capture.md), [desktop/local-stt](../03-parts/desktop/local-stt.md), [api/realtime](../03-parts/api/realtime.md), [desktop/overlay](../03-parts/desktop/overlay.md) |
| F3  | Quick Assist                           | [desktop/quick-assist](../03-parts/desktop/quick-assist.md), [api/assist](../03-parts/api/assist.md)                                                                                                                 |
| F4  | Debrief sau họp                        | [workers/debrief-job](../03-parts/workers/debrief-job.md), [web/debrief](../03-parts/web/debrief.md)                                                                                                                 |
| F5  | Phrase Bank + ôn tập                   | [api/phrases-review](../03-parts/api/phrases-review.md), [web/review](../03-parts/web/review.md)                                                                                                                     |
| F6  | Learner Model v1 + tiến bộ             | [packages/learner-model](../03-parts/packages/learner-model.md), [api/progress](../03-parts/api/progress.md)                                                                                                         |

## User stories (P0 = bắt buộc cho beta)

| ID    | Người dùng muốn…                    | Tiêu chí chấp nhận                                            | Ưu tiên |
| ----- | ----------------------------------- | ------------------------------------------------------------- | ------- |
| US-01 | Đăng nhập và cấp quyền thu âm nhanh | Hoàn tất ≤ 3 phút; có hướng dẫn khi bị từ chối quyền          | P0      |
| US-02 | Làm bài đánh giá nghe ngắn          | ≤ 5 phút, ra mức nghe và Assist mặc định                      | P1      |
| US-03 | Bật Copilot bằng phím tắt           | Caption đầu tiên ≤ 3 giây sau khi có người nói                | P0      |
| US-04 | Thấy câu gốc và bản dịch            | Câu gốc p95 ≤ 1 giây; bản dịch p95 ≤ 2,5 giây sau khi hết câu | P0      |
| US-05 | Biết ai đang nói                    | Nhãn "Tôi" và "Speaker N"; đổi tên được                       | P1      |
| US-06 | Tra từ/cụm theo ngữ cảnh và lưu lại | Popup ≤ 1,5 giây; một click để lưu                            | P0      |
| US-07 | Hỏi "Họ vừa nói gì?"                | Tóm tắt tiếng Việt 60 giây gần nhất trong ≤ 3 giây            | P0      |
| US-08 | Gõ tiếng Việt để nhận câu tiếng Anh | 2 phiên bản, chữ lớn, ≤ 2 giây                                | P0      |
| US-09 | Thêm thuật ngữ trước họp            | STT và bản dịch dùng đúng thuật ngữ                           | P1      |
| US-10 | Chọn mức hiển thị                   | 3 mức Assist (4, 3, 1), đổi ngay trong họp                    | P1      |
| US-11 | Nhận debrief sau họp                | Sẵn sàng ≤ 2 phút sau họp, đủ 5 khối                          | P0      |
| US-12 | Nghe lại đoạn khó                   | 0,75x/1x, ẩn/hiện chữ                                         | P1      |
| US-13 | Ôn cụm từ mỗi ngày                  | Phiên 5–10 phút, FSRS, có câu gốc + audio                     | P0      |
| US-14 | Xem tiến bộ theo tuần               | % hiểu, số cụm, streak                                        | P1      |
| US-15 | Kiểm soát dữ liệu                   | Tắt lưu audio; xoá phiên và dữ liệu rút ra; xoá tài khoản     | P0      |
| US-16 | Xuất transcript và tóm tắt          | Markdown/PDF                                                  | P2      |

## Ngoài phạm vi MVP

Windows, mobile, extension, meeting bot · voice mode, virtual mic · gợi ý trả lời tự động · chấm phát âm, roleplay, Planner · ngôn ngữ khác tiếng Anh · quản trị doanh nghiệp, SSO, billing tự động.

## Yêu cầu phi chức năng chính

| Nhóm           | Mục tiêu                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Độ trễ         | Câu gốc p95 ≤ 1 s · bản dịch p50 ≤ 1,5 s, p95 ≤ 2,5 s · debrief ≤ 2 phút                             |
| Chất lượng     | WER ≤ 12% trên bộ test nội bộ · ≥ 90% câu dịch đúng ý · ≥ 95% thuật ngữ glossary đúng                |
| Tài nguyên     | Phiên 2 giờ không crash; CPU/RAM đo và chốt sau benchmark streaming                                  |
| Quyền riêng tư | Mặc định không lưu audio; xoá phiên trong ≤ 24 giờ; nhà cung cấp AI không dùng dữ liệu để huấn luyện |

Benchmark ban đầu: [04-research/benchmark-stt-mt.md](../04-research/benchmark-stt-mt.md).
