# Plan — meeting-assistant

**Trạng thái:** đã duyệt, đang làm · 2026-11-27 · [spec](./01-specs.md) đã duyệt · quyết định khó đảo ngược: [ADR 0027](../../08-adr/0027-meeting-assist.md)

## 1. Bối cảnh code

Điểm mở rộng ([bảng](../../05-engineering/01-extension-points.md)): Contract → Migration → AI task → API module → Client → UI chung → Desktop. Module mẫu: `services/api/src/modules/glossary/`; SSE copy `modules/agent/agent.routes.ts`.

| Vùng                        | Điều quyết định cách làm                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `@cuelingo/agent`           | Dùng công cụ thì cần ít nhất 2 bước mô hình                                                                                            |
| `ai-gateway`                | `chat()` gắn cứng task và prompt `agent.chat`; `firstTokenMs` có trong record nhưng `lib/ai-calls.ts` không lưu                        |
| `modules/agent`             | Hội thoại không có `session_id`; quota tính theo `agent_messages` (Free = 0); có cờ và công tắc riêng                                  |
| `modules/courses` (`/prep`) | Không tìm kiếm gì, chỉ nhận `sessionIds`. Server **chưa có tìm kiếm nào**                                                              |
| `shared`                    | `ExportSchema`, `UserSettingsSchema` là `.strict()` và desktop 0.1.12 parse đúng schema đó: thêm khoá là hỏng bản cũ                   |
| `UsageResponse`             | Object `usage` không strict (client cũ bỏ qua metric mới) nhưng mọi metric đều bắt buộc (client mới + server cũ thì lỗi parse)         |
| Desktop overlay             | Cửa sổ riêng, tự đăng nhập; **không biết session id** (`TranscriptEvent` không có); store giữ 15 đoạn; cả cửa sổ đã `contentProtected` |
| `src-tauri/hotkeys.rs`      | Đăng ký phím bằng `?` trong `setup`: một tổ hợp bị app khác giữ có thể làm app không khởi động                                         |
| `ml/eval`                   | Chỉ có README; eval thật là `packages/ai-gateway/scripts/eval-*.ts` + fixture prompt                                                   |

## 2. Phương án

| #   | Phương án                                                                                                | Ưu                                                                                             | Nhược                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A   | Harness agent + plugin `meeting` (công cụ đọc transcript, cuộc họp cũ, glossary, cụm từ)                 | Mô hình tự chọn nguồn; có sẵn dừng, lưu hội thoại                                              | ≥ 2 bước mô hình (ước tính p95 4–6 s); token vào gần gấp đôi; chỉ dẫn trong transcript lái được việc đọc dữ liệu cũ; sửa nhiều phần |
| B   | **Một lần gọi stream**, server gom ngữ cảnh theo luật tất định, không có công cụ; server kiểm nhãn nguồn | Một lần chờ chữ đầu (ước tính p50 ~1,5 s, p95 ~3 s); ~0,002 USD/câu; code quyết dữ liệu nào đi | Tìm cuộc họp cũ chỉ theo từ khoá, hỏi bằng từ đồng nghĩa có thể sót                                                                 |
| C   | Client tự gom 15 câu đang có và kết quả tìm trên máy                                                     | Không cần migration                                                                            | Trái AC8, AC10; không stream, không lưu. Loại                                                                                       |

**Chọn B.** Đạt AC3 với dư địa, rẻ hơn A, an toàn hơn trước AC13, nhãn nguồn kiểm được bằng test tất định. Độ trễ và giá ở trên là ước tính, chưa đo.

| Tác động                            | Có?   | Chi tiết                                                                                                                |
| ----------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| DB migration                        | Có    | 1 file: `meeting_questions`, `meeting_assist_consents`, thêm `meeting_ask_daily` vào `usage_counters_metric_check`      |
| Contract (`@cuelingo/shared`)       | Có    | `dto/meeting-assist.dto.ts`, 3 mã lỗi `MEETING_ASSIST_*`, metric mới, `questions` tuỳ chọn trong export. Không breaking |
| Event / Learner Model               | Không | Chỉ thêm `firstTokenMs` vào `ai_call`                                                                                   |
| Prompt / model AI                   | Có    | Task `meeting.ask`, prompt `meeting.ask@v1`, Gemini Flash-Lite (`AI_MEETING_ASK_MODEL`), dự phòng như chat              |
| Quyền riêng tư / dữ liệu người dùng | Có    | Mục đích mới gửi tới Gemini; lưu hỏi đáp; đồng ý lưu và kiểm ở server                                                   |

### Thiết kế

