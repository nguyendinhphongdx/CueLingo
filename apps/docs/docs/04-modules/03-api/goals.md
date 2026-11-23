# Goals

> Phần: [API service](./README.md) · Code: `services/api/src/modules/goals/` · Luật thuần: `packages/learner-model/src/goal-lesson.ts` · Quyết định: [ADR 0025](../../08-adr/0025-goal-lessons-shared-content.md)

Bài học theo mục tiêu: người dùng chọn tối đa 3 mục tiêu từ danh mục cố định (8 mục tiêu × 6 bài, tiêu đề cố định), AI viết nội dung từng bài **một lần cho mỗi (mục tiêu, bài, trình độ, ngôn ngữ)** và dùng chung cho mọi người. Chỉ tiếng Anh, chỉ luyện gõ.

## Trách nhiệm

- Lưu mục tiêu của người dùng (mức, hạn chót); tính tiến độ và `nextUp`
- Mở bài: lần đầu của một ô tạo nội dung bằng `lesson.generate`, các lần sau ghim cùng bản cho người đó
- Viết ví dụ cá nhân từ thuật ngữ của người dùng (`lesson.personalize`); lỗi thì bài vẫn mở, không có ví dụ
- Cho ý kiến một câu luyện gõ (`lesson.feedback`); câu **không được lưu, không được log**
- Chấm quiz 6 câu trên server (đạt khi ≥ 4/6), lưu cụm vào Phrase Bank và ghi `review_logs` qua `study.answer`
- Nhận báo lỗi nội dung; đủ 3 người khác nhau báo thì bản nội dung bị gỡ (`retired`), người đã ghim vẫn giữ

## Interface

| Method   | Path                                        | Contract                                                                |
| -------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| `GET`    | `/v1/goals`                                 | → `GoalList` (kèm `nextUp`)                                             |
| `POST`   | `/v1/goals`                                 | `CreateGoalRequest` → `Goal` (201); `409` khi trùng hoặc quá 3 mục tiêu |
| `PATCH`  | `/v1/goals/:id`                             | `UpdateGoalRequest` (`level`, `deadline`) → `Goal`                      |
| `DELETE` | `/v1/goals/:id`                             | 204                                                                     |
| `GET`    | `/v1/goals/:id/lessons/:lessonKey`          | → `LessonView` (quiz không kèm đáp án); lần đầu mất 15–25 giây          |
| `POST`   | `/v1/goals/:id/lessons/:lessonKey/practice` | `PracticeRequest` → `PracticeFeedback`                                  |
| `POST`   | `/v1/goals/:id/lessons/:lessonKey/quiz`     | `QuizSubmitRequest` → `QuizResult`                                      |
| `POST`   | `/v1/goals/:id/lessons/:lessonKey/report`   | `LessonReportRequest` → 204                                             |

Mục tiêu hay bài của người khác → `404`. Lỗi AI → `502 LESSON_FAILED`, không tính hạn mức. Client: `client.goals` trong [core-sdk](../05-packages/core-sdk.md); giao diện dùng chung `GoalPicker`, `GoalLessonView`, `LearningPathPanel` trong [ui](../05-packages/ui.md).

## Quy tắc

| Khái niệm       | Định nghĩa                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Danh mục        | `GOAL_CATALOG` ở `@cuelingo/shared`: 8 mục tiêu, mỗi mục 6 bài, tiêu đề tiếng Việt cố định; AI chỉ viết nội dung                                                                                                                                 |
| Hạn mức         | `lessons_daily` (Free 2, Pro 10, Ultra 20) và `lesson_practice_daily` (Free 20, Pro 150, Ultra 300), reset theo ngày giờ Việt Nam                                                                                                                |
| Cổng hạn mức    | `usage.status` trước khi làm, `usage.add` sau khi thành công; mở lại bài đã mở thì miễn phí                                                                                                                                                      |
| Quiz            | 6 câu, `choice` hoặc `cloze`; đạt khi ≥ 4/6 (`PASS_CORRECT`); đúng = rating 3, sai = rating 1; làm lại được, giữ điểm tốt nhất                                                                                                                   |
| Trạng thái bài  | `todo` chưa mở · `learning` đã mở · `done` đã đạt quiz; không lùi                                                                                                                                                                                |
| `nextUp`        | Mục tiêu có hạn gần nhất (không hạn xếp sau, rồi cũ nhất); bài là bài đầu chưa `done`                                                                                                                                                            |
| Sinh trùng      | Một ô chỉ có một bản `live` (chỉ mục duy nhất từng phần); hai lần mở đầu tiên cùng lúc dùng chung một lần gọi AI                                                                                                                                 |
| Giới hạn luyện  | Tối đa 12 câu/phút/người (bộ nhớ trong tiến trình), ngoài hạn mức ngày                                                                                                                                                                           |
| Trần chi phí mở | Mở bài lần đầu cần gọi model: tối đa 3 lần/phút/người (`maxOpensPerWindow`); ô vừa lỗi nhớ 60 giây (`failureCooldownMs`) nên mở lại ngay không gọi model. Ô đã có nội dung thì không tốn lượt. Cả hai không trừ hạn mức                          |
| Hạn một request | Mở bài mới chờ tối đa 28 giây (`lessonDeadlineMs`, dưới 100 giây của Cloudflare), feedback 8 giây (`feedbackDeadlineMs`); quá hạn trả `LESSON_FAILED`. Lỗi timeout của gateway không thử lại. Việc quá hạn vẫn chạy nốt và lưu nội dung nếu xong |
| Hai tab         | Hai request cùng mở một bài: chỉ request ghi được phần cá nhân (`UPDATE … WHERE personal IS NULL`) mới cộng `lessons_daily`                                                                                                                      |

