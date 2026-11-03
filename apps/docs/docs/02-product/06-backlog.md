---
title: Backlog và mốc giao hàng
---

# Backlog và mốc giao hàng

Trang này biến [bản đồ tính năng](./01-features.md), [phạm vi MVP](./03-mvp-scope.md) và [lộ trình](./04-roadmap.md) thành **mốc dùng được** (M1…M5) và **task có chủ** để chia cho Claude và Codex. Nguyên tắc: mỗi mốc kết thúc bằng một thứ người dùng **chạy và thấy được**, không phải một lớp hạ tầng.

## Cách đọc

| Cột       | Ý nghĩa                                                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chủ       | **C** = Claude (lead: native, realtime, AI, tích hợp, review) · **X** = Codex (làm theo brief trong worktree riêng) · **U** = người dùng phải làm/cung cấp |
| Cỡ        | S ≤ nửa ngày · M ≈ 1 ngày · L 2–3 ngày                                                                                                                     |
| Phụ thuộc | Task phải xong trước                                                                                                                                       |
| Brief     | Mỗi task **X** thành một brief `04-brief-*.md` (≤ 1 ngày, ≤ ~10 file) trước khi giao; Claude viết brief và review chéo                                     |

**Quy tắc chia việc.** Giao cho Codex: UI React/web, module CRUD sao chép từ module mẫu `glossary`, schema + client SDK, test, docs module. Giữ cho Claude: Swift/audio, pipeline realtime, prompt + gateway AI, migration nhạy cảm, tích hợp cuối. Mọi thứ Codex làm đều cần Claude cài sẵn dependency (Codex không có mạng) và review chéo.

## Các mốc

```mermaid
flowchart LR
  M0["M0 · Nền móng ✅"] --> M1["M1 · Caption sống"]
  M1 --> M2["M2 · Quick Assist<br/>Alpha nội bộ"]
  M2 --> M3["M3 · Debrief"]
  M3 --> M4["M4 · Học và ôn"]
  M4 --> M5["M5 · Beta"]
```

| Mốc                 | Người dùng làm được gì                                                                        | Ước lượng | Cổng                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------- |
| **M0** Nền móng     | (đã xong) API, auth, worker, web glossary, khung desktop                                      | —         | ✅                                                                                  |
| **M1** Caption sống | Mở app, bấm ⌘⇧L, thấy **caption tiếng Anh + bản dịch tiếng Việt** của cuộc họp đang diễn ra   | 3 tuần    | Chạy thật với Zoom/Meet: p95 câu gốc ≤ 1 s, dịch ≤ 2,5 s trong 30 phút, không crash |
| **M2** Quick Assist | Tra từ, hỏi "họ vừa nói gì?", gõ tiếng Việt → câu tiếng Anh. **Alpha nội bộ**                 | +2 tuần   | Bạn dùng thật trong 3 cuộc họp thật, ghi lại lỗi                                    |
| **M3** Debrief      | Sau họp mở web xem 5 khối debrief, nghe lại đoạn khó, lưu cụm từ                              | +2 tuần   | Debrief ≤ 2 phút sau họp, đủ 5 khối                                                 |
| **M4** Học và ôn    | Ôn cụm từ từ chính cuộc họp bằng FSRS; xem tiến bộ theo tuần                                  | +2 tuần   | Phiên ôn 5–10 phút, FSRS đúng lịch                                                  |
| **M5** Beta         | Onboarding, đăng nhập trong app, quyền riêng tư (xoá dữ liệu), cài đặt lưu bền, bản `.app` ký | +2 tuần   | 30–50 người dùng thử; H1–H3 đo được                                                 |

Ước lượng giả định Claude + Codex làm song song. **Thứ tự được chọn để sớm có sản phẩm dùng được**: M1 dùng STT on-device và dịch bằng LLM, bỏ qua mọi thứ chưa cần (đăng nhập trong app, lưu phiên) — M1 chạy được ngay với một API key LLM trong `.env`.

## Kế hoạch hoàn thiện theo đợt (B2C-first)

Chủ sản phẩm chốt **B2C trước** (2026-11-02). Từ đây việc mới xếp theo **đợt**, mỗi đợt có một lời hứa với người dùng và một cổng đo được; lộ trình và lý do xem [Lộ trình](./04-roadmap.md). M1–M5 và các mục P2/P3 bên dưới là lịch sử và việc dở, giữ nguyên mã để truy vết commit.

**Ký hiệu trạng thái:** ✅ xong và có test · ◐ đã có mã nhưng chưa ai chạy thật trên bản `.app` và có thể còn thiếu phần (đối chiếu với brief trước khi tin) · (trống) chưa làm. **Mã việc mới:** `W<đợt>-<số>`. **Cổng** là đề xuất, chốt lại bằng số liệu beta.

| Tên cũ                                                  | Nay là                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| M1–M5                                                   | Đã xong ở mức chạy được; phần còn lại của M5 chuyển vào P2 và Đợt 0 |
| "Giai đoạn 2" (P2)                                      | Việc dở để tới Beta: nằm trong Đợt 0, trừ P2-06 sang Đợt 3          |
| "Đợt 1–4" của Giai đoạn 2                               | Đổi tên thành Nhóm A–D để không trùng với Đợt dưới đây              |
| "Giai đoạn 3" (P3)                                      | Đa ngôn ngữ; phần còn lại (P3-08) nằm trong Đợt 1                   |
| "Giai đoạn 2/3/4" của lộ trình cũ (Learn, Coach, Scale) | Tách vào Đợt 1–4                                                    |

