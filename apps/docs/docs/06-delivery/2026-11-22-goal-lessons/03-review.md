# Review — goal-lessons

## Thay đổi so với plan

| Dấu         | File / hành vi                                                                                                                 | Chi tiết                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 ADDED    | `packages/shared/src/goals.ts`, `dto/goal.dto.ts`                                                                              | Danh mục 8×6, contract Zod                                                                                                              |
| 🟢 ADDED    | `packages/learner-model/src/goal-lesson.ts`                                                                                    | Luật thuần: chấm quiz, nextUp, retire                                                                                                   |
| 🟢 ADDED    | `packages/prompts/src/{lesson,lesson-personalize,lesson-feedback}/v1.ts`                                                       | Ba prompt có phiên bản và hàm kiểm ngữ nghĩa                                                                                            |
| 🟢 ADDED    | `packages/ai-gateway/scripts/eval-lesson.ts`                                                                                   | Eval là script TS (plan nói `cuelingo-eval`); **chưa chạy**                                                                             |
| 🟢 ADDED    | `infra/db/migrations/20261122090000_goal_lessons.sql`                                                                          | Đúng một file migration                                                                                                                 |
| 🟢 ADDED    | `services/api/src/modules/goals/`, `test/integration/goals.int.test.ts`                                                        | Module theo mẫu glossary                                                                                                                |
| 🟢 ADDED    | `packages/core-sdk/src/goals.ts`; `packages/ui` (`goal-picker`, `goal-lesson-view`, `lib/goal-lesson`)                         | Client và UI dùng chung                                                                                                                 |
| 🟢 ADDED    | `apps/web/src/features/goals/`, `apps/desktop/src/study/{goals-api,use-goals,GoalLessonPage,GoalEditor}`                       | Web và desktop chỉ dùng UI chung                                                                                                        |
| 🟡 MODIFIED | `plans.ts`, `error-code.ts`, `usage.ts` (ui), `app.ts`, `server.ts`, `testing.ts`, `privacy.repository.ts`                     | 7 metric; `deleteMyData` xoá bảng mục tiêu, không đụng `lesson_contents`; nhiều fixture usage phải thêm 2 metric                        |
| 🟡 MODIFIED | `config.ts`, `.env.example`, `goals.service.ts`, `goals.repository*.ts`, `error-code.ts`, `errors.ts`, `ui/lib/goal-lesson.ts` | Sau review độc lập: cờ `GOAL_LESSONS_ENABLED`, trần chi phí mở bài, hạn một request, `setPersonal` điều kiện, mã lỗi `LESSONS_DISABLED` |
| 🟡 MODIFIED | `LearningPathPanel`, `LearningPathTab`, `LearningPathPage`                                                                     | Prop mới đều tuỳ chọn; mục tiêu chỉ khi ngôn ngữ là `en`                                                                                |

**Docs đã cập nhật:** `03-api/goals.md` (mới), README api, tts, usage, privacy, courses, prompts, ai-gateway, learner-model, shared, core-sdk, ui, web review, ml eval, workflow ai-task, 03-architecture (06, 07, 08), 01-features, ADR 0025.

## Review độc lập: đã sửa gì, còn mở gì

