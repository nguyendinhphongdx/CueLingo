# Agent

> Phần: [API service](./README.md) · Code: `services/api/src/modules/agent/` · Quyết định: [ADR 0018](../../08-adr/0018-agent-harness.md) · Hồ sơ: [ai-agent](../../06-delivery/2026-11-05-ai-agent/02-plan.md)

Một lượt trả lời của trợ lý AI mỗi request: dựng ngữ cảnh, gọi mô hình qua gateway, chạy công cụ, stream kết quả bằng SSE, lưu tin nhắn và tính quota. Vòng lặp nằm ở [`@cuelingo/agent`](../05-packages/agent.md); module này nối nó với DB, gateway và các module khác.

## Trách nhiệm

- `POST /v1/conversations/:id/messages` trả `text/event-stream`; tin của người dùng được lưu **ngay**, tin của trợ lý lưu `streaming` rồi cập nhật `parts` sau mỗi bước mô hình và mỗi kết quả công cụ, trạng thái cuối lưu **trước** khi gửi `done`
- Khoá trong tiến trình theo `userId` (mọi hội thoại): người dùng đã có một lượt đang chạy thì lượt thứ hai là `409 CONFLICT`. Quota được kiểm trước khi lưu tin `user`, nên nếu khoá theo hội thoại thì N hội thoại song song cùng qua một lần kiểm; khoá theo người dùng đóng lỗ hổng đó. Khoá được nhả ngay sau khi lưu trạng thái cuối (trước khi gửi `done`). Khớp ADR-0011, một container; nợ khi scale ngang
- Quota theo ngày UTC, kiểm **trước khi stream** (429) và trước mỗi bước tiếp theo (`done{limited}`)
- Khách ngắt kết nối → huỷ lượt → tin lưu `stopped`, giữ phần chữ đã sinh; khoá được nhả
- Lỗi của nhà cung cấp không lộ ra: client chỉ thấy `error{AGENT_FAILED}` rồi `done{error}`
- Công tắc toàn cục của admin (`service.admin`, trong bộ nhớ) cộng với env `AGENT_ENABLED`: tắt ở một trong hai thì `503 AGENT_DISABLED`
- Plugin `core` (nội bộ) với 4 công cụ; `capabilities` là facade gắn `userId` của phiên, không đưa SQL hay `userId` thô cho công cụ

## Phạm vi MVP

- Lô 1 của ai-agent (thử nghiệm, sau cờ `AGENT_ENABLED`). Lô 2: công tắc toàn cục và bật/tắt plugin cho admin ([admin](./admin.md)), plugin thứ hai `exercise`.

## Interface

`POST /v1/conversations/:id/messages` — body `SendMessageRequest` (`{content, language?}`, `content` 1–4000 ký tự, `language` mặc định là ngôn ngữ của hội thoại).

**Lỗi trước khi stream** (JSON `ErrorResponse`, chưa lưu gì):

| Status | `error.code`           | Khi nào                                                                                      |
| ------ | ---------------------- | -------------------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`     | body/`id` sai                                                                                |
| 401    | `UNAUTHORIZED`         | chưa đăng nhập                                                                               |
| 404    | `NOT_FOUND`            | hội thoại không tồn tại, đã xoá hoặc của người khác                                          |
| 409    | `CONFLICT`             | người dùng đang có một lượt chạy (ở bất kỳ hội thoại nào)                                    |
| 429    | `AGENT_QUOTA_EXCEEDED` | hết lượt/token/USD trong ngày; `error.details` là `AgentQuota` (`used`, `limit`, `resetsAt`) |
| 503    | `AGENT_DISABLED`       | `AGENT_ENABLED=false`, thiếu `GEMINI_API_KEY` hoặc admin đã tắt công tắc                     |

**Khi stream** (200): header `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`; không nén. Qua `reply.send(stream)` (không `hijack`) nên CORS/`x-request-id` vẫn chạy. Mỗi event là một khối:

```text
event: <type>
data: <AgentStreamEvent dạng JSON một dòng, gồm cả trường "type">

```

Ví dụ một lượt có công cụ:

```text
event: status
data: {"type":"status","status":"thinking"}

event: tool_call
data: {"type":"tool_call","callId":"s0c0","tool":"save_phrase"}

event: tool_result
data: {"type":"tool_result","callId":"s0c0","tool":"save_phrase","ok":true,"summary":"Đã lưu \"circle back\" vào Phrase Bank"}

event: status
data: {"type":"status","status":"thinking"}

event: text_delta
data: {"type":"text_delta","text":"Đã lưu rồi nhé."}

event: done
data: {"type":"done","status":"complete"}