### Đợt 0 · Beta kín — "Hiểu được cuộc họp hôm nay"

**Cổng:** H1–H3 của [Phạm vi MVP](./03-mvp-scope.md) đạt với 30–50 người; p95 độ trễ và CPU/RAM đo thật; D7 ≥ 30% (giả định ban đầu, chốt sau hai tuần beta đầu).

Dòng mang mã `P2-xx` là việc đã có từ trước; mô tả đầy đủ ở Nhóm A–D bên dưới, ở đây chỉ ghi phần còn thiếu.

| ID      | Task                                                                                                                                                                                                                                                        | Chủ | Phụ thuộc                                | Cỡ           | Ghi chú                                                                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W0-01   | **Xác nhận chạy thật** các việc ◐ (P2-01, P2-14, P2-15, P2-16, P2-20, P2-23) và Quick Assist (M2-07) trên bản `.app`: đối chiếu từng mục với brief, đánh ✅ hoặc mở lỗi                                                                                     | U+C | P2-03                                    | M            | Phần thiếu đã biết: P2-15 lưu bằng `localStorage`, chưa phải store Tauri; P2-20 chưa có Sentry; "Kết quả" của brief P2-15/16/20 còn trống               |
| P2-04 ◐ | Nối thuật ngữ vào nhận dạng: lệnh Rust và phía desktop lấy glossary gửi đi                                                                                                                                                                                  | C   | P2-01                                    | S            | Sidecar (`vocab`, `VocabularyCorrector`) đã xong và có test. Ảnh hưởng độ chính xác thuật ngữ (≥ 95% theo MVP)                                          |
| P2-16 ◐ | Phần còn thiếu của debrief: đính kèm/chia sẻ                                                                                                                                                                                                                | X   | M3                                       | S            | Bấm đoạn khó → đúng câu và tiến trình tạo đã có test                                                                                                    |
| P2-09   | Ký + notarize + tự cập nhật + kênh phát hành                                                                                                                                                                                                                | C+U | P2-03                                    | L            | Cần tài khoản Apple Developer                                                                                                                           |
| P2-23 ◐ | Đăng nhập production: còn khoá Google OAuth thật, domain, cookie domain, khoá nhà cung cấp email                                                                                                                                                            | C+U | —                                        | M            | Google OAuth, magic link qua Resend/SMTP và CORS đã có mã. **Resend đã nối vào code mà chưa có ADR (luật 8): lập ADR hợp thức hoá, cần ADR, hỏi người** |
| P2-22   | Chạy thật Zoom/Meet 30 phút, đo p95, overlay không lộ khi chia sẻ màn hình, phiên 2 giờ                                                                                                                                                                     | U+C | P2-03                                    | M            |                                                                                                                                                         |
| P2-24   | Nhãn người nói "Speaker N" và đổi tên trong debrief                                                                                                                                                                                                         | C   | P2-16                                    | L            |                                                                                                                                                         |
| W0-02   | **Đo kích hoạt và giữ chân:** thời gian từ cài tới caption đầu tiên, họp/tuần, D1/D7, thêm vào dashboard của P2-20; event thiếu thì thêm qua contract-sync                                                                                                  | X   | P2-20                                    | M            | Dữ liệu cho cổng mọi đợt sau                                                                                                                            |
| W0-03   | **Chốt kênh và danh sách 30–50 người dùng thử**, cách mời (mã mời hoặc danh sách cho phép)                                                                                                                                                                  | U   | —                                        | S            | Câu hỏi mở: kênh nào                                                                                                                                    |
| P2-25   | Form phản hồi, dashboard H1–H4, vòng sửa lỗi hai tuần                                                                                                                                                                                                       | U+C | W0-01, W0-02, W0-03, P2-09, P2-22, P2-23 | L (hai tuần) |                                                                                                                                                         |
| W0-04 ◐ | **Họp tiếng Việt:** nhận dạng đám mây (Gemini) qua API và `ai-gateway`, đồng ý trước, sóng âm hai luồng, kiểm tra quyền và lỗi thu âm, thẻ tóm tắt sau họp, debrief tiếng Việt ([ADR 0014](../08-adr/0014-cloud-stt-for-vietnamese.md))                     | C   | —                                        | L            | Code xong, đã qua hai review độc lập; chờ chạy thật (độ trễ p95 ≤ 4 giây, AC9–AC13). Hồ sơ `06-delivery/2026-11-03-vi-cloud-stt`                        |
| W0-05   | **Dọn nợ họp tiếng Việt:** chặn `vi` ở DTO assist/events; tắt tra từ trên caption tiếng Việt; đổi tiếng Việt ↔ Anh giữa chừng không mất caption; gộp client `transcribe` của desktop vào `core-sdk`; nhận dạng ngôn ngữ liên tục thay vì chỉ ở đầu cuộc họp | C   | W0-04                                    | M            | Nợ do review ghi lại; làm sau khi W0-04 chạy thật                                                                                                       |
| W0-06   | **ADR cho Resend:** magic link đã gửi qua Resend trong code mà chưa có ADR (luật 8)                                                                                                                                                                         | U+C | —                                        | S            | [ADR 0015](../08-adr/0015-email-provider-resend.md) đang Proposed, cần bạn duyệt                                                                        |

### Đợt 1 · Quanh cuộc họp — "Vào họp tự tin, ra họp có việc để làm"

Dùng lại phần đã có (lịch, glossary, debrief, compose) để kéo người dùng vào app **mỗi ngày làm việc**, không chỉ khi có họp.