| Mục | Vấn đề                                                  | Đã sửa                                                                                                                                                                                                                     | Trạng thái                                                                                           |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 🔴1 | Mở bài lần đầu không có trần chi phí khi ô lỗi liên tục | Tối đa 3 lần mở cần model/phút/người; ô vừa lỗi nhớ 60 giây; cả hai trả lỗi tiếng Việt, không trừ hạn mức; ô đã có nội dung không tốn lượt. Test unit (cooldown, giới hạn phút, ô có sẵn)                                  | Xong                                                                                                 |
| 🔴2 | Không có cờ tắt                                         | `GOAL_LESSONS_ENABLED` (tắt mặc định ở production, bật dev/test; ghi ở `.env.example` và goals.md); tắt thì mở bài mới và luyện câu trả `503 LESSONS_DISABLED`, đọc bài đã mở và quiz vẫn chạy. Test config + test service | Xong. **Chỉ bật ở production sau khi chạy `pnpm eval:lesson` với model thật và ghi số liệu vào đây** |
| 🟡1 | Hai tab cùng mở một bài bị trừ hai                      | `setPersonal` là `UPDATE … WHERE personal IS NULL RETURNING`; chỉ request thắng cộng hạn mức. Test unit + integration Postgres                                                                                             | Xong                                                                                                 |
| 🟡2 | Không có hạn tổng cho một request                       | Mở bài mới 28 giây, feedback 8 giây; lỗi timeout của gateway không thử lại. Test                                                                                                                                           | Xong                                                                                                 |
| 🟡3 | Thiếu test song song cho `ON CONFLICT DO NOTHING`       | 8 lần `insertContent` đồng thời trên Postgres thật cho đúng một bản `live` (Node 25)                                                                                                                                       | Xong                                                                                                 |
| 🟡4 | `winner!` và `row!` có thể thành 500                    | `insertContent` thử lại 3 lần rồi trả `null`; `pinLesson` trả `null` khi không phải mục tiêu của người đó; service trả `LESSON_FAILED` hoặc 404                                                                            | Xong                                                                                                 |
| 🟡5 | goals.md sai khoá duy nhất, thiếu biến model dự phòng   | Sửa `(user_id, goal_key, language)`, thêm `AI_LESSON_FALLBACK_MODEL`                                                                                                                                                       | Xong                                                                                                 |
| 🟡6 | Thiếu test AC12 cho nhánh lỗi                           | Gateway ném lỗi chứa câu đã gõ: response và log không chứa câu                                                                                                                                                             | Xong                                                                                                 |
| 🟢  | Việc nhỏ                                                | `GOAL_MAX` ở hai `GoalEditor`; bước 4 `ai-task.md` viết lại (eval là script TS); script `pnpm eval:lesson`; câu về thuật ngữ cá nhân gửi Gemini ở 08-security-privacy; test "fourth goal" thêm vào integration             | Xong                                                                                                 |

Còn mở: giới hạn mở bài theo phút nằm trong bộ nhớ từng tiến trình (như giới hạn luyện câu), nhiều instance thì mỗi instance đếm riêng; việc quá hạn vẫn chạy nốt ở nền (có chủ ý, để lưu nội dung nếu xong).

## Tự review

- [x] Ranh giới & bảo mật: `userId` từ auth; mọi query theo người lọc `user_id`; test 404 chéo người dùng (unit và Postgres thật)
- [x] Hợp đồng: Zod ở shared; api, core-sdk, web, desktop cùng đổi
- [x] Kiến trúc: learner-model thuần; `check:deps` xanh
- [x] AI: qua gateway, prompt có phiên bản, đầu vào người dùng trong khối không tin cậy; câu luyện không lưu, không log (có test log, kể cả nhánh lỗi)
- [x] Test: AC1-AC12 có test; lỗi AI không tính hạn mức (AC9)
- [x] Docs: xong, `docs:build` xanh
- [x] Phạm vi: chỉ tiếng Anh, chỉ gõ, không export mục tiêu

```bash
pnpm verify      # xanh; check:deps chạy ngoài sandbox (EPERM đọc .env)
pnpm docs:build  # xanh
pnpm test:int    # Node 25, Postgres thật: 25 file, 110 test xanh
```

Đã chạy thật: unit, integration trên Postgres thật (migration lên xuống, sinh trùng đồng thời, chèn song song `ON CONFLICT`, hai tab, gỡ bản sau 3 báo lỗi, xoá dữ liệu).

**CHƯA chạy thật:** eval AI với model thật (`pnpm eval:lesson`, cần khoá, không có số liệu nào), TTS hai giọng, bấm thử UI web/desktop.

## Cho người review: đọc theo thứ tự

| #   | File                                                  | Soi gì                                                            |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | `infra/db/migrations/20261122090000_goal_lessons.sql` | Chỉ mục duy nhất từng phần; ràng buộc metric; phần down           |
| 2   | `services/api/src/modules/goals/goals.service.ts`     | Cờ, trần chi phí, hạn request, cổng hạn mức, dedupe, ghim, retire |
| 3   | `goals.repository.ts`                                 | Mọi query người lọc `user_id`; `setPersonal` có điều kiện         |
| 4   | `packages/prompts/src/lesson*/v1.ts`                  | Khối không tin cậy, hàm kiểm                                      |
| 5   | `goals.test.ts`, `goals.int.test.ts`                  | Ranh giới người dùng, log không chứa câu                          |
| 6   | `packages/ui/src/components/goal-lesson-view.tsx`     | Quiz, ghi chú riêng tư luyện gõ                                   |

## Lỗi tìm thấy khi review/test

Điểm lệch: eval là script TS thay vì `uv run cuelingo-eval` (đã sửa workflow ai-task cho mọi task).
