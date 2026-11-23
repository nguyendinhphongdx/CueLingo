# Plan — goal-lessons

| Trạng thái | Spec                                              | Phương án chọn                                                                                                |
| ---------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Plan       | [01-specs.md](./01-specs.md) (đã duyệt, AC1–AC13) | B: nội dung bài dùng chung theo (mục tiêu × bài × trình độ × ngôn ngữ), điền ví dụ riêng; sinh khi mở lần đầu |

## 1. Bối cảnh code

### 1.1 Cái đã có và sẽ dùng lại

| Thứ                      | File                                                                                                                                                                                           | Dùng thế nào                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Task AI có schema        | `packages/ai-gateway/src/gateway.ts` (`json()`: parse Zod, thử lại 1 lần, rồi `AiGatewayError`), `tasks.ts` (task → model, timeout, fallback)                                                  | 3 task mới vào `JsonTaskName`, `JsonTaskInputMap`, `buildJsonTaskPrompt`. `json()` đã đáp ứng AC4 phần schema                           |
| Giá model                | `packages/ai-gateway/src/pricing.ts`: `gemini-3.5-flash-lite` 0,25 USD/1M token vào, 1,5 USD/1M ra. TTS chưa có giá                                                                            | Ước lượng ở §2.1; `ai_call` ghi chi phí từng lời gọi (`services/workers/src/lib/ai-calls.ts`, API cùng cơ chế)                          |
| Prompt có phiên bản      | `packages/prompts/src/followup/v1.ts` (`FOLLOWUP_PROMPT_VERSION = 'assist.followup@v1'`, `FollowupOutputSchema`, `checkFollowupOutput`, `clean`)                                               | Mẫu copy: hằng phiên bản `<task>@v1`, schema đầu ra `.strict()`, hàm kiểm ngữ nghĩa sau schema, khối dữ liệu không tin cậy `<facts>`    |
| Eval                     | `packages/ai-gateway/scripts/eval-translate.ts` (chạy thật, in pass/p50/p95); `ml/eval/README.md` chỉ có README                                                                                | Eval thực tế nằm ở script TS; thêm `eval-lesson.ts` cùng kiểu, cập nhật `04-modules/06-ml/eval.md`                                      |
| TTS                      | `services/api/src/modules/tts/` (`POST /v1/tts`, cache file theo `sha256(v1\|voice\|text)`, ≤ 20 lượt mới/phút/người), `TTS_VOICES`, `TTS_MAX_CHARS = 300`                                     | Mỗi lượt hội thoại = 1 lời gọi `/v1/tts` với giọng cố định theo vai (`Kore`/`Puck`) → audio dùng chung giữa mọi người. Không đổi module |
| Hạn mức                  | `packages/shared/src/plans.ts` (`USAGE_METRICS`, `DEFAULT_PLAN_LIMITS`, `isDailyMetric`), `modules/usage/usage.service.ts` (`status`, `add`, `reserve`); `packages/ui/src/lib/usage.ts` (nhãn) | Thêm 2 metric ngày. Dùng `status` trước + `add` sau khi thành công (mẫu dịch) → lỗi AI không bị trừ (AC9), không cần hàm hoàn trả       |
| Cách gọi AI hiện có      | `modules/followup/followup.service.ts` (giới hạn/phút trong bộ nhớ, kiểm đầu ra), `modules/assist/index.ts` (cổng `assist_daily`)                                                              | Mẫu service + giới hạn tốc độ. `assist.compose` đã gửi câu người dùng gõ tới Gemini → tiền lệ nhà cung cấp                              |
| Khoá họp (learning-path) | `modules/courses/`, `packages/learner-model/src/course.ts`, `packages/shared/src/dto/course.dto.ts`                                                                                            | Không sửa. Khoá mục tiêu là module riêng; panel gộp cả hai                                                                              |
| Panel Lộ trình           | `packages/ui/src/components/learning-path-panel.tsx` (kiểu cấu trúc riêng, không import shared), `REVIEW_TABS` ở `ui/src/lib/roadmap.ts`                                                       | Thêm prop tuỳ chọn cho khoá mục tiêu (AC8, luật 11)                                                                                     |
| Ôn FSRS                  | `modules/review/study.service.ts` (`answer` → `review_logs` + FSRS), `phrases.service.ts` (`save` idempotent), `ExerciseTypeSchema` (`recognize`/`cloze`/`dictation`)                          | Kiểm tra cuối bài ghi qua đúng đường này (AC7): lưu cụm chính của bài vào Kho cụm từ, mỗi câu hỏi → một `answer`                        |
| Trình độ                 | `learner_languages.listening_level` (`a2`…`c1`, `PlacementLevelSchema`)                                                                                                                        | Trình độ mặc định của mục tiêu. **Không có trình độ nói** trong DB → giả định G2                                                        |
| Xoá dữ liệu              | `modules/privacy/privacy.repository.ts` (`deleteMyData`, một transaction), ADR 0022 (counter còn lại)                                                                                          | Thêm `DELETE` cho bảng mới có `user_id`                                                                                                 |
| Job nền                  | `packages/shared/src/jobs.ts`, `services/workers/src/jobs/`                                                                                                                                    | Phương án chọn **không** cần job                                                                                                        |

