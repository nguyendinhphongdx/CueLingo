# Plan — learning-path

| Trạng thái | Spec                                              | Phương án chọn                               |
| ---------- | ------------------------------------------------- | -------------------------------------------- |
| Plan       | [01-specs.md](./01-specs.md) (đã duyệt, AC1–AC10) | B: khoá là view tính lúc đọc, không bảng mới |

## 1. Bối cảnh code

### 1.1 Cái đã có và sẽ dùng lại

| Thứ                   | File                                                                                                                 | Dùng cho khoá thế nào                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Debrief (5 khối)      | `packages/shared/src/dto/debrief.dto.ts`, bảng `debriefs` (`hard_segment_ids`, `phrase_suggestions`, `rephrase`)     | Nguồn bài: `phraseSuggestions` (≤ 10), `rephrase.better` (≤ 6), `hardSegmentIds` làm câu ngữ cảnh. Bản `version` cao nhất                   |
| Đọc debrief theo user | `services/api/src/modules/debrief/debrief.repository.ts` (JOIN `sessions.user_id`)                                   | Mẫu query có ranh giới user; `followup` đã nhận `repos.debrief` ở `app.ts` → tiền lệ ghép repo                                              |
| Ôn FSRS               | `services/api/src/modules/review/study.service.ts` (`buildCard`, `queue`, `answer`), `study.repository.ts`           | `buildCard` dựng 3 dạng bài (`recognize`, `cloze`, `dictation`). `POST /v1/review/answer` ghi `review_logs` + `user_lexicon.receptive_fsrs` |
| Lưu cụm từ            | `services/api/src/modules/review/phrases.service.ts` (`save`, idempotent, nhận `sessionId`/`segmentId`)              | "Bắt đầu khoá" = lưu các cụm của khoá vào Phrase Bank (cần dòng `user_lexicon` thì FSRS mới chạy)                                           |
| FSRS thuần            | `packages/learner-model/src/fsrs.ts` (`isDue`, `reviewCard`)                                                         | Thêm `course.ts` cạnh đó cho thứ tự bài và tiến độ                                                                                          |
| Tab Ôn tập dùng chung | `packages/ui/src/lib/roadmap.ts` (`REVIEW_TABS`), `packages/ui/src/components/review-tabs-frame.tsx`                 | Thêm tab thứ tư "Lộ trình"; web `apps/web/src/features/review/ReviewTabs.tsx`, desktop `apps/desktop/src/app/ReviewTabs.tsx` tự có tab      |
| Màn ôn                | web `apps/web/src/features/review/ReviewPage.tsx` (`ReviewSession`), desktop `apps/desktop/src/study/ReviewPage.tsx` | Chạy bài của khoá bằng chính màn này, chỉ đổi nguồn hàng đợi (AC5)                                                                          |
| Lịch                  | `apps/desktop/src/calendar/` (`calendar-hint.ts`, `calendar-prefs.ts`: opt-in, chỉ trên máy)                         | AC2: chỉ desktop có lịch; tiêu đề lịch **không rời máy**                                                                                    |
| Xoá                   | `sessions.repository.ts` (xoá mềm `status='deleted'`), `privacy.repository.ts` (`deleteMyData`)                      | View lọc `status <> 'deleted'` → khoá tự biến mất (AC8)                                                                                     |
| Log không lộ nội dung | `services/api/src/modules/followup/followup.test.ts:290` (bắt `logger.stream`)                                       | Mẫu test AC10                                                                                                                               |

### 1.2 Convention và module mẫu

| Tầng          | Convention                                                                | Mẫu copy                                                      |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Contract      | `05-engineering/conventions/shared-contract.md`                           | `packages/shared/src/dto/glossary.dto.ts`                     |
| API module    | `conventions/api-module.md`                                               | `services/api/src/modules/glossary/` → `modules/courses/`     |
| Learner rule  | `03-architecture/05-learner-model.md`, `packages/learner-model/AGENTS.md` | `packages/learner-model/src/placement.ts` + test              |
| Client        | `shared-contract.md § Client`                                             | `packages/core-sdk/src/glossary.ts`                           |
| UI dùng chung | `conventions/shared-ui.md`                                                | `packages/ui/src/components/stat-card.tsx`, `progress.tsx`    |
| Web feature   | `conventions/web-feature.md`                                              | `apps/web/src/features/glossary/` → `features/learning-path/` |
| Desktop       | `conventions/native-desktop.md`                                           | `apps/desktop/src/study/`                                     |

