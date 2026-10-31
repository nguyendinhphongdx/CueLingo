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

Tên và schema payload ở `@cuelingo/shared` (`src/jobs.ts`) để API gửi đúng kiểu:

```ts
// packages/shared/src/jobs.ts
export const JobName = {
  RetentionSweep: 'retention.sweep',
  DebriefGenerate: 'debrief.generate',
} as const;
export const DebriefGeneratePayload = z.object({ sessionId: z.uuid() });
```

```ts
// services/workers/src/jobs/retention/index.ts
import { JobName } from '@cuelingo/shared';
import { z } from 'zod';
import type { JobDefinition } from '../types';
import { sweepExpiredAudio } from './retention.handler';

export const retentionSweep: JobDefinition<z.ZodObject<{}>> = {
  name: JobName.RetentionSweep,
  payload: z.object({}),
  schedule: '15 3 * * *', // cron, giờ UTC
  handle: (deps) => sweepExpiredAudio(deps),
};
```

## `worker.ts`

```ts
import { PgBoss } from 'pg-boss';
import { loadConfig } from './config';
import { jobs } from './jobs';

const config = loadConfig();
const boss = new PgBoss(config.DATABASE_URL);
boss.on('error', (err) => console.error('pg-boss', err));
await boss.start();

const deps = createDeps(config); // db, ai-gateway, storage…
for (const job of jobs) {
  await boss.createQueue(job.name);
  if (job.schedule) await boss.schedule(job.name, job.schedule);
  // pg-boss 12: handler nhận MẢNG job.
  await boss.work(job.name, async (batch) => {
    for (const j of batch) await job.handle(deps, job.payload.parse(j.data));
  });
}

process.on('SIGTERM', () => void boss.stop());
```

Đối chiếu tên hàm `schedule` và tuỳ chọn `work` (batch size, retry) với tài liệu pg-boss của phiên bản đã cài trước khi dùng.

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