### 1.2 Convention và module mẫu

| Tầng          | Convention                                        | Mẫu copy                                                          |
| ------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| Contract      | `conventions/shared-contract.md`                  | `packages/shared/src/dto/glossary.dto.ts` → `goal.dto.ts`         |
| AI task       | `conventions/ai-calls.md`, `workflows/ai-task.md` | `packages/prompts/src/followup/`                                  |
| Learner rule  | `03-architecture/05-learner-model.md`             | `packages/learner-model/src/course.ts`                            |
| Migration     | `03-architecture/07-data-model.md`, ADR 0009      | `infra/db/migrations/20261114090000_plans_usage.sql`              |
| API module    | `conventions/api-module.md`                       | `services/api/src/modules/glossary/` → `modules/goals/`           |
| Client        | `shared-contract.md § Client`                     | `packages/core-sdk/src/courses.ts`                                |
| UI dùng chung | `conventions/shared-ui.md`                        | `learning-path-panel.tsx`                                         |
| Web / desktop | `web-feature.md`, `native-desktop.md`             | `apps/web/src/features/learning-path/`, `apps/desktop/src/study/` |

### 1.3 Lệch giữa doc và code

| Chỗ                           | Lệch                                                                                     | Xử lý                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `workflows/ai-task.md` bước 4 | Ghi `uv run cuelingo-eval` ở `ml/eval`; thực tế eval là script TS ở `ai-gateway/scripts` | Làm theo code (module mẫu thắng), sửa `ai-task.md` + `eval.md` ở bước docs |
| `TtsRequestSchema.voice`      | Comment: "chỉ để thử giọng"                                                              | Dùng thêm cho giọng theo vai; sửa comment + `tts.md`                       |

## 2. Phương án

Phần đắt nhất là **nội dung bài** (≈ 3k token ra + ≈ 45 giây audio). Hai trục: dùng chung hay riêng; sinh lúc mở hay job nền.

| #   | Phương án                                                                                                                                                                                             | Ưu                                                                                                                                                                              | Nhược                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Riêng từng người, sinh lúc mở.** Mỗi người mở bài → một lời gọi sinh trọn bài có thuật ngữ của họ; hội thoại riêng nên audio riêng                                                                  | Cá nhân hoá sâu nhất; không có bảng dùng chung, ADR nhẹ hơn                                                                                                                     | ≈ 0,023 USD/bài/người (TTS chiếm 2/3), ≈ 0,14 USD/khoá; mỗi người mới đều chờ ≈ 15–25 s; mỗi bài một bản → eval không đại diện; thuật ngữ người dùng nằm trong nội dung dài  |
| B   | **Dùng chung theo (mục tiêu × bài × trình độ × ngôn ngữ) + điền ví dụ riêng, sinh lúc mở lần đầu.** Bản chung không chứa dữ liệu người dùng; một lời gọi nhỏ thêm 2–3 câu ví dụ dùng thuật ngữ của họ | Chi phí cận biên ≈ 0,004 USD/bài/người; audio hội thoại cache chung; người thứ hai trở đi mở gần như ngay; eval phủ được toàn bộ (≤ 192 bản); báo lỗi một lần sửa cho mọi người | Người đầu tiên ở mỗi ô chờ ≈ 15–25 s; cá nhân hoá nông hơn A; thêm bảng dùng chung + ghim phiên bản; cần ADR                                                                 |
| C   | **Như A hoặc B nhưng job nền sinh trước** cả khoá khi đặt mục tiêu (`goal.generate` trong `services/workers`)                                                                                         | Mở bài không chờ                                                                                                                                                                | Trả tiền cho bài không bao giờ mở (khoá 6 bài, người học thường dừng sớm); thêm job + payload + trạng thái "đang sinh" + đường lỗi nền cho AC9; với A: 0,14 USD ngay khi bấm |

**Chọn: B** — rẻ hơn A ≈ 5 lần ở cận biên, audio dùng chung, chất lượng kiểm được vì số bản hữu hạn, người dùng vẫn không phải đợi lâu sau khi ô đã có bản. Không chọn C: tốn tiền cho bài không mở và thêm job; nếu thời gian chờ lần đầu thành vấn đề thì thêm job "làm nóng" bản chung sau (vẫn trong B). Quyết định lưu nội dung AI dùng chung giữa người dùng → **ADR 0025** (§2.4).

