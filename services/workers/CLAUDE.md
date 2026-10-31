# CLAUDE.md — services/workers

Job nền qua pg-boss. Thiết kế: [apps/docs/docs/04-modules/04-workers](../../apps/docs/docs/04-modules/04-workers/README.md). Chưa có job mẫu; job đầu tiên (`debrief-job`) sẽ là mẫu.

- Mỗi job một thư mục `src/jobs/<x>/`: payload có Zod schema, handler idempotent (chạy lại không sinh dữ liệu trùng).
- Gọi AI qua `@cuelingo/ai-gateway`, logic Learner Model qua `@cuelingo/learner-model`.
- Không import code từ `services/api`; dùng chung qua `packages/*`.