| Việc                 | Cách làm                                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module               | `services/api/src/modules/meeting-assist/`: bố cục như `glossary/` + `retrieval.ts`, `citations.ts` (logic thuần)                                                                                                                             |
| API                  | `GET /v1/me/meeting-assist` → `{enabled, consent}` · `PUT /v1/me/meeting-assist/consent` · `POST /v1/sessions/:id/questions` (SSE: `status` → `text_delta`… → `sources` → `done`)                                                             |
| Thứ tự cổng kiểm     | cờ (503) → body (400) → đồng ý (403) → phiên của mình, chưa xoá (404) → một câu đang chạy mỗi người (409) → `tryReserve` (429) → gọi AI                                                                                                       |
| Ngữ cảnh (~6k token) | Đuôi transcript ~2,5k + đoạn cũ trong phiên khớp từ khoá ~1k + câu được chọn + thuật ngữ, cụm từ khớp ≤ 20 + cuộc họp cũ ~1k + 3 cặp hỏi đáp trước. Chỉ câu gốc, không gửi bản dịch; không gọi AI để tóm tắt                                  |
| Tìm cuộc họp cũ      | `LIKE` trên `text_en`, `text_vi`, tiêu đề, debrief; 100 phiên mới nhất trong 180 ngày; hạn 300 ms, quá thì bỏ nguồn; tối đa 3 phiên. Tiếng Việt lấy cặp âm tiết, CJK lấy cặp ký tự. Không full-text (không tách từ ja/zh/ko), không embedding |
| Nhãn nguồn           | Mô hình gắn `[n]`/`[G]`; server chỉ giữ nhãn của nguồn đã lấy ra **và** được trích; không có nhãn thì "Kiến thức chung (chưa kiểm chứng)"                                                                                                     |
| Hạn mức              | `meeting_ask_daily` (ngày giờ VN): **Free 10 · Pro 60 · Ultra 150**, đổi được bằng `PLAN_LIMITS`. Trần theo người/ngày khi dùng hết: ~0,02 · ~0,12 · ~0,3 USD                                                                                 |
| Công tắc             | Env `MEETING_ASSIST_ENABLED`, mặc định **tắt**, độc lập `AGENT_ENABLED`; đổi cần khởi động lại                                                                                                                                                |
| Xoá, xuất            | Xoá theo cascade của `sessions`; "Xoá dữ liệu" xoá cả hỏi đáp và đồng ý. Export chỉ thêm khi gọi `?include=meeting_questions`                                                                                                                 |
| Tương thích          | Server mới + desktop cũ: chỉ thêm. Desktop mới + server cũ: không có route thì ẩn mục. **Phát hành server trước desktop**                                                                                                                     |

### Lệch so với spec đã duyệt (cần đồng ý ở cổng này)

| Spec                                                  | Đề xuất trong plan                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Câu 5: hỏi đáp "xem lại được cùng debrief"            | Lát này **chỉ lưu, xuất, xoá**; màn xem lại để lát sau. Debrief đầy đủ chỉ có trên web, mà web đang ngoài phạm vi (câu 9) |
| AC7, AC12, AC13: eval trong `ml/eval`                 | Đặt ở `packages/ai-gateway/scripts/eval-meeting-ask.ts` + fixture prompt, theo chỗ eval đang có                           |
| §1: "cần có trần riêng" sau sự cố trần chi tiêu dự án | Chỉ có trần **theo người** và cờ tắt; chưa có trần chi tiêu toàn hệ thống                                                 |

## 3. Các bước (mỗi bước ≈ 1 commit)

Worktree riêng, nhánh `feat/meeting-assist` từ `main`. Bắt đầu **sau khi** ai-provider-failures đã merge (đụng `gateway.ts`, `ai-calls.ts`, `error-code.ts`, `UsageService`). Hai PR: **PR-1 server** (bước 1–6, deploy với cờ tắt) và **PR-2 client** (7–11).

| #   | Bước                                                                                                                                 | File chính                                                                                                  | Điểm mở rộng   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------- |
| 1   | Contract: DTO, mã lỗi, metric và hạn mức; nhãn usage; doc `shared`, `usage`, bảng gói                                                | `packages/shared/src/{dto/meeting-assist.dto.ts,errors,plans.ts,dto/privacy.dto.ts}`, `ui/src/lib/usage.ts` | Contract       |
| 2   | Migration; doc data model                                                                                                            | `infra/db/migrations/<ts>_meeting_assist.sql`                                                               | Migration      |
| 3   | Prompt `meeting.ask@v1` + fixture (injection, không tìm thấy, độ ngắn, nhãn nguồn)                                                   | `packages/prompts/src/meeting-ask/`                                                                         | AI task        |
| 4   | Gateway `askStream` (tách phần stream dùng chung với `chat()`), ghi `firstTokenMs`, eval                                             | `packages/ai-gateway/src/{tasks,gateway,chat}.ts`, `scripts/eval-meeting-ask.ts`, `api/src/lib/ai-calls.ts` | AI task        |
| 5   | API module + cấu hình; doc trang module mới                                                                                          | `services/api/src/modules/meeting-assist/`, `app.ts`, `config.ts`, `server.ts`                              | API module     |
| 6   | Privacy: xoá, export có `include`; doc privacy và security                                                                           | `services/api/src/modules/privacy/`                                                                         | API module     |
| 7   | Client; tách đọc SSE dùng chung; web gửi `include` khi export                                                                        | `packages/core-sdk/src/{meeting-assist,sse,agent}.ts`, `apps/web/src/lib/client.ts`                         | Client         |
| 8   | Component câu trả lời (chữ stream, nhãn nguồn, dừng, lỗi, "Giải thích thêm")                                                         | `packages/ui/src/components/meeting-answer.tsx`                                                             | UI chung       |
| 9   | Desktop: `sessionId` trong transcript, ngăn kéo "Hỏi trợ lý", nút "Giải thích", đồng ý, công tắc Cài đặt, "Soạn câu từ ý này" nếu rẻ | `apps/desktop/src/{lib,session,overlay,quick-assist,settings,privacy}/`                                     | Desktop        |
| 10  | Phím tắt cho "hỏi", đăng ký lỗi thì bỏ qua (đề xuất ⌘⇧K, chốt sau khi thử Zoom/Meet/Teams)                                           | `apps/desktop/src-tauri/src/hotkeys.rs`                                                                     | Desktop (Rust) |
| 11  | ADR sang Accepted, phạm vi MVP, lộ trình, `03-review.md`                                                                             | `apps/docs/docs/`                                                                                           | ADR            |