### 2.1 Ước lượng chi phí AI

Giả định: model `gemini-3.5-flash-lite` (giá trong `pricing.ts`); TTS **chưa có giá trong repo**, tạm lấy giá Gemini Flash TTS công khai 10 USD/1M token audio ra, 32 token/giây (cần xác minh bằng `ai_call` thật); hội thoại 8 lượt ≈ 45 giây; mỗi bài 3 câu luyện × 2 lần gõ.

| Lời gọi                           | Token vào / ra      | USD/lần                               | Lần/bài/người (B)                 | Lần/bài/người (A) |
| --------------------------------- | ------------------- | ------------------------------------- | --------------------------------- | ----------------- |
| `lesson.generate` (trọn bài)      | ≈ 2.000 / 3.000     | 0,0050 (thử lại schema: tối đa 0,010) | 0 (chung)                         | 1                 |
| TTS hội thoại (8 lượt, 45 s)      | ≈ 1.440 token audio | ≈ 0,0144                              | 0 (cache chung)                   | 1                 |
| `lesson.personalize` (2–3 ví dụ)  | ≈ 1.000 / 400       | 0,00085                               | 1 (bỏ qua nếu không có thuật ngữ) | 0                 |
| `lesson.feedback` (góp ý một câu) | ≈ 700 / 250         | 0,00055                               | 6                                 | 6                 |
| **Cộng/bài/người**                |                     |                                       | **≈ 0,004**                       | **≈ 0,023**       |
| **Khoá 6 bài/người**              |                     |                                       | **≈ 0,025**                       | **≈ 0,14**        |

Chi phí một lần của bản chung (B): 8 mục tiêu × 6 bài × 4 trình độ = 192 bản × ≈ 0,02 USD ≈ **3,9 USD** cho tiếng Anh mỗi phiên bản prompt (chỉ trả cho ô có người mở). Trần theo người: Free 2 bài mới/ngày → ≤ 0,01 USD/ngày.

### 2.2 Đề xuất cho 7 câu mở (người dùng chốt)

| Câu hỏi                    | Đề xuất mặc định                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Danh sách mục tiêu         | 8 mục tiêu, **chỉ tiếng Anh** ở MVP (ngôn ngữ khác cần eval riêng), mỗi mục tiêu **6 bài có tiêu đề cố định** trong catalog `@cuelingo/shared` (khung; AI chỉ sinh nội dung). Xem bảng dưới                                                                                                                                                        |
| Sinh khi nào               | **Khi mở bài lần đầu**, trong request (UI "Đang soạn bài…", dưới 30 s). Danh sách bài hiện ngay vì tiêu đề nằm trong catalog (AC2). Không job nền                                                                                                                                                                                                  |
| Dùng chung hay riêng       | **Chung** theo (mục tiêu × bài × trình độ × ngôn ngữ); **riêng**: 2–3 câu ví dụ dùng thuật ngữ trong Kho cụm từ/Thuật ngữ (AC5), tiến độ, điểm. Người dùng ghim bản đã mở (AC10)                                                                                                                                                                   |
| Luyện gõ hay nói           | **Chỉ gõ** ở MVP. STT đám mây hiện gắn với phiên họp (`/v1/sessions/:id/transcribe`), web không có STT trên máy; nói để task sau                                                                                                                                                                                                                   |
| Kiểm soát chất lượng       | (1) Zod `.strict()` + `checkLessonOutput` (đủ 4 phần, cụm chính có trong hội thoại, đáp án hợp lệ, không placeholder, trường Việt có dấu, trường Anh không dấu Việt) → thử lại → không lưu nếu hỏng (AC4). (2) `eval-lesson.ts` chặn trước khi bật (AC13). (3) Nút "Báo bài sai": ≥ 3 người khác nhau báo → bản bị loại, người mở sau nhận bản mới |
| Ngưỡng hoàn thành, làm lại | 6 câu kiểm tra; **xong khi đúng ≥ 4/6 (≈ 67%)**. **Làm lại không giới hạn**, không tốn AI (cùng câu hỏi, xáo thứ tự ở client); giữ điểm cao nhất; mỗi lần làm đều ghi FSRS                                                                                                                                                                         |
| Nói về quyền riêng tư      | Dưới ô gõ: "Câu bạn gõ được gửi tới Google Gemini để góp ý và không được lưu lại. Đừng gõ thông tin mật của dự án." Khi chọn mục tiêu: "Bài học do AI soạn, có thể sai; bấm Báo bài sai nếu thấy lỗi." Không thêm nhà cung cấp                                                                                                                     |

