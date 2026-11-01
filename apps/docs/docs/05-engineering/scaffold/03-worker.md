---
title: Worker
---

# Scaffold · Worker (`services/workers`)

**Kết quả:** một tiến trình worker chạy pg-boss 12, đăng ký job từ `src/jobs/*`, có một job mẫu (`retention.sweep`) chạy định kỳ, test được handler mà không cần Postgres, và Dockerfile. Job này thành **job mẫu** cho mọi job sau.

## Điều kiện trước

- [API foundation](./02-api-foundation.md) đã xong (config, dbmate, `@cuelingo/shared/jobs`).

## Cây thư mục

```text
services/workers/src/
├── worker.ts                 khởi động: config → pg-boss → đăng ký mọi job → xử lý SIGTERM
├── config.ts                 như API: Zod parse env
├── lib/db.ts                 postgres.js client (giống API)
└── jobs/
    ├── index.ts              danh sách job: export const jobs = [retentionSweep, …]
    └── retention/
        ├── index.ts          định nghĩa job: name, schema payload, schedule?, handler
        ├── retention.handler.ts
        └── retention.test.ts
```

## Định nghĩa job

Tên job và schema payload ở `@cuelingo/shared` (`src/jobs.ts`: `JobName`, `JobPayloads`) để API gửi đúng kiểu. Trong worker, một job là kết quả của `defineJob` (`src/jobs/types.ts`): nó parse payload bằng schema chung rồi gọi `handle(deps, payload)`; payload sai thì **reject promise** (không ném đồng bộ).

```ts
// services/workers/src/jobs/retention/index.ts  — JOB MẪU
export const retentionSweep = defineJob({
  name: JobName.RetentionSweep,
  schedule: '15 3 * * *', // cron, giờ UTC
  handle: async (deps) => {
    await sweepExpiredAudio(deps);
  },
});
```

Mỗi thư mục job có: `index.ts` (định nghĩa), `<job>.handler.ts` (hàm thuần của `deps`), `<job>.repository.ts` (interface + bản Postgres), `<job>.test.ts` (deps giả). `JobDeps` (`jobs/types.ts`) liệt kê những gì handler được chạm: repository, `ObjectStorage`, `now()`.

## `worker.ts`

Đã dựng tại `services/workers/src/worker.ts`: `loadConfig()` → `postgres.js` → `new PgBoss(url)` → `start()` → với mỗi job trong `jobs/index.ts`: `createQueue`, `schedule` (nếu có cron), `work` (handler nhận **mảng** job, mỗi phần tử gọi `job.run`) → `SIGTERM`/`SIGINT` gọi `boss.stop()`. Tên hàm và tuỳ chọn pg-boss luôn đối chiếu với tài liệu bản đã cài.

## Luật cho handler

| #   | Luật                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------ |
| 1   | **Idempotent**: chạy lại cùng payload không sinh dữ liệu trùng (upsert, kiểm trạng thái trước khi ghi)       |
| 2   | Parse payload bằng Zod trước khi dùng                                                                        |
| 3   | Handler là hàm thuần nhận `deps` → test bằng deps giả, không cần pg-boss                                     |
| 4   | Lỗi tạm thời (mạng, AI timeout) → ném lỗi để pg-boss retry; lỗi dữ liệu → log + kết thúc, không retry vô hạn |
| 5   | Không import `services/api`; dùng chung qua `packages/*`                                                     |

## Definition of Done

- [ ] `pnpm --filter @cuelingo/workers dev` chạy, log đã đăng ký job; gửi thử một job từ API (hoặc script) → handler chạy.
- [ ] Test handler `retention` xanh với deps giả; chạy lại hai lần không đổi kết quả.
- [ ] Dockerfile như API; SIGTERM dừng sạch.
- [ ] Docs: [workers](../../04-modules/04-workers/README.md), [Tổ chức thư mục](../../03-architecture/03-folder-structure.md).

## Anti-pattern

- ❌ Đọc `job.data` không parse.
- ❌ Handler gọi thẳng `boss` để gửi job mới mà không qua hàm có kiểu trong `@cuelingo/shared`.
- ❌ Worker chạy trong cùng tiến trình HTTP của API.