### 1.3 Lệch giữa doc và code phát hiện khi đọc

| Chỗ                                   | Lệch                                                                                                               | Xử lý                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `04-modules/03-api/phrases-review.md` | Ghi `GET /v1/review/queue`, `POST /v1/review/answer` "Chưa dựng"; code đã có (`study.routes.ts`)                   | Sửa ở bước 9 (cùng task vì trang này bị chạm)                         |
| `packages/core-sdk`                   | Không có `review`/`phrases`/`progress`; web gọi qua `apps/web/src/lib/client.ts`, desktop qua `study/study-api.ts` | Không dời trong task này (lazy-coding). Khoá mới đi đúng mẫu core-sdk |
| `review_logs.exercise_type` comment   | Comment ghi `listen_choose`, `produce`, `cloze`; code ghi `recognize`, `cloze`, `dictation`                        | Chỉ ghi chú ở `data-model`, không migration                           |

## 2. Phương án

| #   | Phương án                                                                                                                                                                                                                      | Ưu                                                                                                                                                                                                                     | Nhược                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Bảng `courses` + `course_lessons` (migration mới), job `course.generate` do worker debrief enqueue sau khi ghi debrief; bài lưu bản sao cụm/câu và `status`                                                                    | Khoá "có thật", id ổn định; dễ thêm sắp xếp bằng AI, lưu trữ lịch sử, giao khoá (B2B) sau này                                                                                                                          | Thêm bản sao câu gốc → phải nối vào `deleteMyData`, xoá phiên, retention (AC8 khó hơn). Trạng thái bài là nguồn sự thật thứ hai bên cạnh `review_logs` (trái AC4). Tạo lại debrief (`version+1`) lệch khoá. Migration + job + worker = 2 điểm mở rộng thêm |
| B   | **Không bảng mới.** Khoá = view tính lúc đọc từ debrief mới nhất của một phiên chưa xoá + `user_lexicon` + `review_logs` sau `debriefs.created_at`. Khoá id = `sessionId`, bài id = `itemId` (hoặc cụm chuẩn hoá khi chưa lưu) | Không migration, không dữ liệu nhân bản → AC8 tự đúng. Tiến độ chỉ đọc `review_logs` → một bộ chấm (AC4). Không gọi AI → chi phí 0, AC9 thoả theo thiết kế. Đảo ngược dễ: muốn A sau này thì materialize từ chính view | Tính lại mỗi lần đọc (giới hạn 20 phiên gần nhất; quy mô MVP đủ). Không "ẩn/lưu trữ" khoá riêng được. Khoá chuẩn bị họp (AC2) chỉ là gợi ý tạm, không lưu tiến độ riêng                                                                                    |
| C   | B + một bảng mỏng `course_enrollments(user_id, session_id, started_at, archived_at)` chỉ ghi id và thời điểm                                                                                                                   | Có "bắt đầu", "ẩn khoá", sắp theo lần học gần nhất; không chứa câu nên AC8 vẫn dễ (FK `ON DELETE CASCADE` + lọc phiên đã xoá)                                                                                          | Thêm migration cho một nhu cầu spec chưa đòi (không có AC ẩn/lưu trữ). Phải thêm vào `deleteMyData`                                                                                                                                                        |
| D   | Như A/B nhưng AI (`course.plan@v1`) nhóm bài theo chủ đề và sắp thứ tự                                                                                                                                                         | Bài "hay" hơn, có tiêu đề chủ đề                                                                                                                                                                                       | Thêm một lời gọi AI mỗi cuộc họp (chi phí, quota, eval, prompt mới). Debrief đã do AI chọn và sắp cụm từ; thêm AI không có số đo chứng minh lợi                                                                                                            |