| `goalKey`       | Mục tiêu (UI)                         | Trình độ phù hợp | 6 bài (tóm tắt)                                                                                            |
| --------------- | ------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `standup`       | Họp stand-up hằng ngày                | A2–B2            | báo đã làm · kế hoạch hôm nay · báo vướng · nhờ giúp · báo trễ · hỏi lại                                   |
| `client-status` | Họp tiến độ với khách hàng            | B1–C1            | mở họp · báo tiến độ · báo rủi ro/trễ · xin thêm thời gian · chốt việc · kết họp                           |
| `demo`          | Demo/trình bày tính năng              | B1–C1            | mở đầu · dẫn luồng · xử lý lỗi khi demo · nhận câu hỏi · nhận góp ý · chốt bước sau                        |
| `requirements`  | Làm rõ yêu cầu, hỏi lại khi chưa hiểu | A2–B2            | xin nhắc lại · xác nhận hiểu đúng · hỏi tiêu chí · hỏi ưu tiên · nêu giả định · tóm tắt                    |
| `negotiation`   | Đàm phán phạm vi, thời hạn, chi phí   | B2–C1            | nêu ràng buộc · từ chối khéo · đề xuất phương án · đổi phạm vi · nhượng bộ có điều kiện · chốt             |
| `interview`     | Phỏng vấn xin việc kỹ thuật           | B1–C1            | giới thiệu bản thân · kể dự án · giải thích kỹ thuật · câu hỏi hành vi · hỏi lại nhà tuyển dụng · kết thúc |
| `small-talk`    | Small talk đầu/cuối cuộc họp          | A2–B2            | chào hỏi · thời tiết/cuối tuần · hỏi thăm · khen ngợi · chuyển sang việc · chào kết                        |
| `onsite`        | Làm việc onsite tại văn phòng khách   | A2–B2            | làm quen nhóm · hỏi chỗ/quy trình · ăn trưa cùng · nhờ hỗ trợ · họp trực tiếp · tạm biệt                   |

Bỏ "viết email họp" khỏi danh sách: khung bài có hội thoại audio, email đã có ở `followup`.

### 2.3 Định nghĩa trong code (đề xuất)

| Khái niệm            | Định nghĩa                                                                                                                                                                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mục tiêu             | Dòng `learning_goals`: `goalKey` trong catalog, `language`, `level` (mặc định `listening_level`, không có thì `b1`; người dùng đổi được), `deadline?`. Tối đa 3/người (`GOAL_MAX = 3`)                                                                                                                                 |
| Khoá mục tiêu        | 6 bài theo thứ tự catalog. Tiến độ = `round(100 × bài xong / 6)`. Bài kế tiếp: bài đầu chưa xong của mục tiêu có hạn chót gần nhất (không hạn chót xếp sau, rồi theo ngày tạo)                                                                                                                                         |
| Nội dung bài (chung) | `LessonContent`: `situation {descriptionVi ≤ 600, keyPhrases 5–8 {en, meaningVi, register}}` · `dialogue {roles {a, b}, turns 6–10 {speaker, en ≤ 300, vi}}` · `practice {prompts 3 {taskVi, targetPhrase, hintEn?}}` · `quiz {questions 6 {kind: choice\|cloze, prompt, options 3–4, answer, explanationVi, phrase}}` |
| Phần riêng           | `examples ≤ 3 {en, vi, term}`; thiếu/lỗi thì bài vẫn đủ 4 phần, chỉ không có ví dụ riêng                                                                                                                                                                                                                               |
| Góp ý câu luyện      | `{verdict: ok\|minor\|wrong, grammarVi?, better, register, registerNoteVi?}`; không lưu câu và góp ý ở server                                                                                                                                                                                                          |
| Kiểm tra             | `GET` bài không trả `answer`; `POST quiz` chấm ở server, trả đúng/sai + giải thích. Câu đúng → `rating 3`, sai → `1`, `exercise` `recognize` (choice) hoặc `cloze`                                                                                                                                                     |
| Hạn mức              | `lessons_daily` (mở bài mới lần đầu, kể cả khi bản chung có sẵn): Free 2 · Pro 10 · Ultra 20. `lesson_practice_daily`: Free 20 · Pro 150 · Ultra 300. Mở lại bài đã mở và làm lại kiểm tra: miễn phí                                                                                                                   |

### 2.4 Điểm mở rộng và ADR

| Phần                                          | Điểm mở rộng          |
| --------------------------------------------- | --------------------- |
| `goals.ts` catalog, `goal.dto.ts`, `plans.ts` | Contract              |
| `learner-model/src/goal-lesson.ts`            | Learner rule          |
| 3 prompt + 3 task + `eval-lesson.ts`          | AI task               |
| 1 file migration                              | Migration             |
| `modules/goals/`                              | API module            |
| `core-sdk/goals.ts`                           | Client                |
| goal picker, lesson view, panel               | Shared UI (luật 11)   |
| web `features/goals/`, desktop `study/`       | Web feature / Desktop |