## Cờ tắt (`GOAL_LESSONS_ENABLED`)

Mặc định **tắt ở production**, bật ở dev và test (như `INVITES_REQUIRED`); đặt `true`/`false` để ghi đè. Khi tắt: `GET /v1/goals`, tạo/sửa/xoá mục tiêu, mở bài **đã mở** và nộp quiz vẫn chạy; mở bài mới và luyện câu trả `503 LESSONS_DISABLED` ("Tính năng bài học theo mục tiêu chưa mở"), không gọi AI, không trừ hạn mức. **Chỉ bật ở production sau khi chạy `pnpm eval:lesson` với model thật và ghi số liệu vào hồ sơ goal-lessons.**

## AI

| Task                 | Prompt                  | Timeout | Đầu vào                                                              |
| -------------------- | ----------------------- | ------- | -------------------------------------------------------------------- |
| `lesson.generate`    | `lesson.generate@v1`    | 40 s    | Chỉ khoá danh mục, trình độ, ngôn ngữ; không có dữ liệu người dùng   |
| `lesson.personalize` | `lesson.personalize@v1` | 8 s     | Thuật ngữ trong khối `<terms>` (không tin cậy)                       |
| `lesson.feedback`    | `lesson.feedback@v1`    | 4 s     | Câu luyện trong khối `<practice>` (không tin cậy); có model dự phòng |

Mô hình `gemini-3.5-flash-lite` (đổi bằng `AI_LESSON_MODEL`); model dự phòng của `lesson.feedback` là `gemini-3.1-flash-lite` (đổi bằng `AI_LESSON_FALLBACK_MODEL`). Mỗi prompt có hàm kiểm ngữ nghĩa (`checkLessonOutput`, `checkPersonalOutput`, `checkFeedbackOutput`); sai thì tính là lỗi AI. Câu luyện gõ được gửi tới Gemini, xem ADR 0025. Bộ đánh giá: `packages/ai-gateway/scripts/eval-lesson.ts` ([eval](../06-ml/eval.md)).

## Dữ liệu & sự kiện

| Bảng              | Thuộc về  | Nội dung                                                                                 |
| ----------------- | --------- | ---------------------------------------------------------------------------------------- |
| `learning_goals`  | người     | mục tiêu, mức, hạn chót; duy nhất `(user_id, goal_key, language)`                        |
| `lesson_contents` | **chung** | nội dung bài, `prompt_version`, `model`, `revision`, `status`; **không có `user_id`**    |
| `goal_lessons`    | người     | ghim một `content_id`, ví dụ cá nhân, `best_correct`, `attempts`, `opened_at`, `done_at` |
| `lesson_reports`  | người     | một báo lỗi của một người cho một bản nội dung                                           |

- Mọi query theo người đều lọc `user_id` từ auth context; có test ranh giới người dùng.
- `deleteMyData` xoá `learning_goals`, `goal_lessons`, `lesson_reports` của người đó, **không** xoá `lesson_contents`. Mục tiêu không nằm trong export dữ liệu.
- Câu luyện gõ không được lưu; log chỉ có id, kết luận, số đếm và thời gian. Không event mới.

## Phụ thuộc

- `@cuelingo/learner-model` (`goal-lesson.ts`), `@cuelingo/shared` (`goals.ts`, `goal.dto.ts`), `@cuelingo/prompts`, `@cuelingo/ai-gateway`
- Cổng nối ở `app.ts`: `usage`, `listItems`, `phrases.save`, `study.answer`, `listTerms` (glossary + phrases)
- Mở bài lỗi (`502 LESSON_FAILED`, `429 RATE_LIMITED`) có mã lỗi riêng (thông điệp API bằng tiếng Anh như các module khác; web và desktop dịch theo mã sang tiếng Việt) và không trừ hạn mức
- Không có `gateway` (thiếu khoá AI) thì mở bài mới trả `LESSON_FAILED`; danh sách mục tiêu và bài đã mở vẫn chạy