**Cổng:** ≥ 50% cuộc họp có mở briefing hoặc follow-up; D30 ≥ 15% (cả hai là giả định ban đầu, chốt sau Đợt 0).

| ID    | Task                                                                                                                                                                                                                     | Chủ | Phụ thuộc    | Cỡ  | Ghi chú                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ------------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| P3-08 | Hoàn tất gợi ý ngôn ngữ từ lịch (xác nhận phần ◐ trên máy thật)                                                                                                                                                          | C   | W0-01        | S   | Nuôi W1-01                                                                                                                                 |
| W1-01 | **Briefing trước họp:** từ sự kiện lịch sắp tới + thuật ngữ + cụm từ chưa thuộc + debrief họp trước, sinh ≤ 8 từ sẽ gặp, 3 câu nên chuẩn bị, bài tập 5 phút (có nghe, dùng TTS của P2-05); thẻ trên desktop và trang web | C+X | P3-08, P2-05 | L   | Task AI mới (prompt, gateway, eval). **Tiêu đề/mô tả lịch là dữ liệu mới gửi AI: xin đồng ý rõ, mặc định tắt, đối chiếu privacy-security** |
| W1-02 | **Follow-up sau họp:** từ debrief (quyết định, việc cần làm) soạn email/Slack tiếng Anh, 3 giọng (ngắn, lịch sự, thân), dùng cụm từ người dùng đã lưu; nút ở trang debrief                                               | C+X | M3-03        | L   | Task AI mới; có thể mở rộng `compose`                                                                                                      |
| W1-03 | **Chỉ số độc lập hằng tuần:** nâng trang Tiến độ ("% câu phải xem bản dịch" so với tuần trước), tóm tắt tuần; logic thuần ở `learner-model`                                                                              | C+X | M4-04        | M   | Số đo chính của sản phẩm                                                                                                                   |
| W1-04 | **Nhắc ôn qua thông báo macOS** khi có thẻ đến hạn, giờ do người dùng chọn, tắt được                                                                                                                                     | C+X | P2-10        | M   | Email nhắc cần nhà cung cấp: để sau, **cần ADR, hỏi người**                                                                                |

### Đợt 2 · Trả tiền — "Dùng đều thì trả tiền xứng đáng"

**Cổng:** chuyển đổi free → trả phí đạt ngưỡng chốt từ beta (giả định ban đầu ≥ 3%); chi phí AI mỗi giờ họp thấp hơn doanh thu mỗi giờ họp (H5).

| ID    | Task                                                                                               | Chủ | Phụ thuộc     | Cỡ  | Ghi chú                                                                                    |
| ----- | -------------------------------------------------------------------------------------------------- | --- | ------------- | --- | ------------------------------------------------------------------------------------------ |
| W2-01 | **ADR nhà cung cấp thanh toán** (Stripe, Paddle, Lemon Squeezy…)                                   | U+C | số H5 từ beta | S   | Nhà cung cấp mới: **hỏi người trước**, không chọn thay                                     |
| W2-02 | **Mô hình gói và quota:** gói Free/Pro, đếm giờ Copilot theo tháng từ `sessions`, kiểm quyền ở API | C   | W2-01         | L   | Migration schema: task-loop nhạy cảm                                                       |
| W2-03 | **Checkout, webhook, đổi/huỷ gói** tự phục vụ; trạng thái gói ở app và web                         | C   | W2-01, W2-02  | L   |                                                                                            |
| W2-04 | **Giới hạn và trang giá trong app:** báo trước khi gần hết quota; trang Giá; nâng cấp một bước     | X   | W2-02         | M   | Câu hỏi mở: hết quota giữa cuộc họp thì làm gì (không cắt đột ngột)                        |
| W2-05 | **Trang chủ công khai:** giá, so sánh, FAQ, tải app; đo chuyển đổi tối thiểu                       | X   | P2-13, P2-09  | M   | Dùng event nội bộ trước; analytics bên ngoài **cần ADR, hỏi người**                        |
| W2-06 | **Pháp lý:** điều khoản, chính sách riêng tư, mẫu thông báo cho người dự họp, trang xoá dữ liệu    | U+X | —             | M   | Rủi ro cao (Nghị định 13/2023); cần người có chuyên môn pháp lý xem trước khi mở công khai |
| W2-07 | **Phản hồi và hỗ trợ trong app:** gửi lỗi/góp ý (không đính transcript), liên hệ                   | X   | —             | S   |                                                                                            |

### Đợt 3 · Nói được — "Tuần này bạn cần AI ít hơn"

**Cổng:** Assist level giảm thật ở ≥ 30% người dùng sau 6 tuần (giả định ban đầu).

| ID    | Task                                                                                        | Chủ | Phụ thuộc | Cỡ  | Ghi chú                                 |
| ----- | ------------------------------------------------------------------------------------------- | --- | --------- | --- | --------------------------------------- |
| P2-06 | Nghe lại đoạn khó (clip ngắn, có đồng ý, tự xoá theo hạn)                                   | C   | P2-12, U  | L   | Quyền riêng tư: mặc định tắt            |
| W3-01 | **ADR + spike chấm phát âm** trên mic của chính người dùng, chạy trên máy                   | C   | P2-06     | L   | Model âm vị mới: **cần ADR, hỏi người** |
| W3-02 | **Speech Coach và shadowing** trong debrief: 3 từ phát âm lệch hay lặp lại, nghe thử và tập | X   | W3-01     | L   |                                         |
| W3-03 | **Assist Dial đầy đủ** (mức 5, 2, 0) và đề xuất tốt nghiệp từng mức                         | C   | P2-07     | M   | Logic thuần ở `learner-model`           |
| W3-04 | **Gợi ý câu trả lời tự động** (mức 4, 5)                                                    | C   | W3-03     | L   | Độ trễ và quyền riêng tư                |
| W3-05 | **Daily Mix:** phiên 10 phút gom ôn, nghe lại và một câu cần nói                            | C+X | W1-03     | L   |                                         |

