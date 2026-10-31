# AGENTS.md — packages/learner-model

Logic thuần của Learner Model. Thiết kế: [02-architecture/learner-model](../../apps/docs/docs/03-architecture/05-learner-model.md).

- **Không I/O**: không fs, mạng, DB (máy kiểm). Hàm nhận state + input, trả state mới.
- Mọi quy tắc (FSRS, giai đoạn, comprehension, Assist Dial) có unit test, kể cả ngưỡng biên.
- Ngưỡng là hằng số có tên, tập trung một chỗ, kèm link tài liệu.
- **Package mới / mở rộng:** [workspace-package](../../apps/docs/docs/05-engineering/scaffold/01-workspace-package.md).
