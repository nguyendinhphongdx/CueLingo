# Bản đồ tính năng

Sáu nhóm tính năng xoay quanh một Learner Model. Cột "Đợt" theo [lộ trình](./04-roadmap.md); cột "Module" trỏ tới nơi hiện thực hoá; task chi tiết ở [backlog](./06-backlog.md#kế-hoạch-hoàn-thiện-theo-đợt-b2c-first).

**Trạng thái (2026-11-02):** ✅ xong và có test · ◐ có mã nhưng chưa ai chạy thật trên bản `.app` · — chưa làm. ✅ khi task trong backlog đã ✅, hoặc mốc M tương ứng chạy được và có test (e2e P2-21 phủ debrief → cụm từ → ôn → tiến độ). ◐ nghĩa là có thể còn thiếu phần, xem dòng task trong backlog.

| Nhóm                 | Tính năng                                                                                 | Trạng thái                     | Đợt     | Module                                           |
| -------------------- | ----------------------------------------------------------------------------------------- | ------------------------------ | ------- | ------------------------------------------------ |
| **Live Copilot**     | Caption song ngữ trong mọi app họp                                                        | ◐ chạy trên máy dev, chờ P2-22 | 0       | desktop/overlay, desktop/local-stt, api/realtime |
|                      | Tra từ theo ngữ cảnh, "Họ vừa nói gì?", "Nói giúp tôi" + teleprompter                     | ◐ chờ xác nhận ở W0-01         | 0       | desktop/quick-assist, api/assist                 |
|                      | Assist Dial: 3 mức + gợi ý đổi mức                                                        | ✅                             | 0       | desktop/overlay, packages/learner-model          |
|                      | Assist Dial đầy đủ (mức 5, 2, 0)                                                          | —                              | 3       | packages/learner-model                           |
|                      | Gợi ý câu trả lời tự động                                                                 | —                              | 3       | api/assist                                       |
|                      | Voice mode (AI nói thay qua virtual mic)                                                  | —                              | 4       | desktop (virtual mic)                            |
|                      | Writing / Reading Copilot                                                                 | —                              | 4       | apps/extension                                   |
|                      | Họp trực tiếp                                                                             | —                              | 4       | apps/mobile                                      |
| **Learning Studio**  | Phrase Bank + ôn FSRS (3 dạng bài, nghe–gõ)                                               | ✅                             | 0       | web/review, api/phrases-review                   |
|                      | Nghe lại đoạn khó, caption fading                                                         | —                              | 3       | web/debrief                                      |
|                      | "Câu bạn đã nói → câu nên nói" trong debrief                                              | ✅                             | 0       | workers/debrief-job                              |
|                      | Shadowing                                                                                 | —                              | 3       | web/debrief                                      |
|                      | Podcast cá nhân                                                                           | —                              | 4       | workers                                          |
| **AI Coach**         | Speech Coach (chấm phát âm)                                                               | —                              | 3       | packages/ai-gateway + model âm vị                |
|                      | Roleplay với persona thật, rehearsal đầy đủ                                               | —                              | 4       | Pipecat-based tutor                              |
|                      | Tutor chat/voice có trí nhớ                                                               | —                              | 4       | api + memory                                     |
| **Planner**          | Briefing trước họp (từ lịch, thuật ngữ, họp trước)                                        | —                              | 1       | api, workers, desktop                            |
|                      | Gợi ý ngôn ngữ họp từ lịch                                                                | ◐                              | 1       | desktop/calendar                                 |
|                      | Nhắc ôn qua thông báo macOS                                                               | —                              | 1       | desktop                                          |
|                      | Daily Mix                                                                                 | —                              | 3       | api, workers                                     |
| **Insights**         | Debrief 5 khối sau họp                                                                    | ✅                             | 0       | workers/debrief-job, web/debrief                 |
|                      | Debrief hoàn thiện (bấm đoạn khó → đúng câu, lọc người nói đã có; còn đính kèm/chia sẻ)   | ◐                              | 0       | web/debrief                                      |
|                      | Nhãn người nói "Speaker N" và đổi tên                                                     | —                              | 0       | workers, web/debrief                             |
|                      | Follow-up sau họp (soạn email/Slack tiếng Anh)                                            | —                              | 1       | workers, web/debrief                             |
|                      | Tiến bộ theo tuần                                                                         | ✅                             | 0       | api/progress, web/progress                       |
|                      | Chỉ số độc lập hằng tuần                                                                  | —                              | 1       | packages/learner-model, web/progress             |
|                      | Dashboard L&D cho doanh nghiệp                                                            | —                              | 4 (B2B) | web                                              |
| **Workspace**        | Glossary cá nhân (thêm, xoá, chọn trước họp)                                              | ✅                             | 0       | api/glossary, web/glossary                       |
|                      | Glossary vào nhận dạng giọng nói (sidecar xong; còn lệnh Rust và desktop gửi glossary)    | ◐                              | 0       | desktop/local-stt                                |
|                      | Glossary công ty, tích hợp Zoom/Slack/Notion                                              | —                              | 4 (B2B) | api                                              |
| **Tài khoản và gói** | Đăng nhập trong app và production (Google OAuth, magic link), cài đặt lưu bền, onboarding | ◐                              | 0       | desktop/auth, desktop/onboarding, api/settings   |
|                      | Quyền riêng tư: xoá phiên/dữ liệu, xuất dữ liệu                                           | ✅                             | 0       | api/privacy, workers/retention                   |
|                      | Gói Free/Pro, quota giờ Copilot, thanh toán, trang giá                                    | —                              | 2       | api, web                                         |
|                      | Điều khoản, chính sách riêng tư, thông báo người dự họp                                   | —                              | 2       | web                                              |
|                      | Ngôn ngữ họp: tiếng Anh                                                                   | ✅                             | 0       | desktop, api, packages/prompts                   |
|                      | Ngôn ngữ họp: tiếng Nhật (nhận dạng đám mây)                                              | ◐ code xong, chờ thử thật      | 0       | desktop, api, packages/prompts                   |
|                      | Ngôn ngữ họp: tiếng Hàn (nhận dạng đám mây, dịch sang tiếng Việt)                         | ◐ code xong, chờ thử thật      | 0       | desktop, api/transcribe, packages/shared         |
|                      | Ngôn ngữ họp: tiếng Trung giản thể (nhận dạng đám mây, dịch sang tiếng Việt)              | ◐ code xong, chờ thử thật      | 0       | desktop, api/transcribe, packages/shared         |
|                      | Ngôn ngữ họp: tiếng Việt (nhận dạng đám mây, debrief tiếng Việt)                          | ◐ code xong, chờ chạy thật     | 0       | desktop, api/transcribe, packages/ai-gateway     |
|                      | Sóng âm hai luồng, kiểm tra quyền Micro và báo lỗi thu âm                                 | ◐                              | 0       | desktop/session-controller                       |
|                      | Thẻ "Cuộc họp vừa xong" (thời lượng, số câu, tóm tắt debrief)                             | ◐                              | 0       | desktop/session-controller                       |

Chi tiết từng tính năng và tiêu chí chấp nhận: [Phạm vi MVP](./03-mvp-scope.md).