**ADR 0025 — "Bài học theo mục tiêu: nội dung AI dùng chung, câu luyện gửi tới Gemini"** (người dùng duyệt plan thì mới viết):

| Mục            | Nội dung                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bối cảnh       | Cần bài học chi tiết theo mục tiêu; sinh riêng từng người đắt (TTS) và không kiểm được chất lượng                                                                                                                                                                                                                                                                                                                                                                                   |
| Quyết định     | (1) Bảng `lesson_contents` **không có `user_id`**, lưu nội dung AI dùng chung theo (mục tiêu, bài, trình độ, ngôn ngữ), có `prompt_version`, `model`, `revision`; đầu vào prompt sinh bản chung **chỉ** gồm khoá catalog, trình độ, ngôn ngữ (kiểm bằng type). (2) Người học ghim bản đã mở. (3) Câu người dùng gõ và thuật ngữ của họ gửi tới Google Gemini qua `ai-gateway` (cùng nhà cung cấp với `assist.compose`), không lưu, không log. (4) Bài bị ≥ 3 người báo lỗi thì loại |
| Phương án khác | A (riêng từng người), C (job nền sinh trước) — §2                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Hệ quả         | Xoá dữ liệu cá nhân xoá mục tiêu, tiến độ, ví dụ riêng, báo lỗi; **không** xoá `lesson_contents` (không phải dữ liệu cá nhân). Đổi prompt → phiên bản mới, bản cũ vẫn phục vụ người đã ghim. Trang chính sách quyền riêng tư phải nêu việc gửi câu luyện tới Gemini. Hai metric hạn mức mới (ADR 0022 áp dụng)                                                                                                                                                                      |

| Tác động                            | Có? | Chi tiết                                                                                                                                                                                                                              |
| ----------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB migration                        | Có  | **Một file mới** `20261122090000_goal_lessons.sql` (§3.1): 4 bảng + đổi `CHECK` của `usage_counters.metric`. Không sửa file cũ                                                                                                        |
| Contract (`@cuelingo/shared`)       | Có  | Mới: `goals.ts` (catalog), `dto/goal.dto.ts`. Sửa `plans.ts`: 2 metric → `UsageResponse.usage` có thêm khoá (không breaking cho client đọc theo khoá; `ui/src/lib/usage.ts` phải có nhãn). Không đổi `course.dto.ts`, `review.dto.ts` |
| Event / Learner Model               | Có  | Không event mới: kiểm tra ghi `review_logs` + FSRS qua `study.answer` (AC7). Hàm thuần mới `goal-lesson.ts` (chấm, ngưỡng, tiến độ, bài kế tiếp, trình độ mặc định). `ai_call` cho 3 task mới                                         |
| Prompt / model AI                   | Có  | `lesson.generate@v1` (timeout 40 s), `lesson.personalize@v1` (8 s), `lesson.feedback@v1` (4 s, fallback `gemini-3.1-flash-lite`); model mặc định `gemini-3.5-flash-lite`, biến env `AI_LESSON_MODEL`. Eval trước khi bật              |
| Quyền riêng tư / dữ liệu người dùng | Có  | Câu gõ: gửi Gemini, không lưu, không log. Thuật ngữ người dùng: gửi Gemini (như dịch), ví dụ riêng lưu trong `goal_lessons.personal`. `deleteMyData` xoá 3 bảng có `user_id`. Bản chung không chứa dữ liệu người dùng. ADR 0025       |

## 3. Các bước (mỗi bước ≈ 1 commit)

