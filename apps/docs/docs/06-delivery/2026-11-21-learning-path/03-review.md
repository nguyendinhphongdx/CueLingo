# Review — learning-path

## Thay đổi so với plan

Làm đúng phương án B, 9 bước, không migration, không worker, không gọi AI. Chưa commit.

| Dấu         | File / hành vi                                                                                                                                                                                                                               | Chi tiết (lý do nếu khác plan)                                                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 ADDED    | `packages/shared/src/dto/course.dto.ts` (+ test)                                                                                                                                                                                             | `Lesson` có thêm `origin` (`hard`/`phrase`/`rephrase`); `CourseList.nextUp` là `{sessionId, headline, phrase, saved}`; `PrepCourse.lessons` ≤ 10                                                            |
| 🟢 ADDED    | `packages/learner-model/src/course.ts` (+ test)                                                                                                                                                                                              | `buildLessons`, `lessonStatus`, `courseProgress`, `pickNextUp`, `orderPrepLessons`. Lọc bài không dựng được thẻ nằm ở đây (cần nghĩa hoặc câu chứa cụm)                                                     |
| 🟢 ADDED    | `services/api/src/modules/courses/` (repository, memory, service, routes, test, index), `test/integration/courses.int.test.ts`                                                                                                               | Bộ nhớ đọc lại repo sessions/debrief/glossary trong bộ nhớ, nên test xoá phiên đi qua `DELETE /v1/sessions/:id` thật                                                                                        |
| 🟡 MODIFIED | `services/api/src/app.ts`, `server.ts`, `testing.ts`; `test/integration/auth.int.test.ts`, `invites.int.test.ts`                                                                                                                             | Thêm `repos.courses` (bắt buộc vì `buildApp` gọi trực tiếp ở hai test này). `app.ts` nối `listItems` của study và `phrases.save` vào courses                                                                |
| 🟡 MODIFIED | `modules/review/index.ts`, `study.routes.ts`, `modules/debrief/index.ts`                                                                                                                                                                     | Chỉ export thêm (`buildCard`, `StudyItem`, `QueueQuerySchema`, `InMemoryDebriefRepository`); không đổi hành vi                                                                                              |
| 🟢 ADDED    | `packages/core-sdk/src/courses.ts` (+ test), gắn ở `index.ts`                                                                                                                                                                                | —                                                                                                                                                                                                           |
| 🟢 ADDED    | `packages/ui/src/components/learning-path-panel.tsx` (+ test)                                                                                                                                                                                | Dùng kiểu cấu trúc riêng (`PathData`), không import `@cuelingo/shared` vì trang ui.md nói ui không phụ thuộc shared (trừ ngoại lệ bridge)                                                                   |
| 🟡 MODIFIED | `packages/ui/src/lib/roadmap.ts` (+ test)                                                                                                                                                                                                    | Thêm tab thứ tư `path` "Lộ trình" và một bullet ở feature `review`                                                                                                                                          |
| 🟢 ADDED    | `apps/web/src/features/learning-path/` (hook, tab, test, index)                                                                                                                                                                              | Test chỉ phủ `courseQueueSource`; không có RTL trong web nên luồng bấm nút chưa có test tự động                                                                                                             |
| 🟡 MODIFIED | `apps/web/src/features/review/{use-review,ReviewPage,ReviewTabs}`, `features/debrief/DebriefPage.tsx`                                                                                                                                        | `useReview(language, source?)`, nguồn mặc định giữ `/v1/review/queue` (test cũ không đổi). Tab test web và desktop đổi từ 3 sang 4 tab (bắt buộc). Link "Học khoá này"                                      |
| 🟢 ADDED    | `apps/desktop/src/study/{courses-api,use-learning-path,LearningPathPage}`, `calendar/{match-sessions,use-meeting-prep}` (+ test)                                                                                                             | `courses-api` dùng `createClient(...).courses` như `usage-api`                                                                                                                                              |
| 🟡 MODIFIED | `apps/desktop/src/study/{use-review,ReviewPage,index}`, `app/ReviewTabs`, `calendar/CalendarHintCard`                                                                                                                                        | "Chuẩn bị" hiện **ngay trong thẻ lịch** (liệt kê tối đa 5 cụm + thuật ngữ), không chuyển sang tab. Plan chỉ nói "nút Chuẩn bị trên CalendarHintCard"; chọn hiển thị tại chỗ vì khoá chuẩn bị không lưu (G3) |
| 🟢 ADDED    | `apps/docs/docs/04-modules/03-api/courses.md`                                                                                                                                                                                                | —                                                                                                                                                                                                           |
| 🟡 MODIFIED | docs: `03-api/README`, `phrases-review` (sửa lệch §1.3), `05-packages/{learner-model,core-sdk,ui}`, `02-web/{review,debrief}`, `01-desktop/session-controller`, `02-product/01-features`, `03-architecture/{05-learner-model,07-data-model}` | `07-data-model` ghi chú tên `exercise_type` thực tế, không migration                                                                                                                                        |

