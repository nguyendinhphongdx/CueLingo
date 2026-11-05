# @cuelingo/agent

> Phần: [Shared packages](./README.md) · Code: `packages/agent/src/` · Quyết định: [ADR 0018](../../08-adr/0018-agent-harness.md) · Hồ sơ: [ai-agent](../../06-delivery/2026-11-05-ai-agent/02-plan.md)

Harness của trợ lý AI, **không I/O**: cổng mô hình, cắt ngữ cảnh, công cụ/plugin và vòng lặp một lượt "nghĩ → gọi công cụ → trả lời".

## Trách nhiệm

Bốn phần tách riêng, mỗi phần một file và một file test (AC18):

| Phần     | File                    | Việc                                                                                                       |
| -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Mô hình  | `model.ts`              | `ModelPort.step(input)` stream một bước. API nối `ai-gateway.chat()` vào đây; thay mô hình chỉ đổi adapter |
| Ngữ cảnh | `context.ts`            | `buildContext`: cắt theo ngân sách token bằng quy tắc cố định                                              |
| Công cụ  | `tools.ts`, `plugin.ts` | `defineTool`, `runTool` (an toàn), `createToolRegistry`, `AgentPlugin`                                     |
| Vòng lặp | `loop.ts`               | `runTurn`: async generator phát `AgentStreamEvent` của `@cuelingo/shared`                                  |

Thêm: `parts.ts` (`createPartsBuilder`, gộp event thành `parts` để lưu tin nhắn), `limits.ts` (hằng số).

## Phạm vi MVP

- Lô 1 của hồ sơ ai-agent. Runtime plugin đầy đủ (bật/tắt, cầu dao) là lô 2.

## Interface

```ts
// model.ts
interface ModelPort { step(input: ModelStepInput): AsyncIterable<ModelEvent> }
// ModelStepInput = { language, messages: ModelMessage[], tools: ModelToolDeclaration[], signal }
// ModelEvent = text_delta | tool_call{call:{id,name,input}} | finish{reason, inputTokens?, outputTokens?}

// loop.ts
function runTurn<C>(input: TurnInput<C>): AsyncGenerator<AgentStreamEvent, void, void>
// TurnInput = { model, registry, history, userMessage, language, capabilities, signal?, limits?, hooks?, reservedTokens? }

// context.ts
function buildContext({ history, budgetTokens, reservedTokens? }): { messages, droppedTurns, estimatedTokens }

// tools.ts
function defineTool<C, I, O>({ name, description, kind: 'read' | 'write', input, output, run, toCard?, summarize? }): AgentTool<C>
function runTool(tool, rawInput, { capabilities, signal }, { timeoutMs?, maxOutputBytes? }): Promise<ToolRunResult>

// plugin.ts
interface AgentPlugin<C> { id; version; permissions: AgentPermission[]; tools: AgentTool<C>[]; cardKinds?; setup?(host) }
function createToolRegistry<C>(): ToolRegistry<C>   // register · unregister · tools · get · list
```

**`runTurn`**

- Luôn kết thúc bằng đúng một `done`, không ném lỗi. Thứ tự: `status{thinking}` (đầu mỗi bước) → `text_delta`\* → `tool_call` → `tool_result` → `card`? → … → `done`.
- `done.status`: `complete` (mô hình trả lời không gọi công cụ), `stopped` (người dùng abort), `limited` (hết 6 bước, hết 60 giây hoặc `hooks.beforeStep` trả `false`, ví dụ hết quota), `error` (bước mô hình lỗi: phát `error{AGENT_FAILED}` trước `done`).
- Mặc định (`DEFAULT_LIMITS`): 6 bước, 3 lần gọi tool ghi (lần thứ 4 trở đi nhận `tool_result{ok:false}` "Đã đạt giới hạn…" mà không chạy), 60 giây một lượt, ngân sách ngữ cảnh 24k token, tool 8 giây.
- Mỗi lời gọi tool nhận `callId` do vòng lặp đặt (`s<bước>c<thứ tự>`), không dùng id của mô hình, nên luôn duy nhất và khớp cặp call/result.
- `hooks.beforeStep(step)` để API kiểm quota trước mỗi bước; `hooks.afterStep({step, inputTokens, outputTokens})` để cộng token.

**`runTool`** không bao giờ ném: kiểm input bằng Zod, chạy với `AbortSignal` gộp (abort của lượt + timeout), kiểm output bằng Zod, cắt output vào ngữ cảnh còn ≤ 2 KB (UTF-8; quá thì thành JSON `{truncated:true, preview}` vẫn hợp lệ). Mọi lỗi (`unknown_tool`, `invalid_input`, `timeout`, `aborted`, `failed`, `invalid_output`, `limit`) thành `ok:false` kèm **một câu tiếng Việt** (`TOOL_ERRORS_VI`); nội dung lỗi gốc không đi ra ngoài. `toCard` (nếu có) được kiểm bằng `AgentCardSchema` trước khi thành event `card`.

**`buildContext`**: gom tin thành lượt (mỗi lượt bắt đầu ở tin `user`); bỏ lượt **cũ nhất** nguyên vẹn đến khi vừa ngân sách; luôn giữ lượt cuối kể cả khi vượt; cặp call/result không bị tách, call không có result (hoặc ngược lại) bị loại. Ước lượng 4 ký tự ≈ 1 token. System prompt do gateway thêm nên truyền kích thước vào `reservedTokens`.

**`AgentPlugin`**: `setup` lỗi thì plugin `failed`, tool của nó không đưa cho mô hình, plugin khác chạy bình thường. Tên tool trùng với tool đã nạp, hoặc trùng `id` plugin đã nạp, thì plugin mới bị `failed`. Plugin chỉ nhận `ctx.capabilities` do API dựng sẵn (đã gắn `userId`), không nhận `userId` hay SQL.

## Phụ thuộc

- `@cuelingo/shared` (kiểu event, thẻ, mã lỗi) và `zod`. Không gì khác.
- Luật `agent-has-no-io` trong `.dependency-cruiser.cjs`: cấm fs/mạng/DB, SDK AI và import `ai-gateway`, `prompts`, `core-sdk`, `learner-model`, `ui`.

## Dữ liệu & sự kiện

- Không lưu gì. Người gọi lưu `parts` (qua `createPartsBuilder`) và ghi `ai_call` (gateway). Không log nội dung tin nhắn hay output tool.

## Câu hỏi mở

- Lô 2: registry lúc chạy đầy đủ (`enable`/`disable`, cầu dao 3 lỗi liên tiếp tắt 10 phút, kiểm quyền qua facade) trong `registry.ts`.
