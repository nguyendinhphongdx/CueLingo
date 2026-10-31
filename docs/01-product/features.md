# Bản đồ tính năng

Sáu nhóm tính năng xoay quanh một Learner Model. Cột "Giai đoạn" theo [lộ trình](roadmap.md). Cột "Module" trỏ tới nơi hiện thực hoá.

| Nhóm | Tính năng | Giai đoạn | Module |
| --- | --- | --- | --- |
| **Live Copilot** | Caption song ngữ trong mọi app họp | MVP | desktop/overlay, desktop/local-stt, api/realtime |
| | Tra từ theo ngữ cảnh, "Họ vừa nói gì?", "Nói giúp tôi" + teleprompter | MVP | desktop/quick-assist, api/assist |
| | Assist Dial (mức hỗ trợ giảm dần) | MVP (3 mức) → Learn | desktop/overlay, packages/learner-model |
| | Gợi ý câu trả lời tự động | Learn | api/assist |
| | Voice mode (AI nói thay qua virtual mic) | Scale | desktop (virtual mic) |
| | Writing / Reading Copilot | Learn | apps/extension |
| | Họp trực tiếp | Coach | apps/mobile |
| **Learning Studio** | Phrase Bank + ôn FSRS (3 dạng bài) | MVP | web/review, api/phrases-review |
| | Nghe lại đoạn khó, caption fading | MVP (một phần) → Learn | web/debrief |
| | Shadowing, "câu bạn đã nói → câu nên nói" | MVP (trong debrief) → Learn | workers/debrief-job |
| | Podcast cá nhân | Scale | workers |
| **AI Coach** | Speech Coach (chấm phát âm) | Learn | packages/ai-gateway + model âm vị |
| | Roleplay với persona thật, rehearsal trước họp | Coach | Pipecat-based tutor |
| | Tutor chat/voice có trí nhớ | Coach | api + memory |
| **Planner** | Daily Mix, đồng bộ lịch | Learn / Coach | api, workers |
| **Insights** | Debrief sau họp | MVP | workers/debrief-job, web/debrief |
| | Tiến bộ theo tuần, dependence index | MVP (cơ bản) | api/progress, web/progress |
| | Dashboard L&D cho doanh nghiệp | Scale | web |
| **Workspace** | Glossary cá nhân | MVP | api/glossary, web/glossary |
| | Glossary công ty, tích hợp Zoom/Slack/Notion | Scale | api |

Chi tiết từng tính năng và tiêu chí chấp nhận: [Phạm vi MVP](mvp-scope.md).