Lệch nhỏ so với plan:

- Web: `LearningPathTab` nhận `renderSitting` từ `ReviewTabs` thay vì import `ReviewTodayPanel`, vì luật `web-features-via-index` chặn import sâu và import qua index sẽ tạo vòng giữa hai feature.
- `GET /v1/courses/:id/queue` dùng lại `QueueQuerySchema` của review nên chấp nhận `language` nhưng bỏ qua, dùng ngôn ngữ của phiên.
- `POST /v1/courses/prep` mặc định ngôn ngữ `en` khi không gửi `language`.
- Chưa thêm index `review_logs (user_id, item_id, at)` (plan: chỉ sau khi đo).

**Docs đã cập nhật:** xem hàng docs ở bảng trên. Không cần ADR (phương án B).

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md):

- [x] Ranh giới và bảo mật: `userId` chỉ từ `request.userId`; mọi query repository có `user_id` hoặc join `sessions.user_id`; `sessionIds` của `prep` được lọc theo user; test user B nhận `404` (đọc, start, queue) và `prep` với phiên của A trả rỗng.
- [x] Hợp đồng: `course.dto.ts` ở `@cuelingo/shared`, hàng đợi và câu trả lời dùng lại schema ôn tập; không breaking.
- [x] Kiến trúc: `learner-model` thuần; API không import SDK AI; desktop gọi qua core-sdk; ui không gọi API.
- [x] AI: không có lời gọi AI (AC9 thoả theo thiết kế).
- [x] Test: theo bảng AC bên dưới.
- [x] Docs: xem trên.
- [x] Phạm vi: không migration, không worker, không event mới.

Ánh xạ AC → test: AC1 `courses.test.ts` (thứ tự, dưới 3 bài, debrief version mới); AC2 `match-sessions.test.ts`, `CalendarHintCard.test.tsx`, `CalendarHintCard.off.test.tsx`, `courses.test.ts` (prep); AC3 `course.test.ts`; AC4 `courses.test.ts` (trả lời qua `/v1/review/answer`, không có endpoint chấm riêng); AC5 `use-learning-path.test.ts` (web, desktop); AC6 `learning-path-panel.test.tsx`, `roadmap.test.ts`, `ReviewTabs.test.tsx` (web, desktop), `shared-ui.test.ts`; AC7, AC8, AC10 `courses.test.ts`; AC9 `learning-path-panel.test.tsx` (lỗi tiếng Việt) và thiết kế không gọi AI.

```bash
pnpm verify
pnpm docs:build
```

Đã chạy thật: chỉ test tự động (kết quả ở báo cáo cuối của người làm). `pnpm check:deps` chạy ngoài sandbox vì sandbox chặn đọc `apps/desktop/.env`.

**CHƯA chạy thật:**

- `pnpm test:int` (gồm `courses.int.test.ts`): môi trường dùng Node 22.14 (< 22.19, Testcontainers cần) và Docker bị chặn; mọi file int test lỗi ngay khi nạp, nên SQL của `courses.repository.ts` (`LATERAL`, `ANY(...::uuid[])`) chưa chạy với Postgres thật.
- Chưa mở web hay app desktop để bấm luồng: tab Lộ trình, "Bắt đầu khoá", một lần học, nút "Chuẩn bị" trên thẻ lịch (cần macOS, lịch bật và phiên cũ trùng tiêu đề).
- Không có test tự động cho hành vi bấm nút của `LearningPathTab` (web) và `LearningPathPage` (desktop); chỉ test phần thuần.

## Cho người review — đọc theo thứ tự

