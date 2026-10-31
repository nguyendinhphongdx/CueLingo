# Thuật ngữ

| Thuật ngữ                  | Nghĩa trong dự án                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Session                    | Một cuộc họp có Copilot chạy, từ lúc bắt đầu đến lúc kết thúc                                                                                   |
| Segment                    | Một câu (hoặc lượt nói) đã chốt, có thời gian bắt đầu/kết thúc, văn bản gốc và bản dịch                                                         |
| Partial / Final            | Transcript tạm thời (còn thay đổi) / đã chốt của một segment                                                                                    |
| Stream `system` / `mic`    | Luồng audio của người khác (audio hệ thống) / của chính người dùng (mic)                                                                        |
| Assist level (Assist Dial) | Mức hỗ trợ 0–5: 4 = caption song ngữ, 3 = chỉ tiếng Anh + từ khó, 1 = chỉ ghi chép. Xem [Learner Model](../03-architecture/02-learner-model.md) |
| Debrief                    | Bản phân tích sau họp: tóm tắt, action items, % hiểu, đoạn khó, cụm từ nên học, câu nên nói                                                     |
| Comprehension %            | Tỷ lệ câu người khác nói mà người dùng không phải tra, hỏi lại hay mở bản dịch                                                                  |
| Learner Model              | Mô hình người học: profile, kỹ năng, lexicon, lỗi, ngữ cảnh. Nguồn sự thật cho cá nhân hoá                                                      |
| Lexicon                    | Tập từ/cụm của một người dùng, mỗi mục có trạng thái receptive và productive                                                                    |
| Receptive / Productive     | Hiểu được khi nghe/đọc / tự dùng được khi nói/viết                                                                                              |
| Phrase Bank                | Danh sách cụm từ người dùng đã lưu để ôn                                                                                                        |
| FSRS                       | Thuật toán lặp lại ngắt quãng (spaced repetition) dùng để xếp lịch ôn                                                                           |
| Quick Assist               | Các công cụ trong họp: tra từ, "Họ vừa nói gì?", "Nói giúp tôi"                                                                                 |
| Event                      | Một tương tác được ghi lại (append-only), ví dụ `lookup`, `review_answer`. Là đầu vào của Learner Model                                         |
| Glossary                   | Danh sách thuật ngữ và tên riêng giúp STT và bản dịch đúng hơn                                                                                  |