**Chọn: B.** Lý do: (1) khớp AC4 nhất, tiến độ chỉ là hàm của `review_logs`, không có bộ chấm thứ hai; (2) AC8 đúng mà không cần đụng xoá dữ liệu; (3) không migration, không AI, không job: rủi ro và chi phí thấp nhất cho một tính năng Đợt 1 chưa có số đo; (4) dễ đảo ngược, nâng lên C hoặc A sau khi có số đo mà không mất dữ liệu (nguồn vẫn là debrief + `review_logs`). C là đường lui khi người dùng muốn "ẩn khoá"; D để sau khi có eval.

### 2.1 Trả lời câu hỏi mở của spec

| Câu hỏi             | Đề xuất (người dùng chốt)                                                                                                                                                                                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Độ dài khoá         | **1 bài = 1 cụm từ/câu**, làm bằng một thẻ ôn có sẵn. Khoá có **3–10 bài** (`COURSE_MIN_LESSONS = 3`, `COURSE_MAX_LESSONS = 10`); dưới 3 bài dựng được thì không có khoá. **Một lần học ≤ 5 bài** (`SITTING_SIZE = 5`, khoảng 5–10 phút, dưới ngưỡng 15 phút)                                                               |
| Ai quyết thứ tự bài | **Thuật toán thuần** ở `@cuelingo/learner-model`: (1) cụm nằm trong một đoạn khó trước, (2) theo thứ tự debrief trả về, (3) câu "nên nói" sau cùng; bài `xong` không đổi chỗ, "việc nên làm tiếp" = bài đầu chưa xong. Khoá chuẩn bị họp xếp theo FSRS (đến hạn sớm nhất, rồi `lapses` cao). Không AI → AC9 thoả, chi phí 0 |
| Cần ADR không       | **Không**, với phương án B: mọi phần vừa ô Contract, API module, Learner rule, Client, Web feature, Desktop module (xem §2.3). Nếu người dùng chọn A hoặc D → cần ADR (phác ở §2.3)                                                                                                                                         |
| Huy hiệu / ăn mừng  | **Không.** Chỉ tỷ lệ % và nhãn "Đã xong" trên khoá. Không game hoá khi chưa có số đo H3                                                                                                                                                                                                                                     |
| Desktop             | **Cả web và desktop có tab "Lộ trình"** vì panel nằm ở `@cuelingo/ui` (AC6 đòi cùng component, chi phí thêm cho desktop chỉ là nối tab). Khoá chuẩn bị họp (AC2) **chỉ desktop**, vì lịch chỉ có trên desktop                                                                                                               |

### 2.2 Định nghĩa dùng trong code (đề xuất)

| Khái niệm                    | Định nghĩa                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khoá họp (`kind: meeting`)   | Một phiên `status <> 'deleted'`, ngôn ngữ học được, có debrief; id = `sessionId`. Bài lấy từ debrief `version` cao nhất                                                                                                                           |
| Bài chưa lưu                 | Cụm trong debrief chưa có trong `user_lexicon` → `chưa học`. "Bắt đầu khoá" lưu tất cả qua `phrases.save` (kèm `sessionId`, `segmentId` của đoạn khó chứa cụm nếu có → bài `cloze` dùng câu thật)                                                 |
| `chưa học`                   | Không có `review_logs` nào của item kể từ `debriefs.created_at`                                                                                                                                                                                   |
| `đang học`                   | Có log từ mốc đó nhưng chưa có log `rating ≥ 3`                                                                                                                                                                                                   |
| `xong`                       | Có ít nhất một log `rating ≥ 3` (Được/Dễ) từ mốc đó. Không lùi lại khi sau này trả lời "Lại" (FSRS vẫn lo lịch ôn)                                                                                                                                |
| Tiến độ khoá                 | `round(100 × số bài xong / tổng bài)`                                                                                                                                                                                                             |
| Khoá chuẩn bị (`kind: prep`) | Desktop so tiêu đề lịch với tiêu đề phiên **trên máy**, gửi tối đa 5 `sessionId`. API trả cụm đã lưu từ các phiên đó (xếp theo FSRS) + tối đa 10 thuật ngữ cùng ngôn ngữ (chỉ hiển thị, không phải bài). Không lưu, không có trong danh sách khoá |