| #   | Bước                                | File                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Điểm mở rộng   |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1   | Contract                            | `packages/shared/src/goals.ts` (`GOAL_CATALOG`, `GoalKeySchema`, `LessonKey`, `GOAL_MAX`), `dto/goal.dto.ts` (`CreateGoalRequest`, `UpdateGoalRequest`, `Goal`, `GoalList`+`nextUp`, `LessonContentSchema`, `LessonView` không có đáp án, `PracticeRequest/Feedback`, `QuizSubmit/Result`, `LessonReportRequest`), `plans.ts` (2 metric, `isDailyMetric`) + test; export `index.ts`; nhãn ở `packages/ui/src/lib/usage.ts` (typecheck buộc)              | Contract       |
| 2   | Luật thuần                          | `packages/learner-model/src/goal-lesson.ts` (+ test): `QUIZ_SIZE = 6`, `PASS_CORRECT = 4`, `REPORTS_TO_RETIRE = 3`, `scoreQuiz`, `quizRating`, `goalProgress`, `pickGoalNextUp`, `defaultGoalLevel`                                                                                                                                                                                                                                                      | Learner rule   |
| 3   | Prompt                              | `packages/prompts/src/lesson/v1.ts`, `lesson-personalize/v1.ts`, `lesson-feedback/v1.ts` + `fixtures/cases.ts` (3–5 ca mỗi task) + `v1.test.ts`; `checkLessonOutput`, `checkFeedbackOutput`; export `index.ts`                                                                                                                                                                                                                                           | AI task        |
| 4   | Gateway                             | `packages/ai-gateway/src/tasks.ts` (3 task), `gateway.ts` (`JsonTaskInputMap`, `buildJsonTaskPrompt`) + `gateway.test.ts`; `.env.example`, `services/api/src/config.ts` nếu thêm `AI_LESSON_MODEL`                                                                                                                                                                                                                                                       | AI task        |
| 5   | Eval                                | `packages/ai-gateway/scripts/eval-lesson.ts`: 8 mục tiêu × 2 trình độ (`a2`, `b2`) × 2 lần; tự chấm cấu trúc (`checkLessonOutput`), in mẫu cho người chấm (đúng mục tiêu, tiếng Anh, tiếng Việt); p50/p95 cho feedback. Ngưỡng: cấu trúc 100%, người chấm ≥ 90% đạt, feedback p95 ≤ 5 s. Kết quả vào `03-review.md`                                                                                                                                      | AI task        |
| 6   | Migration                           | `infra/db/migrations/20261122090000_goal_lessons.sql` (§3.1)                                                                                                                                                                                                                                                                                                                                                                                             | Migration      |
| 7   | API `goals` (mục tiêu, mở bài)      | `services/api/src/modules/goals/` copy `glossary/`: `goals.repository.ts` (+ `.memory.ts`), `goals.service.ts`, `goals.routes.ts`, `goals.test.ts`, `index.ts`. `GET/POST /v1/goals`, `PATCH/DELETE /v1/goals/:id`, `GET /v1/goals/:id/lessons/:lessonKey` (bản chung có sẵn → dùng; chưa có → sinh, chống sinh trùng bằng `inFlight` + unique index; ghim; personalize; `status` trước, `add` sau khi thành công)                                       | API module     |
| 8   | API (luyện, kiểm tra, báo lỗi, xoá) | Cùng module: `POST …/practice` (giới hạn/phút như `followup`, không lưu), `POST …/quiz` (chấm, `phrases.save` + `study.answer` tiêm từ `app.ts`, cập nhật `best_pct`/`done_at`), `POST …/report`; `services/api/src/app.ts`, `server.ts`, `testing.ts`; `modules/privacy/privacy.repository.ts` (+ test); `test/integration/goals.int.test.ts`                                                                                                           | API module     |
| 9   | Client                              | `packages/core-sdk/src/goals.ts` (+ test), gắn `createClient`                                                                                                                                                                                                                                                                                                                                                                                            | Client         |
| 10  | UI dùng chung                       | `packages/ui/src/components/goal-picker.tsx`, `goal-lesson-view.tsx` (4 phần; audio qua callback `onPlay(text, voice)`; trạng thái đang soạn/lỗi/hết hạn mức), `learning-path-panel.tsx` (prop `goals?`, nextUp gộp), `lib/roadmap.ts` + test, `shared-ui.test.ts`                                                                                                                                                                                       | Shared UI      |
| 11  | Web                                 | `apps/web/src/features/goals/` (copy `glossary/`: hook, trang bài, test, index); `features/learning-path/LearningPathTab.tsx` truyền dữ liệu mục tiêu                                                                                                                                                                                                                                                                                                    | Web feature    |
| 12  | Desktop                             | `apps/desktop/src/study/` (`goals-api.ts`, `use-goals.ts`, `GoalLessonPage.tsx` + test), `LearningPathPage.tsx`                                                                                                                                                                                                                                                                                                                                          | Desktop module |
| 13  | Docs + ADR                          | Mới `04-modules/03-api/goals.md`, `08-adr/0025-goal-lessons-shared-content.md` + `08-adr/README.md`; sửa `03-api/tts.md`, `03-api/usage.md`, `03-api/privacy.md`, `05-packages/{prompts,ai-gateway,learner-model,shared,core-sdk,ui}.md`, `02-web/review.md`, `06-ml/eval.md`, `05-engineering/workflows/ai-task.md` (§1.3), `03-architecture/{06-ai-architecture,07-data-model,08-security-privacy}.md`, `02-product/01-features.md`. `pnpm docs:build` | ADR            |

Bước 7–8 có thể giao Codex qua `04-brief.md`; 10–12 phụ thuộc 9. Mỗi bước `pnpm verify` xanh.