```

Thứ tự: `status{thinking}` (đầu mỗi bước) → `text_delta`\* → `tool_call` → `tool_result` → `card`? → … → `done` (luôn cuối, đúng một lần). Lỗi mô hình: `error{AGENT_FAILED}` rồi `done{error}`. `done.status`: `complete` · `stopped` · `limited` (hết 6 bước, 8 lần gọi công cụ, 60 giây hoặc quota giữa lượt) · `error`. Sau `done`, client đọc lại `GET /v1/conversations/:id` để lấy id và `parts` đã lưu.

**Công cụ của plugin `core`** (quyền khai báo: `phrases:read`, `phrases:write`, `lookup`, `cards`):

| Tool                 | Loại  | Việc                                                                                           |
| -------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| `lookup_word`        | read  | Dùng lại `AssistService.lookup` (`assist.lookup`); input `{term, context?}`                    |
| `list_saved_phrases` | read  | Cụm từ đã lưu của chính người dùng, tối đa 30, chỉ `phrase` và `meaningVi`                     |
| `save_phrase`        | write | `PhrasesService.save` với `{phrase, meaningVi?, context?}`; tối đa 3 lần ghi mỗi lượt          |
| `show_card`          | read  | `{kind, data}`; `data` kiểm bằng `AgentCardSchema`, sai thì trả `shown:false` kèm chỗ sai ngắn |

**Cấu hình** (`config.ts`, mẫu ở `.env.example`):

| Biến                         | Mặc định  | Ý nghĩa                                                                  |
| ---------------------------- | --------- | ------------------------------------------------------------------------ |
| `AGENT_ENABLED`              | `true`    | Công tắc toàn cục; `false` thì 503                                       |
| `AI_AGENT_MODEL`             | (gateway) | Model task `agent.chat`; gateway tự đọc, đã có `AI_AGENT_FALLBACK_MODEL` |
| `AGENT_QUOTA_TURNS_PER_DAY`  | 60        | Số lượt mỗi người mỗi ngày UTC                                           |
| `AGENT_QUOTA_TOKENS_PER_DAY` | 400000    | Token vào + ra                                                           |
| `AGENT_QUOTA_USD_PER_DAY`    | 0.25      | Chi phí ước tính                                                         |

## Phụ thuộc

- `@cuelingo/agent` (vòng lặp, registry, parts), `@cuelingo/ai-gateway` (`chat()`), `@cuelingo/prompts` (`agent.chat@v1`), `@cuelingo/shared`.
- `modules/conversations` (lưu tin), `modules/assist` (tra từ), `modules/review` (Phrase Bank); nối trong `app.ts`.

## Dữ liệu & sự kiện

- Ghi `agent_messages` qua `ConversationsRepository`. Mỗi bước mô hình là một `ai_call` (task `agent.chat`) do hook của gateway ghi (`lib/ai-calls.ts`); payload nay có thêm `inputTokens`, `outputTokens` để cộng quota.
- Quota ngày (UTC): **lượt** = số tin `user` hôm nay trong `agent_messages`; **token** và **USD** = tổng `ai_call` của task `agent.chat` trong `events` (index `events_type_user_at_idx`). `recordAiCall` bất đồng bộ nên quota có thể trễ một bước; trong lượt, token của chính lượt được cộng thêm để làm biên an toàn.
- Công cụ đọc không ghi `ai_call` riêng. `lookup_word` gọi `AssistService.lookup` (task `assist.lookup`, không thuộc quota agent), nên chặn lạm dụng bằng **trần 8 lần gọi công cụ mỗi lượt** (`maxToolCalls`, tính cả công cụ đọc; vượt thì lượt kết thúc `done{limited}`) và mỗi lượt vẫn tính vào số lượt/ngày. Cách này đơn giản hơn ghi thêm chi phí và đủ để chi phí mỗi lượt có trần.
- Khi người dùng bấm Dừng giữa chừng, gateway ghi `ai_call` với token **ước tính** (đầu vào ≈ độ dài prompt + tin nhắn / 4, đầu ra ≈ chữ đã nhận / 4) thay vì không ghi gì, để Dừng không né được chi phí.
- Đọc hội thoại (`GET /v1/conversations/:id`) trả **500 tin mới nhất** theo thứ tự cũ → mới, nên lịch sử gửi cho mô hình luôn là phần gần nhất.
- `DELETE /v1/me/data` xoá `agent_messages` và `events`, mà quota ngày được tính từ hai nguồn đó, nên **quota trong ngày cũng về 0**. Chấp nhận được ở MVP (thao tác xoá hiếm, có xác nhận); nếu bị lạm dụng thì cần bảng đếm riêng không bị xoá theo.
- Index một phần `agent_messages_streaming_idx (status) WHERE status = 'streaming'` (migration `20261110090000`) để tìm tin bị kẹt `streaming`.
- Lịch sử gửi cho mô hình chỉ gồm chữ của các tin đã `complete`/`stopped`/`limited`; bước công cụ và thẻ của lượt cũ không được phát lại.
- Không log nội dung tin nhắn, output công cụ hay lỗi gốc của nhà cung cấp; log chỉ có id.

## Câu hỏi mở

- Endpoint đọc `AgentQuota` cho UI (hiện chỉ có trong `details` của 429).
- Khoá theo hội thoại chỉ đúng với một instance (ghi ở ADR-0018); khi scale cần khoá trong DB hoặc Redis.
- `show_card` trả lại thẻ trong output nên mô hình thấy nó một lần nữa (≤ 2 KB); có thể thêm cách tách "thứ cho mô hình" khỏi "thứ cho UI" vào `@cuelingo/agent`.