### 2.3 Điểm mở rộng và ADR

| Phần                        | Điểm mở rộng        | Vừa ô? |
| --------------------------- | ------------------- | ------ |
| `course.dto.ts`             | Contract            | Có     |
| `learner-model/course.ts`   | Learner rule        | Có     |
| `modules/courses/`          | API module          | Có     |
| `core-sdk/courses.ts`       | Client              | Có     |
| `ui` panel + tab            | Shared UI (luật 11) | Có     |
| `features/learning-path/`   | Web feature         | Có     |
| `desktop/study`, `calendar` | Desktop module      | Có     |

Không cần ADR cho B. **Nếu chọn A/D**, ADR `0025-meeting-derived-courses.md` cần nêu: bối cảnh (khoá là thực thể lưu trữ sinh từ nội dung họp); quyết định (bảng, khoá ngoại `ON DELETE CASCADE` theo `sessions`, có/không lưu bản sao câu); hệ quả về xoá dữ liệu (`deleteMyData`, xoá mềm phiên, retention worker), nguồn sự thật trạng thái bài so với `review_logs`; với D thêm chi phí AI/cuộc họp và quota.

| Tác động                            | Có?   | Chi tiết                                                                                                                                                                                                              |
| ----------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB migration                        | Không | Chỉ đọc `debriefs`, `sessions`, `segments`, `user_lexicon`, `lexical_items`, `review_logs`, `glossary_terms`. Có thể cần index `review_logs (user_id, item_id, at)` nếu chậm → file migration **mới**, chỉ sau khi đo |
| Contract (`@cuelingo/shared`)       | Có    | Mới: `course.dto.ts`. Không đổi schema cũ; hàng đợi khoá dùng lại `ReviewQueueSchema`, trả lời dùng lại `ReviewAnswerRequestSchema`. Không breaking                                                                   |
| Event / Learner Model               | Có    | Không event mới. Bài xong đi `POST /v1/review/answer` như cũ. Thêm hàm thuần `course.ts` (thứ tự, trạng thái, tiến độ, việc tiếp theo)                                                                                |
| Prompt / model AI                   | Không | Không lời gọi AI mới, không tốn quota                                                                                                                                                                                 |
| Quyền riêng tư / dữ liệu người dùng | Có    | "Bắt đầu khoá" ghi `user_lexicon` (giống bấm lưu từng cụm, UI nói rõ "thêm N cụm vào Kho cụm từ"). Tiêu đề lịch không gửi lên server. Log chỉ id/số lượng                                                             |

## 3. Các bước (mỗi bước ≈ 1 commit)

Không có migration, không có worker (phương án B), nên thứ tự là contract → learner rule → api → client → ui → web → desktop → docs.