### Đợt 4 · Mở rộng

Chưa có task. Điều kiện mở từng hướng (Windows, mobile, extension, roleplay, ngôn ngữ thứ ba, voice mode, B2B) ở [Lộ trình](./04-roadmap.md#điều-kiện-mở-các-hướng-ở-đợt-4).

## M1 · Caption sống

Đường găng: thu âm hệ thống (Swift) → STT → dịch → overlay. Mọi thứ khác chờ xung quanh nó.

| ID    | Task                                                                                                                                              | Chủ | Phụ thuộc           | Cỡ  | Ghi chú                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------- | --- | --------------------------------------------------------------------------------------- |
| M1-01 | **Spike thu âm**: Swift package bắt âm thanh hệ thống (Core Audio Process Tap) + mic, ghi ra file WAV, đo độ trễ; xin quyền TCC                   | C   | —                   | M   | Rủi ro cao nhất; làm đầu tiên. Cần bạn bấm cấp quyền Micro/Audio Capture ở lần chạy đầu |
| M1-02 | **Cầu Swift ↔ Rust**: Swift CLI sidecar xuất PCM/JSON qua stdout; Rust spawn, đọc, phát event Tauri                                               | C   | M1-01               | M   | Quyết định sidecar vs FFI ghi vào ADR nếu khác scaffold                                 |
| M1-03 | **STT on-device**: FluidAudio + Parakeet-TDT, VAD, `transcript.partial/final` có timestamp từ                                                     | C   | M1-02               | L   | Tải model ~600 MB; chạy ngoài sandbox                                                   |
| M1-04 | **Hợp đồng realtime** `@cuelingo/shared` `ws.ts` (hello, segment.final, translation, error) + schema Zod + test                                   | X   | —                   | S   | Theo `04-realtime-pipeline.md`; chạy song song với M1-01                                |
| M1-05 | **ai-gateway**: task `translate` (Vercel AI SDK), timeout 3 s + dự phòng, prompt có phiên bản trong `@cuelingo/prompts`, eval nhỏ trong `ml/eval` | C   | —                   | M   | Cần **U**: một API key LLM (Anthropic/Google/OpenAI) trong `.env`                       |
| M1-06 | **api/realtime**: WebSocket Fastify, xác thực, nhận `segment.final`, dịch với 3 câu trước + glossary, trả `translation`                           | C   | M1-04, M1-05        | L   | Auth WS dùng session Better Auth; M1 cho phép token dev                                 |
| M1-07 | **core-sdk realtime client**: kết nối WS, đệm 60 s khi mất mạng, kết nối lại, kiểu theo `ws.ts`                                                   | X   | M1-04               | M   | Test với WS giả                                                                         |
| M1-08 | **session-controller (desktop)**: nối native event → WS → overlay; trạng thái phiên (idle/running/error); `useSession()`                          | X   | M1-02, M1-07        | M   | Chỉ gọi `native.*` và core-sdk                                                          |
| M1-09 | **Overlay hoàn thiện**: partial nhạt/final đậm, Assist level 4/3/1 đồng bộ main↔overlay (Rust phát event), cỡ chữ 14–24, sáng/tối, ghim           | X   | M1-08               | M   | Cần thêm event `settings` trong Rust: **C** thêm trước, **X** dùng                      |
| M1-10 | **Đo độ trễ end-to-end** + chạy thật với Zoom/Meet 30 phút; ghi số liệu vào docs                                                                  | C   | M1-03, M1-06, M1-09 | M   | Cổng M1                                                                                 |

## M2 · Quick Assist (Alpha nội bộ)

| ID    | Task                                                                                                             | Chủ | Phụ thuộc    | Cỡ  |
| ----- | ---------------------------------------------------------------------------------------------------------------- | --- | ------------ | --- |
| M2-01 | `api/assist`: `lookup` (tra từ theo ngữ cảnh), `recap` (60 s gần nhất), `compose` (VI → 2 câu EN); prompt + eval | C   | M1-05        | L   |
| M2-02 | Glossary cá nhân vào pipeline: gợi ý thuật ngữ cho STT (boost) và prompt dịch; chọn glossary trước họp           | C   | M1-06        | M   |
| M2-03 | `desktop/quick-assist` UI: popup tra từ (click từ trong overlay), ô "Họ vừa nói gì?", ô soạn câu + teleprompter  | X   | M2-01, M1-09 | L   |
| M2-04 | Phím tắt ⌘⇧W (recap) và ⌘⇧S (nói giúp) nối với UI; hotkey event đã có ở Rust                                     | X   | M2-03        | S   |
| M2-05 | Gắn nhãn người nói "Tôi" / "Speaker N" (tách luồng mic/system; diarization nhẹ cho system); đổi tên được         | C   | M1-03        | L   |
| M2-06 | Event học tập: `lookup`, `translation_expanded`, `recap_used`… vào `api/events` (append-only) + schema contract  | X   | M1-04        | M   |
| M2-07 | **Alpha nội bộ**: bạn dùng thật 3 cuộc họp; Claude gom lỗi, sửa, ghi vào review                                  | U+C | tất cả M2    | —   |

## M3 · Debrief

| ID    | Task                                                                                                              | Chủ | Phụ thuộc                  | Cỡ  |
| ----- | ----------------------------------------------------------------------------------------------------------------- | --- | -------------------------- | --- |
| M3-01 | Lưu phiên: `api/sessions` (tạo/kết thúc), lưu segments + events vào Postgres (bảng đã có), tắt lưu audio mặc định | C   | M1-06, M2-06               | M   |
| M3-02 | Đồng bộ desktop → API: client đăng nhập trong app (magic link → deep link `cuelingo://`), token trong Keychain    | C   | M3-01                      | L   |
| M3-03 | `workers/debrief-job`: tóm tắt, quyết định/việc cần làm, cụm từ khó, "câu bạn nói → câu nên nói"; prompt + eval   | C   | M3-01                      | L   |
| M3-04 | `web/debrief`: danh sách phiên + trang chi tiết 5 khối, transcript song ngữ, xuất Markdown                        | X   | M3-03 (hợp đồng DTO trước) | L   |
| M3-05 | Nghe lại đoạn khó 0,75x/1x, ẩn/hiện chữ (cần lưu audio đoạn ngắn có đồng ý)                                       | X   | M3-04                      | M   |
| M3-06 | Nút "Lưu cụm từ" từ debrief → Phrase Bank (API + UI)                                                              | X   | M3-04                      | S   |

## M4 · Học và ôn

| ID    | Task                                                                                                             | Chủ | Phụ thuộc   | Cỡ  |
| ----- | ---------------------------------------------------------------------------------------------------------------- | --- | ----------- | --- |
| M4-01 | `packages/learner-model`: lexicon tiếp nhận/sản xuất, cập nhật từ event, FSRS (thư viện có sẵn), test thuộc tính | C   | M2-06       | L   |
| M4-02 | `api/phrases-review`: Phrase Bank CRUD (copy `glossary`), hàng đợi ôn hôm nay, ghi `review_logs`                 | X   | M4-01 (DTO) | L   |
| M4-03 | `web/review`: phiên ôn 5–10 phút, 3 dạng bài (nhận diện, điền từ, nghe–gõ), có câu gốc + audio                   | X   | M4-02       | L   |
| M4-04 | `api/progress` + `web/progress`: % hiểu, số cụm, streak, chỉ số phụ thuộc theo tuần                              | X   | M4-01       | M   |
| M4-05 | Assist Dial gợi ý nâng/giảm mức từ dữ liệu thật (3 mức MVP)                                                      | C   | M4-01       | M   |
| M4-06 | Bài nghe đánh giá ban đầu (F1/US-02): 5 phút, ra mức nghe + Assist mặc định                                      | X   | M4-01       | M   |

## M5 · Beta

| ID    | Task                                                                                                             | Chủ | Phụ thuộc | Cỡ  |
| ----- | ---------------------------------------------------------------------------------------------------------------- | --- | --------- | --- |
| M5-01 | Onboarding thật: kiểm quyền TCC (micro, ghi màn hình) từ Rust/Swift thay cho `unknown`, hướng dẫn khi bị từ chối | C   | M1-01     | M   |
| M5-02 | Quyền riêng tư: xoá phiên + dữ liệu rút ra, xoá tài khoản, tắt lưu audio, `workers/retention` có storage thật    | C   | M3-01     | M   |
| M5-03 | `desktop/settings` lưu bền (store Tauri) + trang cài đặt web                                                     | X   | M1-09     | M   |
| M5-04 | Nhà cung cấp email production cho magic link, cookie domain cho web ↔ API, Google OAuth                          | C+U | —         | M   |
| M5-05 | Ký + notarize `.app`, tự cập nhật (Tauri updater), kênh phân phối beta                                           | C+U | —         | L   |
| M5-06 | Quan sát: log có cấu trúc, đo chi phí AI / giờ họp (H5), Sentry; tối ưu độ trễ và CPU/RAM phiên 2 giờ            | C   | M1-10     | L   |
| M5-07 | Closed beta: 30–50 người, form phản hồi, dashboard H1–H4                                                         | U+C | tất cả    | —   |

## Việc đã làm và việc dở để tới Beta (mã P2)

**Hiện trạng (2026-11-02):** M1–M4 đã chạy được từ đầu đến cuối trên máy dev: caption song ngữ, tra từ/tóm tắt/nói giúp, lưu cuộc họp, debrief 5 khối, Phrase Bank, ôn FSRS, tiến độ; desktop có khung giao diện cho cả lộ trình (mục chưa làm ghi "Sắp ra mắt"); web dùng chung khung với desktop. **Đã có mã nhưng chưa ai chạy thật (◐):** đăng nhập trong app (P2-01), onboarding (P2-14), cài đặt lưu bền (P2-15), quan sát (P2-20), debrief hoàn thiện (P2-16), gợi ý ngôn ngữ từ lịch (P3-08), đăng nhập production (P2-23: Google OAuth, Resend/SMTP đã nối), nối thuật ngữ vào nhận dạng (P2-04: sidecar xong, còn Rust + desktop). **Chưa làm:** nghe lại đoạn khó (P2-06), ký + notarize + tự cập nhật (P2-09), chạy thật Zoom/Meet (P2-22), nhãn người nói (P2-24), beta (P2-25); và toàn bộ phần thanh toán/gói.

**Cách chia làn:** **C** (Claude) giữ phần native (Swift/Rust), AI/prompt, bảo mật/auth, hạ tầng phát hành. **X** (Codex) làm React/Next, CRUD API, test, tài liệu. Mỗi nhóm có hai làn chạy cùng lúc; X tối đa 3–4 brief khác thư mục; file dùng chung (`roadmap.ts`, `app.ts`, `server.ts`, `package.json`, lockfile) do C sửa khi gộp. Mỗi task X có brief `04-brief-<id>.md` trong `06-delivery/2026-11-06-phase2/`.

Quy ước trạng thái trong `packages/ui/src/lib/roadmap.ts`: khi một tính năng chạy thật trong một client thì đổi `status.<client>` thành `ready`; mọi mục còn lại tự hiện "Sắp ra mắt".

### Nhóm A · Nền để người khác dùng được

| ID       | Task                                                                                                                                                                                                                                                                                                             | Chủ | Phụ thuộc | Cỡ  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------- | --- |
| P2-01 ◐  | **Đăng nhập trong app.** Desktop mở `WEB/login?app=1`; sau magic link web gọi `POST /v1/device/code` (cần session) lấy mã dùng một lần, mở `cuelingo://auth?code=…`; app đổi mã lấy token qua `POST /v1/device/exchange`, lưu token trong Keychain (crate `keyring`), gửi `Authorization: Bearer`. Thu hồi được. | C   | M3-01     | L   |
| P2-02 ✅ | **Quyền macOS thật.** Sidecar Swift có lệnh `--permissions` (micro: `AVCaptureDevice`; thu âm hệ thống: thử mở tap ngắn), Rust lệnh `permissions_status` gọi nó; `PermissionsStep` hiện đúng đã cấp/từ chối/chưa hỏi, nút mở thẳng Cài đặt hệ thống.                                                             | C   | —         | M   |
| P2-03 ✅ | **Đóng gói sidecar vào `.app`** (`bundle.resources`/`externalBin`), build script `pnpm desktop:build`, bỏ biến `CUELINGO_AUDIO_BIN` khi chạy bản đóng gói; ký ad-hoc cho dev, chuẩn bị chỗ gắn chứng chỉ thật.                                                                                                   | C   | —         | M   |
| P2-10 ✅ | **Desktop: Ôn tập + Cụm từ** thành trang thật (dùng `/v1/review/*`, `/v1/phrases`), cùng trải nghiệm với web (phím 1–4, thẻ nhận diện/điền chỗ trống), qua `app/views.ts`.                                                                                                                                       | X   | M4        | L   |
| P2-11 ✅ | **Desktop: Thuật ngữ + Tiến độ** thành trang thật (`/v1/glossary`, `/v1/progress`), thêm/xoá thuật ngữ, biểu đồ 7 ngày và 4 tuần.                                                                                                                                                                                | X   | M4        | M   |
| P2-12 ✅ | **Quyền riêng tư:** `DELETE /v1/sessions/:id`, `DELETE /v1/me/data` (xoá cuộc họp, cụm từ, event, debrief của chính mình, giữ tài khoản), `GET /v1/me/export` (JSON); UI ở trang Cài đặt web và desktop (xác nhận hai bước); `workers/retention` xoá hẳn phiên đã đánh dấu `deleted` sau 7 ngày.                 | X   | M3-01     | M   |
| P2-13 ✅ | **Web: trang chủ giới thiệu + trang tải app** (`/` cho khách chưa đăng nhập: giá trị chính, ba bước dùng, ảnh minh hoạ overlay vẽ bằng HTML, nút tải/đăng ký chờ; `/download` hướng dẫn cài và cấp quyền). Dùng skill thiết kế đã cài, không dùng gradient/thẻ icon.                                             | X   | —         | M   |

### Nhóm B · Dùng hằng ngày được

| ID       | Task                                                                                                                                                                                                                                                                                                     | Chủ | Phụ thuộc    | Cỡ  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------ | --- |
| P2-04 ◐  | **Nối thuật ngữ vào nhận dạng** (sidecar `vocab` đã xong và có test; còn lệnh Rust và phía desktop gửi glossary)**.** Khi bắt đầu phiên desktop lấy glossary của người dùng, gửi `vocab [...]` tới sidecar (lệnh Rust mới), làm mới khi đổi; thêm cụm nhiều từ vào bộ sửa; prompt dịch đã nhận glossary. | C   | P2-01        | M   |
| P2-05 ✅ | **Giọng đọc (TTS):** task `tts.speak` trong `ai-gateway`, job `tts-cache` lưu file theo hash văn bản, endpoint `GET /v1/tts?text=` trả URL ký; lưu cục bộ khi dev, S3-tương-thích khi có.                                                                                                                | C   | —            | L   |
| P2-14 ◐  | **Onboarding đầu tiên (desktop):** 4 bước (chào, cấp quyền với trạng thái thật, thử caption mẫu, chọn mức hỗ trợ), chỉ hiện lần đầu, lưu bền.                                                                                                                                                            | X   | P2-02        | M   |
| P2-15 ◐  | **Cài đặt lưu bền:** `GET/PATCH /v1/me/settings` (mức hỗ trợ mặc định, ngôn ngữ giao diện, giữ audio hay không), desktop lưu cục bộ bằng store Tauri và đồng bộ, trang Cài đặt web.                                                                                                                      | X   | P2-01        | M   |
| P2-16 ◐  | **Debrief hoàn thiện:** bấm đoạn khó mở transcript tại đúng câu, lọc theo người nói, sao chép/đính kèm debrief, tải Markdown cả cuộc họp, trạng thái "đang tạo" có tiến trình.                                                                                                                           | X   | M3           | M   |
| P2-17 ✅ | **Bài nghe–gõ + nghe phát âm cụm từ** trong ôn tập (web và desktop) dùng `GET /v1/tts`.                                                                                                                                                                                                                  | X   | P2-05, P2-10 | M   |
| P2-06    | **Nghe lại đoạn khó** (dời sang Đợt 3, cùng gốc audio với Speech Coach)**:** sidecar cắt clip ngắn quanh câu khi người dùng bật và đồng ý, tải lên kho file, debrief phát 0,75×/1×, tự xoá theo hạn lưu.                                                                                                 | C   | P2-12, U     | L   |

### Nhóm C · Học thông minh và phát hành

| ID       | Task                                                                                                                                                                         | Chủ | Phụ thuộc | Cỡ  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------- | --- |
| P2-07 ✅ | **Assist Dial tự gợi ý:** luật thuần trong `learner-model` (đề xuất giảm mức khi % hiểu ≥ 85 ba cuộc họp liền, tăng khi < 60; không tự đổi), `GET /v1/me/assist-suggestion`. | C   | M4        | M   |
| P2-18 ✅ | **UI gợi ý Assist Dial:** thẻ trên Phiên họp (desktop) và Tiến độ (web) với "Áp dụng / Để sau", ghi event.                                                                   | X   | P2-07     | S   |
| P2-08 ✅ | **Bài nghe đánh giá đầu vào:** 6 đoạn nghe có TTS, chấm điểm, ra mức nghe + Assist mặc định (`POST /v1/placement`).                                                          | C   | P2-05     | M   |
| P2-19 ✅ | **UI bài đánh giá** (web + desktop), có thể làm lại.                                                                                                                         | X   | P2-08     | M   |
| P2-20 ◐  | **Quan sát:** log có cấu trúc + request id, đo chi phí AI mỗi giờ họp (bảng `events`), trang nội bộ `/admin/metrics` số liệu H1–H5, Sentry tuỳ chọn qua biến môi trường.     | X   | —         | M   |
| P2-21 ✅ | **Kiểm thử đầu-cuối:** Playwright cho web (đăng nhập magic link dev → cuộc họp → debrief → lưu cụm từ → ôn → tiến độ), chạy trong CI.                                        | X   | P2-13     | M   |
| P2-09    | **Ký + notarize + tự cập nhật + kênh phát hành:** workflow GitHub Actions dựng `.dmg`, ký, notarize, Tauri updater, trang `/download` trỏ bản mới nhất.                      | C+U | P2-03, U  | L   |

### Nhóm D · Closed beta

| ID      | Task                                                                                                                                                                                                | Chủ | Phụ thuộc                                | Cỡ           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------- | ------------ |
| P2-22   | **M1-10 chạy thật:** Zoom/Meet 30 phút, đo p95 độ trễ, overlay không lộ khi chia sẻ màn hình, CPU/RAM phiên 2 giờ; ghi số liệu.                                                                     | U+C | P2-03                                    | M            |
| P2-23 ◐ | **Đăng nhập thật** (đã có mã Google OAuth và Resend/SMTP; còn khoá, domain, ADR cho Resend)**:** Google OAuth, email gửi magic link (nhà cung cấp), cookie domain web ↔ API, CORS theo domain thật. | C+U | —                                        | M            |
| P2-24   | **Nhãn người nói "Speaker N"** (tách người trong luồng hệ thống) và đổi tên người nói trong debrief.                                                                                                | C   | P2-16                                    | L            |
| P2-25   | **Form phản hồi + dashboard H1–H4**, mời 30–50 người dùng thử, vòng sửa lỗi hai tuần.                                                                                                               | U+C | W0-01, W0-02, W0-03, P2-09, P2-22, P2-23 | L (hai tuần) |

### Thứ tự chạy và ranh giới file

- **Nhóm A** (đã chạy): C làm P2-02 rồi P2-01 rồi P2-03; X làm P2-10, P2-11, P2-12, P2-13 song song (khác thư mục: `apps/desktop/src/study/*`, `apps/desktop/src/study/*` thuật ngữ + tiến độ ở thư mục riêng, `services/api/modules/privacy`, `apps/web/src/app/(public)`).
- Mọi trang mới của desktop đăng ký qua `apps/desktop/src/app/views.ts`; mỗi brief thêm đúng một dòng. C đổi `roadmap.ts` sau khi gộp.
- **Cổng giữa các nhóm:** `pnpm verify` xanh, người dùng thử bản `.app` mới, cập nhật mục này (đánh ✅), rồi mới mở nhóm kế.
- **Việc của người dùng (U)** theo nhóm: A: không. B: nơi lưu file (S3-tương-thích hoặc dùng đĩa cục bộ khi demo). C: tài khoản Apple Developer. D: tài khoản email gửi thư, khoá Google OAuth, domain, họp thử thật.
- **Rủi ro mới:** token thiết bị (P2-01) là thay đổi bảo mật, cần review kỹ; nơi lưu audio (P2-06) liên quan quyền riêng tư nên mặc định tắt và cần đồng ý rõ; chi phí TTS (P2-05) cần cache theo hash để không gọi lặp.

## Đa ngôn ngữ (mã P3, theo [ADR 0013](../08-adr/0013-multi-language.md))

Ví dụ dẫn đường: họp tiếng Anh lúc 9 giờ, tiếng Nhật lúc 10 giờ. Ngôn ngữ thuộc **từng cuộc họp**; dữ liệu học (từ vựng, lịch ôn, tiến độ, mức nghe) tách **theo từng ngôn ngữ**; chuỗi ngày và tài khoản dùng chung.

| ID       | Task                                                                                                                                                                                                                                                                 | Chủ | Phụ thuộc | Cỡ  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------- | --- |
| P3-01 ✅ | **Nền dữ liệu:** migration thêm `language` cho `sessions`, `lexical_items`, `glossary_terms`, bảng `learner_languages`, đổi khoá duy nhất, điền `en`; `SUPPORTED_LANGUAGES` ở `@cuelingo/shared`. Không đổi hành vi.                                                 | C   | —         | M   |
| P3-02 ✅ | **API theo ngôn ngữ:** tạo cuộc họp có `language`; danh sách, hàng đợi ôn, cụm từ, thuật ngữ, tiến độ nhận `language`; ghi lấy ngôn ngữ từ tài nguyên; test chống lẫn dữ liệu giữa hai ngôn ngữ.                                                                     | C   | P3-01     | L   |
| P3-03 ✅ | **Chọn ngôn ngữ họp trong app:** bộ chọn ở thẻ Caption trực tiếp và overlay (nhớ lần gần nhất, danh sách đã dùng), gửi `language` khi tạo cuộc họp và trong `hello`; bộ chuyển ngôn ngữ ở Ôn tập, Cụm từ, Thuật ngữ, Tiến độ (web và desktop, dùng component chung). | X   | P3-02     | L   |
| P3-04 ✅ | **Sidecar nhiều model:** lệnh `language <mã>`, chọn model nhận dạng theo ngôn ngữ, tải và nạp model có thanh tiến độ, đổi giữa chừng; đo p95.                                                                                                                        | C   | P3-01     | L   |
| P3-05 ✅ | **Tiếng Nhật làm ngôn ngữ thứ hai:** `translate.realtime@v2` theo cặp ngôn ngữ, prompt tra từ/tóm tắt/soạn câu/debrief có ngôn ngữ và chữ đọc, giọng đọc theo ngôn ngữ, eval dịch và nhận dạng với bộ mẫu tiếng Nhật.                                                | C   | P3-04     | L   |
| P3-06 ✅ | **Tách từ và bài gõ theo ngôn ngữ:** `Intl.Segmenter` cho bấm tra từ; so khớp ký tự cho tiếng Nhật trong bài nghe–gõ; hiển thị chữ đọc.                                                                                                                              | X   | P3-05     | M   |
| P3-07 ✅ | **Mức nghe và Assist Dial theo ngôn ngữ:** dùng `learner_languages`; gợi ý đổi mức tính riêng từng ngôn ngữ; bài đánh giá đầu vào làm riêng cho mỗi ngôn ngữ.                                                                                                        | C+X | P3-02     | M   |
| P3-08 ◐  | **Tự nhận ngôn ngữ và gợi ý từ lịch:** nhận dạng ngôn ngữ ở vài giây đầu, đề xuất đổi ("nghe như tiếng Nhật, đổi?"); đọc lịch để gợi ý ngôn ngữ trước giờ họp.                                                                                                       | C   | P3-05     | M   |

Thứ tự: P3-01 → P3-02 làm trước vì không đổi hành vi nên an toàn; P3-03 và P3-04 chạy song song; P3-05 là cổng kiểm chứng kiến trúc (chất lượng tiếng Nhật), chỉ khi qua eval mới bật cho người dùng.

## Việc cần từ người dùng (U)

| Khi nào      | Việc                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Trước M1-05  | Một API key LLM (nhà cung cấp tuỳ bạn) đặt vào `.env`. Khuyến nghị bắt đầu với một model rẻ, nhanh |
| M1-01        | Bấm cấp quyền Micro và Audio Capture/Screen Recording cho app khi macOS hỏi                        |
| M2-07, P2-25 | Dùng thật và báo lỗi                                                                               |
| P2-23, P2-09 | Tài khoản email gửi thư, tài khoản Apple Developer (ký app), domain                                |

## Điều chưa chắc và cách giảm rủi ro

| Rủi ro                                                              | Giảm thiểu                                                                                         |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Bắt âm thanh hệ thống trên macOS (quyền, phiên bản) khó hơn dự kiến | M1-01 là spike đứng riêng, làm đầu tiên; nếu Process Tap lỗi thì dùng ScreenCaptureKit (macOS 13+) |
| STT on-device chưa đo streaming thật                                | M1-03 đo ngay; nếu vượt ngân sách thì bật chế độ STT cloud (đã có trong thiết kế, ADR-0003)        |
| Độ trễ dịch vượt 2,5 s                                              | Dịch theo cụm trước khi hết câu, model nhỏ hơn, dự phòng; đo ở M1-10                               |
| Codex không có mạng, không chạy cargo/Swift                         | Claude cài sẵn dependency; giao cho Codex chỉ phần TS/React; native luôn là của Claude             |
| Lockfile và `shared/index.ts` xung đột khi nhiều brief song song    | Tối đa hai brief của Codex cùng lúc, khác thư mục; Claude merge và tạo lại lockfile                |

## Cách chạy từng task

Task của **C**: `task-loop` (spec → plan → kết quả), commit theo bước. Task của **X**: Claude viết `04-brief-<id>.md` trong hồ sơ của mốc, tạo worktree `.worktrees/<slug>-codex`, cài sẵn dependency, chạy Codex, review chéo, merge. Hồ sơ mỗi mốc nằm trong [Delivery Log](../06-delivery/README.md).