### 3.1 Dự thảo migration `20261122090000_goal_lessons.sql`

```sql
-- migrate:up
CREATE TABLE learning_goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  goal_key    text NOT NULL,                       -- catalog key in @cuelingo/shared
  language    text NOT NULL,
  level       text NOT NULL CHECK (level IN ('a2', 'b1', 'b2', 'c1')),
  deadline    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, goal_key, language)
);

-- Shared AI content: no user_id, no user data (ADR 0025).
CREATE TABLE lesson_contents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_key        text NOT NULL,
  lesson_key      text NOT NULL,
  level           text NOT NULL CHECK (level IN ('a2', 'b1', 'b2', 'c1')),
  language        text NOT NULL,
  revision        smallint NOT NULL DEFAULT 1,
  prompt_version  text NOT NULL,
  model           text NOT NULL,
  content         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'retired')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX lesson_contents_live_idx
  ON lesson_contents (goal_key, lesson_key, level, language) WHERE status = 'live';

-- One row per lesson a person opened: pins the content version and holds the personal part.
CREATE TABLE goal_lessons (
  goal_id                  uuid NOT NULL REFERENCES learning_goals(id) ON DELETE CASCADE,
  user_id                  uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  lesson_key               text NOT NULL,
  content_id               uuid NOT NULL REFERENCES lesson_contents(id),
  personal                 jsonb,                  -- examples built from the person's terms
  personal_prompt_version  text,
  best_correct             smallint CHECK (best_correct BETWEEN 0 AND 6),
  attempts                 integer NOT NULL DEFAULT 0,
  done_at                  timestamptz,
  opened_at                timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, lesson_key)
);
CREATE INDEX goal_lessons_user_idx ON goal_lessons (user_id);

CREATE TABLE lesson_reports (
  content_id  uuid NOT NULL REFERENCES lesson_contents(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  reason      text NOT NULL CHECK (reason IN ('english', 'vietnamese', 'off_goal', 'level', 'other')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, user_id)
);

ALTER TABLE usage_counters DROP CONSTRAINT usage_counters_metric_check;
ALTER TABLE usage_counters ADD CONSTRAINT usage_counters_metric_check CHECK (metric IN (
  'translation_ms', 'cloud_stt_ms', 'debriefs', 'assist_daily', 'agent_messages',
  'lessons_daily', 'lesson_practice_daily'));

-- migrate:down
-- (restore the old CHECK, then drop the four tables in reverse order)
```

Tên constraint `usage_counters_metric_check` là tên Postgres tự đặt; kiểm lại bằng `\d usage_counters` trước khi chạy.

### 3.2 Test theo AC

| AC   | Test                                                                                                                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1  | `goal.dto.test.ts` › `goalKey` ngoài catalog bị từ chối, hạn chót tuỳ chọn; `goals.test.ts` › tạo, sửa trình độ/hạn chót, xoá; mục tiêu thứ 4 → `409`; trùng → `409`                                                                                         |
| AC2  | `goals.test.ts` › `POST /v1/goals` không gọi AI, `GET /v1/goals` trả ngay 6 bài đúng thứ tự catalog; nội dung chỉ sinh ở `GET …/lessons/:key`                                                                                                                |
| AC3  | `goal.dto.test.ts` › `LessonContentSchema` thiếu một phần → lỗi; `goal-lesson-view.test.tsx` › render đủ 4 phần                                                                                                                                              |
| AC4  | `lesson/v1.test.ts` › `checkLessonOutput` bắt từng lỗi; `gateway.test.ts` › đầu ra sai → thử lại → `AiGatewayError`; `goals.test.ts` › AI trả bài hỏng → `502`, không có dòng `lesson_contents`                                                              |
| AC5  | `goals.test.ts` › đầu vào `lesson.personalize` có thuật ngữ của người dùng, đầu vào `lesson.generate` không có trường nào của người dùng; bài trả `promptVersion`; trình độ mặc định từ `listening_level`                                                    |
| AC6  | `goals.test.ts` › practice gọi `lesson.feedback`, không lưu; `eval-lesson.ts` › p95 ≤ 5 s (số trong `03-review.md`)                                                                                                                                          |
| AC7  | `goal-lesson.test.ts` › `scoreQuiz`, ngưỡng 3/6 và 4/6; `goals.test.ts` › nộp kiểm tra → cụm được lưu, mỗi câu một `review_logs`, FSRS đổi; đạt → `done_at`; làm lại giữ điểm cao nhất                                                                       |
| AC8  | `learning-path-panel.test.tsx` › khoá họp và khoá mục tiêu cùng hiện, nextUp gộp; `LearningPathTab.test.tsx` (web), `use-goals.test.ts` (desktop)                                                                                                            |
| AC9  | `goals.test.ts` › AI lỗi → bài đã mở vẫn mở, ôn tập vẫn chạy, counter không tăng; hết `lessons_daily` → `429`, bài đã mở vẫn `200`; UI hiện thông báo tiếng Việt                                                                                             |
| AC10 | `goals.test.ts` › mở bài mới tăng `lessons_daily` 1; mở lại không gọi AI, không trừ; người thứ hai cùng ô không gọi `lesson.generate`; bản bị loại → người đã ghim vẫn thấy bản cũ                                                                           |
| AC11 | `goals.test.ts` › B đọc/sửa/xoá/mở bài/nộp kiểm tra/báo lỗi trên mục tiêu của A → `404`; mọi query repository có `user_id`                                                                                                                                   |
| AC12 | `privacy.repository.test.ts` + `goals.int.test.ts` › sau `deleteMyData` không còn dòng `learning_goals`/`goal_lessons`/`lesson_reports`, `lesson_contents` còn; `goals.test.ts` › bắt `logger.stream` (mẫu `followup.test.ts`): không có câu, câu hỏi, góp ý |
| AC13 | `eval-lesson.ts` + ngưỡng ở bước 5; `prompts/*/v1.test.ts` › hằng phiên bản; quy tắc không sửa `v1` đã dùng giữ bằng review (ai-task)                                                                                                                        |