| #   | Bước                       | File                                                                                                                                                                                                                                                                                                                                                                                                         | Điểm mở rộng   |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| 1   | Contract khoá              | `packages/shared/src/dto/course.dto.ts` (+ `.test.ts`): `LessonStatus` (`todo`/`learning`/`done`), `Lesson`, `CourseSummary`, `Course`, `CourseList` (kèm `nextUp`), `PrepCourseRequest` (`sessionIds` ≤ 5, `language`), `PrepCourse`, `StartCourseResponse`; export ở `src/index.ts`                                                                                                                        | Contract       |
| 2   | Luật khoá thuần            | `packages/learner-model/src/course.ts` (+ `course.test.ts`): hằng số tên (§2.1), `buildLessons(debrief, lexicon)`, `lessonStatus(logs, since)`, `courseProgress(lessons)`, `pickNextUp(courses)`, `orderPrepLessons(items, now)`; export ở `index.ts`                                                                                                                                                        | Learner rule   |
| 3   | API module `courses` (đọc) | `services/api/src/modules/courses/` copy `glossary/`: `courses.repository.ts` (+ `.memory.ts`), `courses.service.ts`, `courses.routes.ts`, `courses.test.ts`, `index.ts`. `GET /v1/courses?language` (≤ 20 phiên gần nhất + `nextUp`), `GET /v1/courses/:sessionId`. Đăng ký ở `services/api/src/app.ts`; `review/index.ts` export `buildCard`                                                               | API module     |
| 4   | API `courses` (học)        | Cùng module: `POST /v1/courses/:sessionId/start` (gọi `phrases.save` tiêm từ `app.ts`, idempotent), `GET /v1/courses/:sessionId/queue?dictation&language` → `ReviewQueue` ≤ 5 bài chưa xong, `POST /v1/courses/prep`. Test ranh giới user, xoá phiên, log                                                                                                                                                    | API module     |
| 5   | Client                     | `packages/core-sdk/src/courses.ts` (+ `.test.ts`), gắn vào `createClient` ở `src/index.ts`                                                                                                                                                                                                                                                                                                                   | Client         |
| 6   | Panel dùng chung           | `packages/ui/src/components/learning-path-panel.tsx` (+ test): "Việc nên làm tiếp", danh sách khoá với `Progress`, nút "Bắt đầu"/"Học tiếp"; `packages/ui/src/lib/roadmap.ts`: tab `path` "Lộ trình" trong `REVIEW_TABS`, bullet trong feature `review`; cập nhật `roadmap.test.ts`, `shared-ui.test.ts` nếu cần                                                                                             | Shared UI      |
| 7   | Web                        | `apps/web/src/features/learning-path/` (copy `glossary/`): `use-learning-path.ts`, `LearningPathTab.tsx` (+ test); `features/review/ReviewTabs.tsx` nối tab; `features/review/use-review.ts` nhận nguồn hàng đợi (`/v1/review/queue` hoặc hàng đợi khoá) để `ReviewSession` chạy bài khoá; link "Học khoá này" ở `features/debrief/DebriefPage.tsx`                                                          | Web feature    |
| 8   | Desktop                    | `apps/desktop/src/app/ReviewTabs.tsx` nối tab; `apps/desktop/src/study/use-review.ts` nhận nguồn hàng đợi; `apps/desktop/src/calendar/`: hàm thuần `matchSessions(title, sessions)` (+ test) và nút "Chuẩn bị" trên `CalendarHintCard.tsx` khi bật lịch và có phiên khớp                                                                                                                                     | Desktop module |
| 9   | Docs                       | Mới `apps/docs/docs/04-modules/03-api/courses.md`; sửa `03-api/phrases-review.md` (trạng thái endpoint, §1.3), `05-packages/learner-model.md` (interface `course.ts`), `05-packages/core-sdk.md`, `05-packages/ui.md`, `02-web/review.md`, `01-desktop` trang lịch/ôn tập, `02-product/01-features.md` (dòng lộ trình), `03-architecture/05-learner-model.md` (định nghĩa trạng thái bài). `pnpm docs:build` | —              |

Bước 3–4 có thể giao Codex theo `04-brief.md` (phạm vi file rõ); bước 6–8 phụ thuộc bước 5.

### 3.1 Test theo AC