| #   | File                                                            | Soi gì                                                                                                        |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | `packages/learner-model/src/course.ts`                          | Thứ tự bài, lọc bài không dựng được, ngưỡng `rating ≥ 3`, mốc `since`                                         |
| 2   | `packages/shared/src/dto/course.dto.ts`                         | Hình dạng contract                                                                                            |
| 3   | `services/api/src/modules/courses/courses.repository.ts`        | SQL: lọc `user_id`, `status <> 'deleted'`, bản debrief mới nhất, một query mỗi bảng (chưa chạy trên Postgres) |
| 4   | `services/api/src/modules/courses/courses.service.ts`, `routes` | Dựng khoá, `start` idempotent, hàng đợi ≤ 5, `prep` không ghi, log chỉ id và số đếm                           |
| 5   | `services/api/src/modules/courses/courses.test.ts`              | Ranh giới người dùng, xoá phiên, log                                                                          |
| 6   | `packages/ui/src/components/learning-path-panel.tsx`            | Nhãn nút nói rõ số cụm thêm vào Kho cụm từ; không hard-code màu                                               |
| 7   | `apps/web/.../use-review.ts`, `apps/desktop/.../use-review.ts`  | Nguồn mặc định không đổi hành vi ôn hằng ngày                                                                 |
| 8   | `apps/desktop/src/calendar/*`                                   | Tiêu đề lịch chỉ so trên máy, API chỉ nhận `sessionIds`                                                       |
| 9   | `apps/docs/docs/04-modules/03-api/courses.md`                   | Khớp code                                                                                                     |

## Lỗi tìm thấy khi review/test

| Lỗi                                                                                   | Tìm ở                     | Sửa                                              |
| ------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------ |
| `LearningPathTab.test.tsx` lỗi hoisting của `vi.mock` (biến dùng trước khi khởi tạo)  | `vitest` web              | Dùng `vi.hoisted`                                |
| `buildApp` thiếu `repos.courses` trong hai int test gọi trực tiếp                     | `tsc` của `@cuelingo/api` | Thêm `createPostgresCoursesRepository(sql)`      |
| `pnpm check:deps` báo `EPERM` khi stat `apps/desktop/.env`                            | sandbox                   | Chạy lại ngoài sandbox; kết quả không có vi phạm |
| `check:deps` báo `web-features-via-index` (learning-path import sâu vào review)       | `pnpm check:deps`         | Truyền `renderSitting` từ `ReviewTabs`           |
| Link neo `#ba-tab-...` trong `phrase-bank.md`, `progress.md` hỏng sau khi đổi tên mục | `pnpm docs:build`         | Cập nhật neo sang `#bốn-tab-...`                 |
| Panel import kiểu từ `@cuelingo/shared` trái với trang ui.md                          | tự review                 | Đổi sang kiểu cấu trúc riêng trong panel         |

## Review độc lập: mục 🟡

| Mục                                                           | Trạng thái | Chi tiết                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nút "Bắt đầu khoá" kẹt sau lỗi (lỗi start thay hết danh sách) | Đã sửa     | Panel có prop `actionError`: hiện `NoticeStrip` trên danh sách, danh sách và nút vẫn còn. Hai hook web và desktop tách `error` (tải danh sách) khỏi `actionError` (start). Test mới ở `learning-path-panel.test.tsx`                                               |
| Test xoá dữ liệu cá nhân yếu                                  | Đã sửa     | `courses.int.test.ts`: tách test mới, tạo phiên mới có debrief rồi `deleteMyData`, mới kiểm danh sách rỗng (chưa chạy được, cùng lý do Node/Docker)                                                                                                                |
| Thiếu test AC9 ở tầng tab                                     | Đã sửa     | `ReviewTabs.test.tsx` (web): khi panel Lộ trình lỗi vẫn đủ bốn tab và thông báo tiếng Việt; không dùng RTL nên là test markup, không phải bấm tab thật                                                                                                             |
| Docs sai về AC8                                               | Đã sửa     | `courses.md` nói đúng thực tế (câu gốc còn trong Phrase Bank sau xoá mềm cho tới `retention.sweep`, 7 ngày)                                                                                                                                                        |
| **Quyết định mở cho người dùng:** lệch AC8                    | Còn mở     | Sau xoá mềm phiên, `start()` đã làm câu thật của cuộc họp còn hiện ở Kho cụm từ/thẻ ôn tới 7 ngày. Chấp nhận (theo chính sách Phrase Bank hiện có) hay lọc phiên đã xoá trong `listItems` (`study.repository.ts`) thành việc riêng? Chưa sửa `study.repository.ts` |
| Lặp khung "đang học" ở tab Lộ trình web/desktop               | Làm sau    | Có thể gộp sau; ngoài phạm vi lần này                                                                                                                                                                                                                              |