## 4. Rủi ro

| Rủi ro                                                                       | Giảm thiểu                                                                                                                               |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Chi phí vượt ước lượng (giá TTS chưa xác minh, thử lại 4 lần trong `json()`) | Hạn mức ngày theo người; bản chung chỉ sinh một lần; đọc `ai_call` sau tuần đầu, đối chiếu §2.1; thêm giá TTS vào `pricing.ts` khi có số |
| Nội dung AI sai (tiếng Anh sai, tiếng Việt cứng, lạc mục tiêu)               | Checker + eval trước khi bật; người chấm mẫu; nút Báo bài sai, 3 báo → loại; bản chung nên sửa một lần cho mọi người                     |
| Lệch trình độ giữa bản chung và người học                                    | Trình độ nằm trong khoá bản chung; người dùng đổi trình độ của mục tiêu; lý do báo `level`; eval phủ `a2` và `b2`                        |
| Câu người dùng gõ chứa thông tin mật                                         | Không lưu, không log (test AC12); dòng cảnh báo dưới ô gõ; chỉ gửi Gemini gói không huấn luyện (như agent); ADR 0025                     |
| Thuật ngữ người dùng lọt vào bản chung                                       | Kiểu đầu vào `lesson.generate` chỉ có khoá catalog/trình độ/ngôn ngữ; test AC5                                                           |
| Prompt injection qua câu gõ hoặc thuật ngữ                                   | Khối dữ liệu không tin cậy + `clean()` như `followup`; đầu ra qua schema `.strict()`                                                     |
| Người đầu tiên ở một ô chờ lâu (sinh 3k token, có thể thử lại)               | UI trạng thái "Đang soạn bài"; sinh trùng gộp một; request bỏ dở vẫn lưu kết quả; nếu đo thấy tệ → thêm job làm nóng (vẫn phương án B)   |
| Góp ý không đạt p95 ≤ 5 s khi chạy fallback                                  | Timeout 4 s; đo p95 ở eval; không đạt → bỏ fallback cho task này (như `assist.followup`)                                                 |
| Đổi `CHECK` của `usage_counters` sai tên constraint                          | Kiểm tên thật trước; int test chạy migration lên/xuống                                                                                   |
| Kiểm tra tự thêm cụm vào Kho cụm từ, người dùng bất ngờ                      | Nút nộp ghi rõ "thêm N cụm vào Kho cụm từ để ôn"; `save` idempotent                                                                      |

### 4.1 Giả định

| #   | Giả định                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------- |
| G1  | Tiêu đề 6 bài mỗi mục tiêu viết sẵn trong catalog là "khung cố định", không phải "soạn bài thủ công" (ngoài phạm vi) |
| G2  | "Trình độ nghe/nói" = `listening_level` (chưa có trình độ nói); người dùng chỉnh tay theo mục tiêu                   |
| G3  | Chỉ tiếng Anh ở MVP; ngôn ngữ học khác cần ca eval riêng                                                             |
| G4  | Không lưu câu luyện và góp ý ở server; mở lại bài thì phần luyện trống                                               |
| G5  | Xuất dữ liệu (`GET /v1/me/export`) chưa gồm mục tiêu và tiến độ (không có AC); để task sau                           |
| G6  | Mục tiêu bị xoá thì tiến độ mất; `review_logs` và cụm đã lưu vẫn ở Kho cụm từ                                        |