| AC   | Test                                                                                                                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | `courses.test.ts` › phiên có debrief → `GET /v1/courses` có khoá `sessionId` đó, bài đúng thứ tự (đoạn khó → cụm → câu nên nói); dưới 3 bài → không có khoá; debrief `version` mới thay bài                           |
| AC2  | `calendar/match-sessions.test.ts` › khớp tiêu đề, không khớp → không gợi ý; `CalendarHintCard.test.tsx` › lịch tắt → không gọi API; `courses.test.ts` › `POST /v1/courses/prep` chỉ dùng phiên của user, không ghi gì |
| AC3  | `learner-model/course.test.ts` › `lessonStatus` ba trạng thái + biên (`rating` 2 vs 3, log trước mốc bị bỏ), `courseProgress` (0, một phần, 100%), `pickNextUp`                                                       |
| AC4  | `courses.test.ts` › bắt đầu khoá, trả lời qua `POST /v1/review/answer` → FSRS của item đổi và bài thành `done`; không có endpoint chấm riêng                                                                          |
| AC5  | `LearningPathTab.test.tsx` / `ReviewPage.test.tsx` (web, desktop) › hàng đợi khoá render bằng `ReviewSession`; contract khoá dùng `ReviewQueueSchema`                                                                 |
| AC6  | `learning-path-panel.test.tsx` › "Việc nên làm tiếp" + danh sách khoá; `shared-ui.test.ts` xanh; web và desktop `ReviewTabs` test có tab "Lộ trình"                                                                   |
| AC7  | `courses.test.ts` › user B đọc/bắt đầu/lấy hàng đợi khoá của A → `404`; `prep` với `sessionId` của A → bỏ qua; mọi query repository có `user_id`                                                                      |
| AC8  | `courses.test.ts` › xoá phiên → khoá biến mất khỏi danh sách và `GET` trả `404`; sau `deleteMyData` danh sách rỗng (integration `test/integration/courses.int.test.ts`)                                               |
| AC9  | Không gọi AI (ghi trong trang module). `LearningPathTab.test.tsx` › API khoá lỗi → tab Hôm nay và Kho cụm từ vẫn chạy, panel hiện thông báo lỗi tiếng Việt                                                            |
| AC10 | `courses.test.ts` › bắt `logger.stream` (mẫu `followup.test.ts:290`): không chứa cụm, câu, tiêu đề phiên; chỉ id và số đếm                                                                                            |

## 4. Rủi ro

| Rủi ro                                                                                            | Giảm thiểu                                                                                                                          |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| "Bắt đầu khoá" tự thêm nhiều cụm vào Kho cụm từ, người dùng bất ngờ                               | Nút ghi rõ số cụm sẽ thêm; chỉ thêm khi bấm; cụm đã có thì giữ nguyên (save idempotent)                                             |
| Tiêu đề lịch (có thể có tên khách hàng) lộ lên server                                             | So khớp trên máy; API chỉ nhận `sessionId`. Test AC2 kiểm payload                                                                   |
| Tiêu đề phiên thường rỗng → khoá chuẩn bị hiếm khi hiện                                           | Chấp nhận cho Đợt 1; ghi ở câu hỏi mở trang module, đo số lần hiện                                                                  |
| Tính view chậm khi nhiều phiên                                                                    | Giới hạn 20 phiên gần nhất, một query mỗi bảng (không N+1). Chậm thật thì thêm index bằng **file migration mới**, không sửa file cũ |
| Cụm "nên nói" dài không dựng được thẻ (`buildCard` trả `null`: không có nghĩa, không có câu chứa) | Bỏ bài đó (như hàng đợi hiện tại); đếm tổng bài sau khi lọc. Có thể khiến khoá < 3 bài → không có khoá                              |
| Debrief tạo lại làm bài đổi                                                                       | Tiến độ theo `itemId`, không theo vị trí; bài cũ không còn trong debrief mới thì biến khỏi khoá, log vẫn ở FSRS                     |
| Log lộ nội dung                                                                                   | Test AC10; service chỉ log `sessionId`, số bài                                                                                      |
| Chi phí AI                                                                                        | Không có lời gọi AI mới. Đổi sang D → hồ sơ mới + ADR + eval                                                                        |
| Thay đổi `use-review` ở web/desktop làm vỡ ôn hằng ngày                                           | Nguồn mặc định giữ `/v1/review/queue`; test cũ phải xanh không sửa                                                                  |

### 4.1 Giả định

| #   | Giả định                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------- |
| G1  | Đoạn khó không thành bài riêng (dạng bài mới ngoài phạm vi AC5); nó nâng thứ tự và làm câu ngữ cảnh cho cụm      |
| G2  | Một cuộc họp = một khoá; ngôn ngữ không học được (debrief không có khối học) → không có khoá                     |
| G3  | Khoá chuẩn bị là gợi ý tạm, không lưu, không vào danh sách khoá và không có tiến độ dài hạn                      |
| G4  | Không event sản phẩm mới (`course_started`); đo H3 bằng `review_logs`. Cần số đo riêng thì thêm event ở task sau |
