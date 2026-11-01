# AGENTS.md — services/workers

Job nền qua pg-boss. Thiết kế: [apps/docs/docs/04-modules/04-workers](../../apps/docs/docs/04-modules/04-workers/README.md). Chưa có job mẫu; job đầu tiên (`debrief-job`) sẽ là mẫu.

- Mỗi job một thư mục `src/jobs/<x>/`: payload có Zod schema, handler idempotent (chạy lại không sinh dữ liệu trùng).
- Gọi AI qua `@cuelingo/ai-gateway`, logic Learner Model qua `@cuelingo/learner-model`.
- Không import code từ `services/api`; dùng chung qua `packages/*`.
- **Job mẫu:** [`src/jobs/retention/`](src/jobs/retention/) (`defineJob` + handler thuần + repository + test bằng deps giả). Job mới = copy thư mục này, thêm tên vào `JobName`/`JobPayloads` ở `@cuelingo/shared` (skill contract-sync), rồi đăng ký trong `src/jobs/index.ts`.
- **Scaffold:** [worker](../../apps/docs/docs/05-engineering/scaffold/03-worker.md) — pg-boss 12: `createQueue` trước `work`, handler nhận **mảng** job.
- **Chạy:** `pnpm --filter @cuelingo/workers dev` (cần `.env` và DB đã `pnpm db:migrate`).
