# CLAUDE.md — packages/learner-model

Logic thuần của Learner Model. Thiết kế: [02-architecture/learner-model](../../docs/02-architecture/learner-model.md).

- **Không I/O**: không fs, mạng, DB (máy kiểm). Hàm nhận state + input, trả state mới.
- Mọi quy tắc (FSRS, giai đoạn, comprehension, Assist Dial) có unit test, kể cả ngưỡng biên.
- Ngưỡng là hằng số có tên, tập trung một chỗ, kèm link tài liệu.
