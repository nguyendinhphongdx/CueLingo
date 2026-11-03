# Workers

> Code: `services/workers/` · Stack: Node.js (TypeScript) + pg-boss · Giai đoạn: MVP

Job nền không cần realtime: debrief, tính lại Learner Model, cache TTS, dọn dữ liệu hết hạn.

## Modules

| Module                                      | Code                         | Trách nhiệm                                                            |
| ------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| [Debrief job](./debrief-job.md)             | `src/jobs/debrief`           | Phân tích cuộc họp sau khi kết thúc, tạo debrief JSON.                 |
| [Learner recompute](./learner-recompute.md) | `src/jobs/learner-recompute` | Tính lại Learner Model từ event log khi đổi thuật toán hoặc theo lịch. |
| [TTS cache](./tts-cache.md)                 | `src/jobs/tts-cache`         | Sinh và cache audio TTS cho cụm từ mới trong Phrase Bank.              |
| [Retention cleanup](./retention.md)         | `src/jobs/retention`         | Xoá audio hết hạn và thực hiện yêu cầu xoá dữ liệu.                    |
| [Stale sessions](./stale-sessions.md)       | `src/jobs/stale-sessions`    | Kết thúc các cuộc họp bị bỏ lửng ở `live` và xếp debrief.              |

## Quan hệ với phần khác

Xem [sơ đồ hệ thống](../../01-overview/04-system-overview.md).
