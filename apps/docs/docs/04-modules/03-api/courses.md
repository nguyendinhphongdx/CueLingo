# Courses

> Phần: [API service](./README.md) · Code: `services/api/src/modules/courses/` · Luật thuần: `packages/learner-model/src/course.ts`

Lộ trình học: mỗi cuộc họp có debrief thành một **khoá** gồm 3–10 bài, mỗi bài là một cụm từ của chính cuộc họp, làm bằng thẻ ôn có sẵn. Khoá là **view tính lúc đọc**, không có bảng riêng, không migration, không gọi AI (phương án B của [hồ sơ](../../06-delivery/2026-11-21-learning-path/02-plan.md)).

## Trách nhiệm

- Dựng khoá từ debrief mới nhất của một phiên chưa xoá, ngôn ngữ học được (id khoá = `sessionId`)
- Tính trạng thái bài và tiến độ từ `review_logs`; không có bộ chấm thứ hai
- "Bắt đầu khoá": lưu các cụm chưa có vào Phrase Bank (qua `phrases.save`, idempotent)
- Trả hàng đợi một lần học (≤ 5 bài chưa xong) dưới dạng `ReviewQueue`; trả lời đi qua `POST /v1/review/answer`
- Gợi ý chuẩn bị họp (chỉ desktop gọi): cụm đã lưu từ các phiên được chỉ định, xếp theo FSRS, cộng thuật ngữ glossary; không ghi gì

## Phạm vi

- Hạng mục Đợt 1 ([Planner, Learning Studio](../../02-product/01-features.md)); chưa nằm trong user story MVP

## Interface

| Method | Path                                | Contract                                                             |
| ------ | ----------------------------------- | -------------------------------------------------------------------- |
| `GET`  | `/v1/courses?language`              | → `CourseList` (≤ 20 phiên gần nhất, kèm `nextUp`)                   |
| `GET`  | `/v1/courses/:id`                   | → `Course` (`:id` là `sessionId`); `404` nếu không phải của user     |
| `POST` | `/v1/courses/:id/start`             | → `StartCourseResponse` (`added`: số cụm vừa thêm vào Kho cụm từ)    |
| `GET`  | `/v1/courses/:id/queue?dictation=1` | → `ReviewQueue` (dùng lại schema ôn tập; `dueCount` = bài chưa xong) |
| `POST` | `/v1/courses/prep`                  | `PrepCourseRequest` (≤ 5 `sessionIds`) → `PrepCourse`                |

Không có endpoint chấm điểm hay hoàn thành bài: trả lời bằng `POST /v1/review/answer`. Client: `client.courses` trong [core-sdk](../05-packages/core-sdk.md). Panel dùng chung: `LearningPathPanel` trong [ui](../05-packages/ui.md).

## Quy tắc

| Khái niệm     | Định nghĩa                                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nguồn bài     | `phraseSuggestions` (≤ 10), `rephrase.better` (≤ 6), `hardSegmentIds` làm câu ngữ cảnh. Bản `version` cao nhất                                                       |
| Thứ tự        | Cụm nằm trong đoạn khó → theo thứ tự debrief → câu "nên nói". Thuật toán thuần `buildLessons`, không AI                                                              |
| Cỡ khoá       | 3–10 bài (`COURSE_MIN_LESSONS`, `COURSE_MAX_LESSONS`); dưới 3 bài dựng được thì không có khoá. Một lần học ≤ 5 bài (`SITTING_SIZE`)                                  |
| Bài dựng được | Có nghĩa tiếng Việt hoặc có câu chứa cụm; không thì bỏ bài (như hàng đợi ôn). Câu "nên nói" dùng `noteVi` làm nghĩa                                                  |
| `todo`        | Không có `review_logs` nào của item kể từ `debriefs.created_at` (cụm chưa lưu luôn là `todo`)                                                                        |
| `learning`    | Có log từ mốc đó nhưng chưa có log `rating ≥ 3`                                                                                                                      |
| `done`        | Có ít nhất một log `rating ≥ 3`; không lùi khi sau đó trả lời "Lại" (FSRS vẫn lo lịch ôn)                                                                            |
| Tiến độ       | `round(100 × bài xong / tổng bài)`. Chỉ hiện %, không huy hiệu                                                                                                       |
| `nextUp`      | Khoá đã bắt đầu mà chưa xong (theo thứ tự mới → cũ), nếu không có thì khoá mới nhất chưa bắt đầu; bài là bài đầu chưa xong                                           |
| Chuẩn bị họp  | Desktop so tiêu đề lịch với tiêu đề phiên **trên máy** (`calendar/match-sessions.ts`), chỉ gửi `sessionIds`. Không lưu, không có trong danh sách khoá, không tiến độ |

## Phụ thuộc

- `@cuelingo/learner-model` (`course.ts`), `@cuelingo/shared` (`course.dto.ts`)
- Module `review`: `StudyRepository.listItems` (lexicon + FSRS), `buildCard` (dựng thẻ), `phrases.save` (lưu cụm); nối ở `app.ts`
- Không gọi `@cuelingo/ai-gateway`: không tốn hạn mức; khi API khoá lỗi thì tab Hôm nay và Kho cụm từ vẫn chạy

## Dữ liệu & sự kiện

- Chỉ đọc `sessions`, `debriefs`, `segments`, `user_lexicon`, `lexical_items`, `review_logs`, `glossary_terms`. Mọi query lọc theo `user_id` từ auth context; `sessionIds` của client luôn được lọc lại theo user.
- Khoá là view nên không có bản sao câu gốc, và khoá biến mất ngay khi xoá phiên hoặc dữ liệu cá nhân (view lọc `status <> 'deleted'`). **Ngoại lệ (lệch AC8):** `start()` lưu cụm vào Phrase Bank kèm `user_lexicon.first_context_segment_id` trỏ vào câu thật của cuộc họp. Sau khi xoá mềm phiên, câu đó vẫn hiện ở Kho cụm từ và thẻ ôn cho tới khi `retention.sweep` chạy (7 ngày), theo chính sách hiện có của Phrase Bank; `deleteMyData` thì xoá hết ngay. Xem quyết định mở ở [review](../../06-delivery/2026-11-21-learning-path/03-review.md).
- Không event mới; đo H3 bằng `review_logs`.
- Log chỉ có `sessionId` và số đếm, không có cụm, câu hay tiêu đề.
- Một query mỗi bảng (không N+1), giới hạn 20 phiên. Nếu chậm thì thêm index `review_logs (user_id, item_id, at)` bằng file migration mới.

## Câu hỏi mở

- Tiêu đề phiên thường rỗng nên khoá chuẩn bị hiếm khi hiện; cần đo số lần hiện
- Nâng lên bảng `course_enrollments` (ẩn/lưu trữ khoá) hoặc sắp thứ tự bằng AI chỉ khi có số đo; xem phương án C, D trong hồ sơ

## Liên hệ với mục tiêu

Khoá từ cuộc họp và mục tiêu cùng nằm trong `LearningPathPanel`, nhưng độc lập: mục tiêu là bảng thật, gọi AI và tính hạn mức; khoá là view không AI. Khi API mục tiêu lỗi, khoá vẫn hiện. Xem [goals](./goals.md).