"Soạn câu từ ý này" (spec §3 câu 3, hỏi "có cần ngay lát 1 không" mà không có đề xuất): plan coi là **tuỳ chọn** ở bước 9, bỏ nếu phát sinh việc ngoài truyền chữ sang "Nói giúp" (không hỗ trợ họp tiếng Việt).

### Test theo AC

| AC     | Test                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------- |
| 1, 21  | `CaptionOverlay.test.tsx` (mở ngăn kéo, caption vẫn chạy), `hotkeys.rs`; chạy thật chia sẻ màn hình Zoom/Meet |
| 2, 4   | `meeting-assist.test.ts` (thứ tự SSE; huỷ thì lưu `stopped`); test panel; test client abort                   |
| 3      | Đo ≥ 20 câu trong 2 cuộc họp thật (`firstTokenMs` + ms truy hồi), ghi p50/p95 vào `03-review.md`              |
| 5, 6   | API: 3 cặp hỏi đáp trước vào input; `focus` của người khác bị bỏ; `CaptionBlock.test.tsx`                     |
| 7, 12  | Fixture + `eval-meeting-ask.ts`                                                                               |
| 8, 9   | `retrieval.test.ts` (phiên 500 câu, cả hai luồng, đúng ngân sách); thuật ngữ khớp mới được gửi                |
| 10     | `meeting-assist.int.test.ts` (Postgres thật: Anh, Việt, Nhật; escape `%` `_`; quá giờ)                        |
| 11     | `citations.test.ts`                                                                                           |
| 13     | Fixture injection (kể cả thẻ đóng khối dữ liệu); không khai báo công cụ                                       |
| 14     | API: lỗi trước và trong stream; panel giữ chữ đã gõ                                                           |
| 15     | API: chưa đồng ý → 403, gateway không được gọi, không trừ lượt; desktop: hỏi một lần, tắt được                |
| 16, 17 | Test hai người dùng; xoá phiên, xoá dữ liệu; export không tham số giữ nguyên                                  |
| 18     | Chuỗi bí mật không xuất hiện trong log và `ai_call`                                                           |
| 19, 20 | `plans.test.ts` + API (429 kèm `resetsAt`); cờ tắt → 503, tra từ và "Nói giúp" vẫn 200                        |

## 4. Rủi ro

| Rủi ro                                                   | Giảm thiểu                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Tìm từ khoá sót cuộc họp cũ                              | Khớp cả bản dịch và debrief; nếu sót nhiều thì embedding bằng ADR riêng |
| `LIKE` chậm khi nhiều dữ liệu                            | Giới hạn phiên, dòng, thời gian; sau thêm `pg_trgm` bằng migration mới  |
| Mô hình bịa hoặc quên nhãn nguồn                         | Server bỏ nhãn lạ; mặc định "chưa kiểm chứng"                           |
| Câu vừa nói chưa kịp lưu ở server                        | Client gửi kèm `focus.text` (vẫn là dữ liệu không tin cậy)              |
| Chưa có caption nên overlay chưa biết phiên              | Ô hỏi khoá với dòng "Chờ caption đầu tiên"                              |
| Một câu đang chạy mỗi người: khoá trong bộ nhớ           | Đúng với một container (ADR 0011); nợ khi scale ngang                   |
| Tiến trình chết giữa chừng để lại dòng `streaming`       | Khi xuất dữ liệu coi là `error`; lịch sử hỏi đáp bỏ qua dòng này        |
| Production còn image 16/11, thiếu route và migration mới | Deploy PR-1 trước khi phát hành desktop; chốt người làm và thời điểm    |

Ước lượng: ~4 ngày làm việc cho cả 11 bước (ước tính thô).
