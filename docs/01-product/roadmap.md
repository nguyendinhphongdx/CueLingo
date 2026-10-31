# Lộ trình

Bốn giai đoạn. Mỗi giai đoạn chỉ bắt đầu khi giai đoạn trước đã qua cổng chứng minh giá trị. Mốc thời gian là ước lượng cho một team 3–4 người.

| Giai đoạn | Thời gian | Trọng tâm | Cổng để đi tiếp |
| --- | --- | --- | --- |
| 1. MVP | Tháng 1–3 | Copilot desktop macOS, caption song ngữ, debrief, Phrase Bank + SRS, Learner Model v1 | Debrief được dùng đều (H1–H3) |
| 2. Learn | Tháng 4–6 | Windows + extension, Daily Mix, Speech Coach, caption fading, Assist Dial đầy đủ | Assist level giảm dần |
| 3. Coach | Tháng 7–12 | Mobile, roleplay persona, rehearsal trước họp, Planner + lịch, gói Pro+ | Retention D90 ổn định |
| 4. Scale | Năm thứ 2 | Nhật, Hàn, Trung · B2B Enterprise · voice mode · podcast · on-premise/VPC | — |

## Kế hoạch 12 tuần của MVP

| Tuần | Hạng mục | Phần/module |
| --- | --- | --- |
| 1–2 | Benchmark streaming, chốt STT/LLM, dựng bộ test | ml/bench, ml/eval |
| 1–4 | Thu audio + overlay | desktop/audio-capture, desktop/local-stt, desktop/tauri-core, desktop/overlay |
| 2–5 | Realtime API + dịch | api/realtime, packages/ai-gateway, packages/prompts |
| 5–6 | Quick Assist | desktop/quick-assist, api/assist |
| Cuối tuần 6 | **Alpha nội bộ** | — |
| 5–8 | Debrief | workers/debrief-job, web/debrief |
| 7–9 | Phrase Bank + ôn tập | api/phrases-review, web/review, packages/learner-model |
| 8–10 | Learner Model + tiến bộ | api/learner, api/progress, web/progress |
| 9–10 | Onboarding + quyền riêng tư | desktop/onboarding, api/privacy, workers/retention |
| 10–11 | Kiểm thử, tối ưu độ trễ | toàn bộ |
| 11–12 | **Closed beta** | — |

Nếu chậm tiến độ ở tuần 1–5 (thu audio, độ trễ realtime), cắt F6 xuống chỉ còn trang Tiến bộ đơn giản, không lùi beta.

## Câu hỏi mở

- [x] Tên sản phẩm: CueLingo (cần kiểm tra domain và nhãn hiệu)
- [ ] B2C trước hay pilot ngay với một công ty outsourcing
- [ ] Chỉ tiếng Anh hay Anh + Nhật ngay từ MVP
- [ ] Hỗ trợ tối thiểu macOS 13 hay 14.4
