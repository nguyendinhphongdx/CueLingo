---
title: Brief M4-02/04 · api review + progress
---

# Brief — M4-02/04 · `api/review` và `api/progress`

> Nhánh `feat/m4-api-codex` · Worktree `.worktrees/m4-api-codex`

## Mục tiêu

Trong `services/api/src/modules/review/` (đã có Phrase Bank: đọc `phrases.*` trước) thêm:

- `GET /v1/review/queue` → `ReviewQueue`: các cụm từ `user_lexicon.in_review = true` đến hạn (`receptive_fsrs` null = mới, đến hạn ngay; ngược lại `due <= now`), sắp theo hạn, tối đa 10 thẻ mỗi lần, `dueCount` là tổng số đến hạn. Dạng bài luân phiên theo `itemId` để ổn định: **recognize** (prompt = cụm tiếng Anh, choices = nghĩa tiếng Việt đúng + 1–3 nghĩa của cụm khác của chính user hoặc cụm mặc định nếu user có ít cụm) và **cloze** (prompt = câu ngữ cảnh `segments.text_en` của `first_context_segment_id` thay cụm bằng `____`; chỉ dùng khi câu có chứa cụm, không thì rơi về recognize; choices = cụm đúng + cụm khác). Cụm chưa có nghĩa tiếng Việt chỉ được dùng dạng cloze hoặc bị bỏ qua nếu cũng thiếu ngữ cảnh. Thứ tự choices xáo trộn nhưng xác định theo itemId (để test ổn định).
- `POST /v1/review/answer` (`ReviewAnswerRequest` → `ReviewAnswerResponse`): cập nhật `receptive_fsrs` bằng `reviewCard`/`newFsrsState` từ `@cuelingo/learner-model` (đã có, thuần), ghi một dòng `review_logs`, tăng `stage` không cần làm. Item không thuộc user → 404. Một transaction.
- `GET /v1/progress` → `Progress` (module `progress/`): đếm cụm đã lưu, đang ôn, đến hạn hôm nay; `streakDays` = số ngày liên tiếp (tính đến hôm nay hoặc hôm qua) có ít nhất một dòng `review_logs`; `reviewsLast7Days` đủ 7 ngày (0 nếu trống); `meetingsCount`; `avgComprehensionPct` trung bình của debrief mới nhất mỗi phiên (null nếu chưa có); `weekly` 4 tuần gần nhất (`weekStart` là thứ Hai, ngày UTC dạng `YYYY-MM-DD`): số cuộc họp và số event `lookup` (bảng `events`, cột loại event — xem module events) theo tuần.
- Repository Postgres + in-memory; ranh giới người dùng; đăng ký trong `app.ts`/`server.ts`; dev token cũng được chấp nhận ở `/v1/review` và `/v1/progress` (`lib/auth.ts`).
- Doc: `04-modules/03-api/phrases-review.md` và `progress.md`.

## AC

| #   | AC (EARS)                                                                                            | Test               |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------ |
| AC1 | Cụm mới (chưa có FSRS) có trong hàng đợi; sau khi trả lời "good" nó rời hàng đợi cho tới hạn mới     | `review.test.ts`   |
| AC2 | `answer` ghi đúng `receptive_fsrs` (đúng `reviewCard`) và một `review_logs`                          | `review.test.ts`   |
| AC3 | Thẻ recognize có đúng 1 đáp án đúng trong choices và không trùng nhau; cloze chứa `____`             | `review.test.ts`   |
| AC4 | User khác không thấy / không trả lời được thẻ của người khác (404)                                   | `review.test.ts`   |
| AC5 | `progress` tính streak, 7 ngày, 4 tuần đúng với dữ liệu mẫu (ngày giả qua tham số `now` của service) | `progress.test.ts` |
| AC6 | Body sai schema 400; không session 401                                                               | tests              |

## Phạm vi file

Được sửa/tạo: `services/api/**`, doc module. Không sửa `packages/**`, `apps/**`, `infra/**` (cần migration thì dừng và hỏi).

Quy tắc chung: đọc `AGENTS.md` gốc và của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không đổi `packages/shared/src/dto/review.dto.ts` (thiếu thì dừng và ghi câu hỏi). Chạy `pnpm verify` trước khi báo; điền mục Kết quả.

## Kết quả _(implementer điền)_
